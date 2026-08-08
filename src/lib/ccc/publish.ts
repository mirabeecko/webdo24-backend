// ============================================
// CCC – Publishing workflow  (architektura §5, §7 rollback)
//
// approveChangeSet:    preview_ready → approved (guard 'publish')
// publishChangeSet:    approved → publishing → published | publish_failed
// verifyPublication:   post-publish kontrola (§5.3), graceful vůči
//                      rendereru bez meta tagu (Phase 4)
// rollbackPublication: nový ChangeSet s prohozenými old/new, projde
//                      stejnou trasou preview → approve → publish (§5.4)
//
// LIMITACE (zdokumentováno, §5.2): PostgREST neumí multi-statement
// transakce a projekt zatím nemá RPC/DB funkce jako pattern – publish
// běží jako sekvence service-role dotazů. Atomicita koncového stavu je
// řešená aplikačně: při chybě v aplikační fázi se changeset překlopí do
// 'publish_failed' a chyba se zaloguje do audit logu. Částečně aplikované
// content_values jsou vždy konzistentní published stav (nikdy draft),
// případný rozdíl proti items_snapshot je dohledatelný v audit logu.
// Až vznikne potřeba, převést na jednu DB funkci (RPC) beze změny API.
// ============================================

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { GuardError, requireCapability, requireProjectCapability } from '@/lib/ccc/guard'
import { createChangeSet } from '@/lib/ccc/changesets'
import {
  loadAndValidateChangeSet,
  requestPreview,
  ValidationError,
  type ValidatedItem,
} from '@/lib/ccc/preview'
import {
  BRAND_MAP_COLUMNS,
  COMPANY_MAP_COLUMNS,
  getPublicContentMap,
  type ContentMap,
} from '@/lib/ccc/registry'
import type {
  ChangeSet,
  Publication,
  PublicationItemSnapshot,
} from '@/types/website-contract'
import type { SiteSnapshot, SiteVersionAuthor } from '@/types'

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

async function loadChangeSet(id: string): Promise<ChangeSet> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('webdo24_changesets')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) throw new GuardError('not_found', 'ChangeSet nenalezen')
  return data as ChangeSet
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}

/** changeset.source → site_versions.created_by_type (sql/006 check). */
function authorType(source: ChangeSet['source']): SiteVersionAuthor {
  switch (source) {
    case 'ai':
      return 'ai'
    case 'webdo24':
      return 'admin'
    default:
      return 'customer'
  }
}

/**
 * Hodnota pro sloupec profilové tabulky. Sloupce *_asset_id jsou uuid –
 * z media hodnoty {asset_id, url, alt} se do profilu zapíše jen asset_id
 * (celá hodnota zůstává v content_values / content mapě).
 */
function profileColumnValue(column: string, value: unknown): unknown {
  if (
    column.endsWith('_asset_id') &&
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return (value as Record<string, unknown>).asset_id ?? null
  }
  return value
}

// --------------------------------------------------------------
// APPROVE  (preview_ready → approved)
// --------------------------------------------------------------

export async function approveChangeSet(changesetId: string): Promise<{ ok: true }> {
  const changeset = await loadChangeSet(changesetId)
  const ctx = await requireCapability(changeset.customer_id, 'publish')

  if (changeset.status !== 'preview_ready') {
    throw new GuardError(
      'forbidden',
      `Schválit lze jen ChangeSet ve stavu 'preview_ready' (aktuálně '${changeset.status}')`,
    )
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('webdo24_changesets')
    .update({ status: 'approved' })
    .eq('id', changesetId)
  if (error) throw new Error(`approve_failed: ${error.message}`)

  await admin.from('webdo24_audit_log').insert({
    user_id: ctx.userId,
    customer_id: ctx.customerId,
    project_id: changeset.project_id,
    action: 'CHANGESET_APPROVED',
    entity: 'changeset',
    entity_id: changesetId,
  })

  return { ok: true }
}

// --------------------------------------------------------------
// Aplikace itemů na published stav  (§5.2 krok 3)
// --------------------------------------------------------------

async function applyItems(
  changeset: ChangeSet,
  items: ValidatedItem[],
): Promise<void> {
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const companyUpdates: Record<string, unknown> = {}
  const brandUpdates: Record<string, unknown> = {}

  for (const item of items) {
    // company.* / branding.* → profilové tabulky (kanonický zdroj, §3.3)
    // + synchronně content_values, aby buildContentMap (Registry má
    // přednost před profily) nečetl zastaranou hodnotu.
    if (item.field_key.startsWith('company.')) {
      const column = item.field_key.slice('company.'.length)
      if (!(COMPANY_MAP_COLUMNS as readonly string[]).includes(column)) {
        throw new Error(`unknown_company_column: ${column}`)
      }
      companyUpdates[column] = profileColumnValue(column, item.new_value)
    } else if (item.field_key.startsWith('branding.')) {
      const column = item.field_key.slice('branding.'.length)
      if (!(BRAND_MAP_COLUMNS as readonly string[]).includes(column)) {
        throw new Error(`unknown_branding_column: ${column}`)
      }
      brandUpdates[column] = profileColumnValue(column, item.new_value)
    }

    const { error } = await admin
      .from('webdo24_content_values')
      .upsert(
        {
          field_id: item.field_id,
          published_value: item.new_value,
          published_at: nowIso,
        },
        { onConflict: 'field_id' },
      )
    if (error) throw new Error(`apply_content_value_failed: ${error.message}`)
  }

  if (Object.keys(companyUpdates).length > 0) {
    const { error } = await admin
      .from('webdo24_company_profiles')
      .upsert(
        {
          project_id: changeset.project_id,
          customer_id: changeset.customer_id,
          ...companyUpdates,
        },
        { onConflict: 'project_id' },
      )
    if (error) throw new Error(`apply_company_profile_failed: ${error.message}`)
  }

  if (Object.keys(brandUpdates).length > 0) {
    const { error } = await admin
      .from('webdo24_brand_profiles')
      .upsert(
        {
          project_id: changeset.project_id,
          customer_id: changeset.customer_id,
          ...brandUpdates,
        },
        { onConflict: 'project_id' },
      )
    if (error) throw new Error(`apply_brand_profile_failed: ${error.message}`)
  }
}

// --------------------------------------------------------------
// PUBLISH  (approved → publishing → published | publish_failed)
// --------------------------------------------------------------

export interface PublishResult {
  changesetId: string
  publicationId: string
  siteVersionId: string
  status: 'published' | 'publish_failed'
  verification: PublicationVerification
}

export async function publishChangeSet(
  changesetId: string,
  opts?: { rollbackOf?: string },
): Promise<PublishResult> {
  // re-validace všech itemů proti Registry (§5.2 krok 3)
  const { changeset, items, errors } = await loadAndValidateChangeSet(changesetId)

  const ctx = await requireCapability(changeset.customer_id, 'publish')

  // stavový automat §4: publish jen z approved (retry z publish_failed
  // zatím není podporován – viz report/limitace)
  if (changeset.status !== 'approved') {
    throw new GuardError(
      'forbidden',
      `Publikovat lze jen schválený ChangeSet (aktuálně '${changeset.status}')`,
    )
  }
  if (errors.length > 0) throw new ValidationError(errors)

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  // approved → publishing
  const { error: publishingError } = await admin
    .from('webdo24_changesets')
    .update({ status: 'publishing' })
    .eq('id', changesetId)
  if (publishingError) throw new Error(`publishing_failed: ${publishingError.message}`)

  const { data: project } = await admin
    .from('webdo24_projects')
    .select('slug, current_version_id')
    .eq('id', changeset.project_id)
    .single()

  const slug = (project?.slug as string | null) ?? null

  // --- aplikační fáze (kroky 3–6) – při chybě → publish_failed ---
  let publicationId = ''
  let siteVersionId = ''
  try {
    await applyItems(changeset, items)

    // 4. nová live site_version (snapshot published stavu; stará live → archived)
    const content: ContentMap = slug ? ((await getPublicContentMap(slug)) ?? {}) : {}
    const snapshot: SiteSnapshot & { content: ContentMap } = {
      schema_version: 1,
      theme: {
        primary_color: str(content['branding.primary_color']),
      },
      meta: {},
      sections: [],
      contact: {
        phone: str(content['company.phone']),
        email: str(content['company.email']),
        address:
          [str(content['company.street']), str(content['company.city'])]
            .filter(Boolean)
            .join(', ') || undefined,
      },
      content,
    }

    const previousLiveId = (project?.current_version_id as string | null) ?? null
    if (previousLiveId) {
      const { error } = await admin
        .from('webdo24_site_versions')
        .update({ status: 'archived', archived_at: nowIso })
        .eq('id', previousLiveId)
      if (error) throw new Error(`archive_live_failed: ${error.message}`)
    }

    const { data: version, error: versionError } = await admin
      .from('webdo24_site_versions')
      .insert({
        project_id: changeset.project_id,
        parent_version_id: previousLiveId,
        snapshot,
        status: 'live',
        created_by_type: authorType(changeset.source),
        created_by_user_id: ctx.userId,
        note: changeset.title,
        published_at: nowIso,
        changeset_id: changesetId,
      })
      .select('id')
      .single()
    if (versionError || !version) {
      throw new Error(`create_version_failed: ${versionError?.message ?? 'unknown'}`)
    }
    siteVersionId = version.id as string

    // 5. pointer projektu na novou live verzi
    const { error: pointerError } = await admin
      .from('webdo24_projects')
      .update({ current_version_id: siteVersionId, updated_at: nowIso })
      .eq('id', changeset.project_id)
    if (pointerError) throw new Error(`update_project_failed: ${pointerError.message}`)

    // 6. publications (items_snapshot: field_key, old, new)
    const itemsSnapshot: PublicationItemSnapshot[] = items.map((item) => ({
      field_key: item.field_key,
      old: item.old_value,
      new: item.new_value,
    }))

    const { data: publication, error: pubError } = await admin
      .from('webdo24_publications')
      .insert({
        changeset_id: changesetId,
        project_id: changeset.project_id,
        customer_id: changeset.customer_id,
        site_version_id: siteVersionId,
        published_by: ctx.userId,
        items_snapshot: itemsSnapshot,
        status: 'published', // po verification se případně překlopí na 'failed'
        is_rollback_of: opts?.rollbackOf ?? null,
      })
      .select('id')
      .single()
    if (pubError || !publication) {
      throw new Error(`create_publication_failed: ${pubError?.message ?? 'unknown'}`)
    }
    publicationId = publication.id as string

    // 8. audit
    await admin.from('webdo24_audit_log').insert({
      user_id: ctx.userId,
      customer_id: ctx.customerId,
      project_id: changeset.project_id,
      action: 'WEBSITE_PUBLISHED',
      entity: 'changeset',
      entity_id: changesetId,
      diff: {
        publication_id: publicationId,
        site_version_id: siteVersionId,
        items: itemsSnapshot.map((i) => i.field_key),
      },
    })
  } catch (err) {
    // kompenzace koncového stavu (viz limitace v hlavičce)
    await admin
      .from('webdo24_changesets')
      .update({ status: 'publish_failed' })
      .eq('id', changesetId)
    await admin.from('webdo24_audit_log').insert({
      user_id: ctx.userId,
      customer_id: ctx.customerId,
      project_id: changeset.project_id,
      action: 'WEBSITE_PUBLISH_FAILED',
      entity: 'changeset',
      entity_id: changesetId,
      diff: { error: err instanceof Error ? err.message : String(err) },
    })
    throw err
  }

  // --- mimo "transakci": cache, verification, koncový stav ---
  if (slug) revalidatePath(`/${slug}`)
  revalidatePath('/')

  const verification = await verifyPublication(publicationId)

  const finalStatus = verification.ok ? 'published' : 'publish_failed'
  await admin
    .from('webdo24_changesets')
    .update({ status: finalStatus })
    .eq('id', changesetId)

  if (!verification.ok) {
    await admin
      .from('webdo24_publications')
      .update({ status: 'failed' })
      .eq('id', publicationId)
  }

  // notifikace zákazníkovi (§5.2)
  await admin.from('webdo24_notifications').insert({
    customer_id: changeset.customer_id,
    user_id: ctx.userId,
    type: verification.ok ? 'published' : 'publish_failed',
    title: verification.ok ? 'Změny byly publikovány' : 'Publikování změn selhalo',
    body: changeset.title,
    link: '/web',
  })

  return {
    changesetId,
    publicationId,
    siteVersionId,
    status: finalStatus,
    verification,
  }
}

// --------------------------------------------------------------
// POST-PUBLISH VERIFICATION  (§5.3)
// --------------------------------------------------------------

export interface PublicationVerification {
  ok: boolean
  checked_at: string
  checks: {
    page: { ok: boolean; status: number | null; url: string }
    version_meta: { state: 'ok' | 'mismatch' | 'skipped'; found: string | null }
    media: Array<{ url: string; ok: boolean; status: number | null }>
  }
}

/**
 * Post-publish kontrola: stránka dostupná (HTTP 200), meta verze
 * (renderer vypisuje <meta name="webdo24:version"> od Phase 4 – chybějící
 * meta u legacy rendereru = 'skipped', mismatch = fail), HEAD na URL
 * nových media assetů (zaznamenáno, nefatální).
 * Failed = stránka není dostupná NEBO verze na stránce nesedí.
 */
export async function verifyPublication(
  publicationId: string,
): Promise<PublicationVerification> {
  const admin = createAdminClient()
  const { data: publication, error } = await admin
    .from('webdo24_publications')
    .select('*, webdo24_projects(slug)')
    .eq('id', publicationId)
    .maybeSingle()

  if (error || !publication) throw new GuardError('not_found', 'Publikace nenalezena')

  await requireCapability(publication.customer_id as string, 'view')

  const project = Array.isArray(publication.webdo24_projects)
    ? publication.webdo24_projects[0]
    : publication.webdo24_projects
  const slug = (project as { slug: string | null } | null)?.slug ?? ''

  const baseUrl = process.env.APP_PUBLIC_URL ?? 'https://web.webdo24.cz'
  const pageUrl = `${baseUrl}/${slug}?__wd24_health=1`

  const verification: PublicationVerification = {
    ok: false,
    checked_at: new Date().toISOString(),
    checks: {
      page: { ok: false, status: null, url: pageUrl },
      version_meta: { state: 'skipped', found: null },
      media: [],
    },
  }

  // 1+2. stránka + meta verze
  try {
    const res = await fetch(pageUrl, {
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    verification.checks.page.status = res.status
    verification.checks.page.ok = res.ok

    if (res.ok) {
      const html = await res.text()
      const metaMatch = html.match(
        /<meta\s+name="webdo24:version"\s+content="([^"]+)"/i,
      )
      if (metaMatch) {
        verification.checks.version_meta = {
          state:
            metaMatch[1] === publication.site_version_id ? 'ok' : 'mismatch',
          found: metaMatch[1],
        }
      }
      // meta tag chybí → legacy renderer / nemigrovaný web → 'skipped'
    }
  } catch {
    // síťová chyba → page.ok zůstává false
  }

  // 3. media HEAD (jen pro itemy s asset_id v nové hodnotě)
  const snapshot = (publication.items_snapshot as PublicationItemSnapshot[]) ?? []
  const assetIds = snapshot
    .map((i) => i.new)
    .filter(
      (v): v is { asset_id: string } =>
        typeof v === 'object' &&
        v !== null &&
        !Array.isArray(v) &&
        typeof (v as Record<string, unknown>).asset_id === 'string',
    )
    .map((v) => v.asset_id)

  if (assetIds.length > 0) {
    const { data: assets } = await admin
      .from('webdo24_media_assets')
      .select('id, original_url, optimized_url')
      .in('id', assetIds)

    for (const asset of (assets as Array<{
      id: string
      original_url: string
      optimized_url: string | null
    }> | null) ?? []) {
      const url = asset.optimized_url ?? asset.original_url
      let ok = false
      let status: number | null = null
      try {
        const res = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(10_000),
        })
        ok = res.ok
        status = res.status
      } catch {
        // nedostupný asset → zaznamenáno, nefatální (§5.3 graceful)
      }
      verification.checks.media.push({ url, ok, status })
    }
  }

  verification.ok =
    verification.checks.page.ok &&
    verification.checks.version_meta.state !== 'mismatch'

  await admin
    .from('webdo24_publications')
    .update({ verification: verification as unknown as Record<string, unknown> })
    .eq('id', publicationId)

  return verification
}

// --------------------------------------------------------------
// ROLLBACK  (§5.4 – nová verze přes stejnou trasu, historie se nemaže)
// --------------------------------------------------------------

export interface RollbackResult {
  changeSetId: string
  publicationId: string
  rolledBackPublicationId: string
  /** Pole přeskočená, protože před změnou neměla žádnou hodnotu. */
  skippedFields: string[]
}

export async function rollbackPublication(
  publicationId: string,
): Promise<RollbackResult> {
  const admin = createAdminClient()
  const { data: publication, error } = await admin
    .from('webdo24_publications')
    .select('*')
    .eq('id', publicationId)
    .maybeSingle()

  if (error || !publication) throw new GuardError('not_found', 'Publikace nenalezena')

  const ctx = await requireCapability(publication.customer_id as string, 'publish')

  if (publication.status !== 'published') {
    throw new GuardError(
      'forbidden',
      `Vrátit lze jen publikaci ve stavu 'published' (aktuálně '${publication.status}')`,
    )
  }

  const snapshot = (publication.items_snapshot as PublicationItemSnapshot[]) ?? []

  // Pole s old = null před změnou hodnotu neměla → nelze vrátit
  // (new_value je NOT NULL); přeskočíme a zaznamenáme.
  const skippedFields = snapshot.filter((i) => i.old === null).map((i) => i.field_key)
  const items = snapshot
    .filter((i) => i.old !== null)
    .map((i) => ({ fieldKey: i.field_key, newValue: i.old }))

  if (items.length === 0) {
    throw new GuardError('forbidden', 'Publikace nemá žádnou vratnou změnu')
  }

  const date = new Date(publication.created_at as string).toLocaleDateString('cs-CZ')

  // Stejná trasa jako běžná změna (§5.4): draft → preview → approve → publish
  const changeset = await createChangeSet({
    projectId: publication.project_id as string,
    title: `Vrácení změny z ${date}`,
    items,
    source: 'gui',
  })
  await requestPreview(changeset.id)
  await approveChangeSet(changeset.id)
  const published = await publishChangeSet(changeset.id, {
    rollbackOf: publicationId,
  })

  // původní publikace → rolled_back
  await admin
    .from('webdo24_publications')
    .update({ status: 'rolled_back' })
    .eq('id', publicationId)

  await admin.from('webdo24_audit_log').insert({
    user_id: ctx.userId,
    customer_id: ctx.customerId,
    project_id: publication.project_id,
    action: 'ROLLBACK',
    entity: 'publication',
    entity_id: publicationId,
    diff: {
      new_changeset_id: changeset.id,
      new_publication_id: published.publicationId,
      skipped_fields: skippedFields,
    },
  })

  return {
    changeSetId: changeset.id,
    publicationId: published.publicationId,
    rolledBackPublicationId: publicationId,
    skippedFields,
  }
}

// --------------------------------------------------------------
// LIST  (historie změn – §9 GET /api/v1/publications)
// --------------------------------------------------------------

export async function listPublications(
  projectId: string,
  limit = 50,
): Promise<Publication[]> {
  await requireProjectCapability(projectId, 'view')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('webdo24_publications')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data as Publication[]
}
