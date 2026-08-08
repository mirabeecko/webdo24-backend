// ============================================
// Acceptance testy CCC lifecycle (architektura §41, TEST A–E)
//
// End-to-end přes HTTP proti dev serveru (localhost:3001) s reálnou
// session seed zákazníka (auth přes Supabase auth API, cookie přes
// @supabase/ssr – přesně tak, jak to dělá prohlížeč).
//
// Předpoklady:
//   1. běží dev server:  env -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_URL -u SUPABASE_ANON_KEY npm run dev
//   2. migrovaný demo projekt truhlarstvi-drevorez (scripts/migrate-content-to-registry.ts)
//
// Spuštění:
//   env -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_URL -u SUPABASE_ANON_KEY \
//     npx tsx scripts/test-ccc-lifecycle.ts
//
// TEST A: text (hero title) – create → preview → approve → publish → curl → rollback
// TEST B: image (hero image) – upload → publish → výměna → rollback
// TEST C: global data (company.phone) – publish → všude na stránce → rollback
// TEST D: logo (branding.logo_asset_id) – upload → publish → v HTML
// TEST E: rollback vazby – publications statusy + is_rollback_of
// ============================================

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3001'
const SLUG = 'truhlarstvi-drevorez'
const EMAIL = 'karel.poctak@seznam.cz'
const PASSWORD = 'Webdo24!Test'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// --------------------------------------------------------------
// Test framework (minimal)
// --------------------------------------------------------------

let passed = 0
let failed = 0

function check(name: string, cond: boolean, evidence = '') {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}${evidence ? ` — ${evidence}` : ''}`)
  } else {
    failed++
    console.log(`  ✗ FAIL: ${name}${evidence ? ` — ${evidence}` : ''}`)
  }
}

// --------------------------------------------------------------
// Auth: session cookie přes @supabase/ssr (jako prohlížeč)
// --------------------------------------------------------------

async function loginCookie(): Promise<string> {
  const jar = new Map<string, string>()
  const client = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach((c) => jar.set(c.name, c.value)),
    },
  })
  const { error } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (error) throw new Error(`login failed: ${error.message}`)
  if (jar.size === 0) throw new Error('login produced no cookies')
  return [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ')
}

// --------------------------------------------------------------
// HTTP helpers
// --------------------------------------------------------------

let COOKIE = ''

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiJson = any // odpovědi API – test je schválně dynamický

/** Přečte published_value z PostgREST joinu (objekt nebo 1-prvkové pole). */
function joinedPublishedValue(join: unknown): unknown {
  const v = Array.isArray(join) ? join[0] : join
  return (v as { published_value?: unknown } | null)?.published_value ?? null
}

async function api(method: string, path: string, body?: unknown): Promise<{ status: number; json: ApiJson }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: COOKIE,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

async function apiUpload(projectId: string, png: Buffer, filename: string): Promise<{ status: number; json: ApiJson }> {
  const fd = new FormData()
  fd.set('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), filename)
  fd.set('project_id', projectId)
  fd.set('category', 'photo')
  const res = await fetch(`${BASE}/api/v1/media`, {
    method: 'POST',
    headers: { Cookie: COOKIE },
    body: fd,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

async function getPageHtml(query = ''): Promise<string> {
  const res = await fetch(`${BASE}/${SLUG}${query}`, { cache: 'no-store' })
  return res.text()
}

// changeset lifecycle rozdělený: create+preview (pak se dají testovat
// preview/produkce stavy) a teprve potom approve+publish
async function createAndPreview(
  title: string,
  items: Array<{ fieldKey: string; newValue: unknown }>,
): Promise<{ changesetId: string; previewUrl: string }> {
  const create = await api('POST', '/api/v1/changesets', {
    projectId: PROJECT_ID,
    title,
    items,
    source: 'api',
  })
  if (create.status !== 201) throw new Error(`create failed: ${JSON.stringify(create.json)}`)
  const changesetId = create.json.id as string

  const preview = await api('POST', `/api/v1/changesets/${changesetId}/preview`)
  if (preview.status !== 200) throw new Error(`preview failed: ${JSON.stringify(preview.json)}`)

  return { changesetId, previewUrl: preview.json.previewUrl as string }
}

async function approveAndPublish(
  changesetId: string,
): Promise<{ publicationId: string; publishResult: ApiJson }> {
  const approve = await api('POST', `/api/v1/changesets/${changesetId}/approve`)
  if (approve.status !== 200) throw new Error(`approve failed: ${JSON.stringify(approve.json)}`)

  const publish = await api('POST', `/api/v1/changesets/${changesetId}/publish`)
  if (publish.status !== 200) throw new Error(`publish failed: ${JSON.stringify(publish.json)}`)

  return {
    publicationId: publish.json.publicationId as string,
    publishResult: publish.json,
  }
}

async function runLifecycle(
  title: string,
  items: Array<{ fieldKey: string; newValue: unknown }>,
): Promise<{ changesetId: string; publicationId: string; previewUrl: string; publishResult: ApiJson }> {
  const { changesetId, previewUrl } = await createAndPreview(title, items)
  const { publicationId, publishResult } = await approveAndPublish(changesetId)
  return { changesetId, publicationId, previewUrl, publishResult }
}

// preview URL z API míří na APP_PUBLIC_URL – pro test vezmi jen query string
function localizePreviewUrl(url: string): string {
  return new URL(url).search
}

// 1×1 PNG (červený pixel) – magic bytes 89 50 4E 47
const PNG_1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
// 1×1 PNG (modrý pixel)
const PNG_2 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

let PROJECT_ID = ''

// --------------------------------------------------------------
// TESTY
// --------------------------------------------------------------

async function testA() {
  console.log('\n▶ TEST A: textová změna (homepage.hero.title)')
  const { data: field } = await admin
    .from('webdo24_content_fields')
    .select('id, webdo24_content_values(published_value)')
    .eq('project_id', PROJECT_ID)
    .eq('field_key', 'homepage.hero.title')
    .single()
  const original = joinedPublishedValue(field?.webdo24_content_values) as string
  check('A0: původní title v DB', typeof original === 'string' && original.length > 0, original)

  const before = await getPageHtml()
  check('A1: stránka obsahuje původní title', before.includes(original))

  const newTitle = `TEST-A nadpis ${Date.now()}`
  const { changesetId, previewUrl } = await createAndPreview('TEST A – změna nadpisu', [
    { fieldKey: 'homepage.hero.title', newValue: newTitle },
  ])

  // preview overlay: draft viditelný jen s tokenem
  const previewHtml = await getPageHtml(localizePreviewUrl(previewUrl))
  check('A2: preview URL ukazuje NOVÝ text', previewHtml.includes(newTitle))
  check('A3: preview bar je v preview režimu', previewHtml.includes('Náhled nepublikovaných změn'))

  const prodHtml = await getPageHtml()
  check('A4: produkce před publikací stále STARÝ text', prodHtml.includes(original) && !prodHtml.includes(newTitle))

  const badPreview = await getPageHtml(`?__wd24_cs=${changesetId}&__wd24_preview=badtoken&__wd24_exp=99999999999999`)
  check('A5: neplatný token → produkční obsah, bez preview baru', !badPreview.includes(newTitle) && !badPreview.includes('Náhled nepublikovaných'))

  const { publicationId, publishResult } = await approveAndPublish(changesetId)
  check('A6: publish status published', publishResult.status === 'published', JSON.stringify(publishResult.verification?.checks?.page))

  const after = await getPageHtml()
  check('A7: produkce po publish obsahuje NOVÝ text', after.includes(newTitle))
  const metaMatch = after.match(/<meta name="webdo24:version" content="([^"]+)"/)
  check(
    'A8: meta webdo24:version = nová site_version',
    !!metaMatch && metaMatch[1] === publishResult.siteVersionId,
    metaMatch?.[1],
  )
  check('A9: data-content-id binding v HTML', after.includes('data-content-id="homepage.hero.title"'))

  const { data: audit } = await admin
    .from('webdo24_audit_log')
    .select('action')
    .eq('entity_id', changesetId)
    .in('action', ['CHANGESET_CREATED', 'CHANGESET_APPROVED', 'WEBSITE_PUBLISHED'])
  const actions = new Set((audit ?? []).map((a) => a.action))
  check(
    'A10: audit CHANGESET_CREATED/APPROVED/WEBSITE_PUBLISHED',
    actions.has('CHANGESET_CREATED') && actions.has('CHANGESET_APPROVED') && actions.has('WEBSITE_PUBLISHED'),
  )

  // rollback
  const rb = await api('POST', `/api/v1/publications/${publicationId}/rollback`)
  check('A11: rollback API ok', rb.status === 200, JSON.stringify(rb.json).slice(0, 120))

  const reverted = await getPageHtml()
  check('A12: po rollbacku je zpět PŮVODNÍ text', reverted.includes(original) && !reverted.includes(newTitle))
}

async function testC() {
  console.log('\n▶ TEST C: globální údaj (company.phone)')
  const { data: field } = await admin
    .from('webdo24_content_fields')
    .select('webdo24_content_values(published_value)')
    .eq('project_id', PROJECT_ID)
    .eq('field_key', 'company.phone')
    .single()
  const original = joinedPublishedValue(field?.webdo24_content_values) as string

  const newPhone = '+420 999 000 111'
  const before = await getPageHtml()
  const beforeCount = before.split(original).length - 1
  check('C0: původní telefon na stránce (2× = hero CTA + kontakt)', beforeCount >= 2, `${beforeCount}×`)

  const { publicationId, publishResult } = await runLifecycle('TEST C – změna telefonu', [
    { fieldKey: 'company.phone', newValue: newPhone },
  ])
  check('C1: publish ok', publishResult.status === 'published')

  const after = await getPageHtml()
  const afterCount = after.split(newPhone).length - 1
  check('C2: nový telefon všude (hero CTA + kontakt)', afterCount >= 2 && !after.includes(original), `${afterCount}×`)

  // profilová tabulka synchronizovaná
  const { data: profile } = await admin
    .from('webdo24_company_profiles')
    .select('phone')
    .eq('project_id', PROJECT_ID)
    .single()
  check('C3: company_profiles.phone synchronizován', profile?.phone === newPhone)

  const rb = await api('POST', `/api/v1/publications/${publicationId}/rollback`)
  check('C4: rollback ok', rb.status === 200)
  const reverted = await getPageHtml()
  check('C5: původní telefon zpět všude', reverted.split(original).length - 1 >= 2 && !reverted.includes(newPhone))
}

async function testBD() {
  console.log('\n▶ TEST B/D: image (hero) + logo (branding)')

  // upload dvou assetů přes API
  const up1 = await apiUpload(PROJECT_ID, PNG_1, 'test-hero-1.png')
  check('B1: upload assetu 1', up1.status === 201, up1.json?.storage_path)
  const asset1 = up1.json
  const up2 = await apiUpload(PROJECT_ID, PNG_2, 'test-hero-2.png')
  check('B2: upload assetu 2', up2.status === 201)
  const asset2 = up2.json

  const { data: assetRow } = await admin
    .from('webdo24_media_assets')
    .select('id, storage_path, mime_type')
    .eq('id', asset1.id)
    .single()
  check('B3: asset v DB se scoped storage path', !!assetRow && assetRow.storage_path.includes(PROJECT_ID), assetRow?.storage_path)

  // B: hero image
  await runLifecycle('TEST B – hero obrázek', [
    { fieldKey: 'homepage.hero.hero_image', newValue: { asset_id: asset1.id, url: asset1.original_url, alt: 'Test hero' } },
  ])
  const html1 = await getPageHtml()
  check('B4: hero obrázek 1 v HTML', html1.includes(asset1.original_url))

  const pub2 = await runLifecycle('TEST B – výměna hero obrázku', [
    { fieldKey: 'homepage.hero.hero_image', newValue: { asset_id: asset2.id, url: asset2.original_url, alt: 'Test hero 2' } },
  ])
  const html2 = await getPageHtml()
  check('B5: po výměně hero obrázek 2', html2.includes(asset2.original_url) && !html2.includes(asset1.original_url))

  const { data: both } = await admin.from('webdo24_media_assets').select('id').in('id', [asset1.id, asset2.id])
  check('B6: původní asset po výměně stále existuje (§8 verzování)', (both ?? []).length === 2)

  const rb = await api('POST', `/api/v1/publications/${pub2.publicationId}/rollback`)
  check('B7: rollback výměny ok', rb.status === 200)
  const html3 = await getPageHtml()
  check('B8: po rollbacku zpět obrázek 1', html3.includes(asset1.original_url) && !html3.includes(asset2.original_url))

  // D: logo
  const up3 = await apiUpload(PROJECT_ID, PNG_2, 'test-logo.png')
  const asset3 = up3.json
  await runLifecycle('TEST D – logo', [
    { fieldKey: 'branding.logo_asset_id', newValue: { asset_id: asset3.id, url: asset3.original_url, alt: 'Logo' } },
  ])
  const html4 = await getPageHtml()
  check('D1: logo v hlavičce', html4.includes(asset3.original_url))
  const { data: brand } = await admin
    .from('webdo24_brand_profiles')
    .select('logo_asset_id')
    .eq('project_id', PROJECT_ID)
    .single()
  check('D2: brand_profiles.logo_asset_id synchronizován', brand?.logo_asset_id === asset3.id)
  // pozn.: rollback loga nelze – před změnou nemělo hodnotu (old=null),
  // rollbackPublication taková pole přeskočí (zdokumentovaná limitace §5.4)
}

async function testE() {
  console.log('\n▶ TEST E: publications statusy + rollback vazby')
  const { data: pubs } = await admin
    .from('webdo24_publications')
    .select('id, status, is_rollback_of, changeset_id')
    .eq('project_id', PROJECT_ID)
    .order('created_at', { ascending: true })

  const all = pubs ?? []
  check('E1: existují publications', all.length >= 4, `${all.length} záznamů`)
  check(
    'E2: rollback publikace mají is_rollback_of',
    all.filter((p) => p.is_rollback_of).length >= 2,
  )
  check(
    'E3: vrácené publikace mají status rolled_back',
    all.filter((p) => p.status === 'rolled_back').length >= 2,
  )
  check(
    'E4: všechny statusy validní',
    all.every((p) => ['published', 'failed', 'rolled_back'].includes(p.status)),
  )

  // žádný otevřený changeset nesmí zůstat viset
  const { data: open } = await admin
    .from('webdo24_changesets')
    .select('id, status')
    .eq('project_id', PROJECT_ID)
    .in('status', ['draft', 'publishing'])
  check('E5: žádné visící draft/publishing changesety', (open ?? []).length === 0, JSON.stringify(open))
}

async function main() {
  console.log('CCC lifecycle acceptance testy')
  console.log(`Base: ${BASE} | Projekt: ${SLUG}`)

  const { data: project } = await admin
    .from('webdo24_projects')
    .select('id')
    .eq('slug', SLUG)
    .single()
  if (!project) throw new Error('Demo projekt nenalezen')
  PROJECT_ID = project.id

  COOKIE = await loginCookie()
  console.log('✓ Přihlášení OK (session cookie)')

  // sanity: API vyžaduje auth
  const res = await fetch(`${BASE}/api/v1/changesets?projectId=${PROJECT_ID}`)
  check('S0: API bez session → 401', res.status === 401, `HTTP ${res.status}`)

  await testA()
  await testC()
  await testBD()
  await testE()

  console.log(`\n=== Výsledek: ${passed} PASS, ${failed} FAIL ===`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('Test run selhal:', e)
  process.exit(1)
})
