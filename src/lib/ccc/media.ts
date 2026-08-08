// ============================================
// CCC – Media Library  (architektura §7, §3.5)
//
// uploadMediaAsset:   guard 'edit', MIME whitelist, magic bytes, 10 MB,
//                     sanitizace filename, storage path per customer/project
// listMediaAssets:    guard 'view'
// getMediaAssetUsage: kde je asset použitý (published + draft, §9)
// getAssetUrlVariants: Supabase Image Transformations URL (fallback original)
//
// SVG je v V1 BLOKOVANÉ (§8.5): může obsahovat <script> a bucket je
// veřejný → stored XSS na zákaznickém webu. Sanitizace se může doplnit
// později (DOMPurify server-side), do té doby svg odmítáme.
// ============================================

import { createAdminClient } from '@/lib/supabase/admin'
import { GuardError, requireCapability, requireProjectCapability } from '@/lib/ccc/guard'
import type { MediaAsset, MediaCategory } from '@/types/website-contract'

const BUCKET = 'webdo24-files' // stávající bucket (vzor: src/app/api/upload/route.ts)
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB (§7)

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number]

const EXT_BY_MIME: Record<AllowedMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/** Magic bytes kontrola (§7) – nestačí věřit Content-Type hlavičce. */
function sniffMime(bytes: Uint8Array): AllowedMime | null {
  const is = (...hex: number[]) =>
    hex.every((b, i) => bytes.length > i && bytes[i] === b)

  if (is(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (is(0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  // RIFF....WEBP
  if (
    is(0x52, 0x49, 0x46, 0x46) &&
    bytes.length > 11 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (is(0x25, 0x50, 0x44, 0x46)) return 'application/pdf' // %PDF
  return null
}

/** ASCII-only, lowercase, bezpečný název souboru pro storage path. */
function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file'
  const cleaned = base
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // diakritika
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return (cleaned || 'file').slice(0, 120)
}

// --------------------------------------------------------------
// UPLOAD
// --------------------------------------------------------------

export interface UploadMediaInput {
  projectId: string
  file: File
  category?: MediaCategory
  altText?: string
}

export async function uploadMediaAsset(input: UploadMediaInput): Promise<MediaAsset> {
  const ctx = await requireProjectCapability(input.projectId, 'edit')

  const { file } = input
  if (!file || file.size === 0) throw new GuardError('forbidden', 'Chybí soubor')
  if (file.size > MAX_FILE_SIZE) {
    throw new GuardError('forbidden', 'Soubor je větší než 10 MB')
  }

  const declaredMime = file.type.toLowerCase()
  // SVG úmyslně není ve whitelistu (XSS – viz hlavička)
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(declaredMime)) {
    throw new GuardError(
      'forbidden',
      `Nepodporovaný typ souboru (${declaredMime || 'neznámý'}); povolené: JPEG, PNG, WebP, PDF`,
    )
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const sniffed = sniffMime(bytes.subarray(0, 16))
  if (!sniffed || sniffed !== declaredMime) {
    throw new GuardError('forbidden', 'Obsah souboru neodpovídá deklarovanému typu')
  }

  const admin = createAdminClient()

  // asset id dopředu – je součástí storage path (§3.5)
  const assetId = crypto.randomUUID()
  const ext = EXT_BY_MIME[sniffed]
  const filename = sanitizeFilename(file.name)
  const storagePath = `${ctx.customerId}/${input.projectId}/${assetId}/original.${ext}`

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: sniffed, upsert: false })
  if (uploadError) throw new Error(`storage_upload_failed: ${uploadError.message}`)

  const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(storagePath)

  const { data: asset, error: dbError } = await admin
    .from('webdo24_media_assets')
    .insert({
      id: assetId,
      customer_id: ctx.customerId,
      project_id: input.projectId,
      category: input.category ?? 'photo',
      filename,
      mime_type: sniffed,
      storage_path: storagePath,
      original_url: publicUrl.publicUrl,
      alt_text: input.altText ?? null,
      source: 'upload',
      created_by: ctx.userId,
    })
    .select('*')
    .single()

  if (dbError || !asset) {
    // kompenzace – soubor ve storage bez DB záznamu nemá viset
    await admin.storage.from(BUCKET).remove([storagePath])
    throw new Error(`create_asset_failed: ${dbError?.message ?? 'unknown'}`)
  }

  await admin.from('webdo24_audit_log').insert({
    user_id: ctx.userId,
    customer_id: ctx.customerId,
    project_id: input.projectId,
    action: 'MEDIA_UPLOADED',
    entity: 'media_asset',
    entity_id: assetId,
    diff: { filename, mime_type: sniffed, size: file.size },
  })

  return asset as MediaAsset
}

// --------------------------------------------------------------
// LIST
// --------------------------------------------------------------

export async function listMediaAssets(
  projectId: string,
  category?: MediaCategory,
): Promise<MediaAsset[]> {
  await requireProjectCapability(projectId, 'view')

  const admin = createAdminClient()
  let query = admin
    .from('webdo24_media_assets')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error || !data) return []
  return data as MediaAsset[]
}

// --------------------------------------------------------------
// UPDATE ALT TEXT  (Phase 3 – detail assetu v Media Library)
// --------------------------------------------------------------

export async function updateMediaAssetAlt(
  assetId: string,
  altText: string,
): Promise<{ ok: true }> {
  const admin = createAdminClient()
  const { data: asset, error } = await admin
    .from('webdo24_media_assets')
    .select('id, customer_id')
    .eq('id', assetId)
    .maybeSingle()

  if (error || !asset) throw new GuardError('not_found', 'Asset nenalezen')
  await requireCapability(asset.customer_id as string, 'edit')

  const { error: updateError } = await admin
    .from('webdo24_media_assets')
    .update({ alt_text: altText || null })
    .eq('id', assetId)
  if (updateError) throw new Error(`update_alt_failed: ${updateError.message}`)

  return { ok: true }
}

// --------------------------------------------------------------
// USAGE  (§9: "kde je asset použitý" – published + draft)
// --------------------------------------------------------------

export interface MediaUsageEntry {
  field_key: string
  label: string
  location: 'published' | 'draft'
  changeset_id: string | null
}

async function fieldMetaByIds(
  fieldIds: string[],
): Promise<Map<string, { field_key: string; label: string }>> {
  if (fieldIds.length === 0) return new Map()
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_content_fields')
    .select('id, field_key, label')
    .in('id', fieldIds)

  return new Map(
    ((data as Array<{ id: string; field_key: string; label: string }> | null) ?? []).map(
      (f) => [f.id, { field_key: f.field_key, label: f.label }],
    ),
  )
}

export async function getMediaAssetUsage(assetId: string): Promise<MediaUsageEntry[]> {
  const admin = createAdminClient()

  const { data: asset, error } = await admin
    .from('webdo24_media_assets')
    .select('id, customer_id')
    .eq('id', assetId)
    .maybeSingle()

  if (error || !asset) throw new GuardError('not_found', 'Asset nenalezen')
  await requireCapability(asset.customer_id as string, 'view')

  const usage: MediaUsageEntry[] = []

  // published použití: skalár {asset_id} (expression index §3.5) i gallery pole
  const [{ data: scalarHits }, { data: arrayHits }] = await Promise.all([
    admin
      .from('webdo24_content_values')
      .select('field_id')
      .eq('published_value->>asset_id', assetId),
    admin
      .from('webdo24_content_values')
      .select('field_id')
      .contains('published_value', [{ asset_id: assetId }]),
  ])

  const publishedFieldIds = [
    ...new Set([
      ...((scalarHits as Array<{ field_id: string }> | null) ?? []).map((r) => r.field_id),
      ...((arrayHits as Array<{ field_id: string }> | null) ?? []).map((r) => r.field_id),
    ]),
  ]

  const publishedMeta = await fieldMetaByIds(publishedFieldIds)
  for (const meta of publishedMeta.values()) {
    usage.push({
      field_key: meta.field_key,
      label: meta.label,
      location: 'published',
      changeset_id: null,
    })
  }

  // draft použití: changeset_items.new_value (jen otevřené changesety)
  const [{ data: draftScalar }, { data: draftArray }] = await Promise.all([
    admin
      .from('webdo24_changeset_items')
      .select('changeset_id, field_id, webdo24_changesets!inner(status)')
      .eq('new_value->>asset_id', assetId)
      .in('webdo24_changesets.status', ['draft', 'validated', 'preview_ready', 'approved']),
    admin
      .from('webdo24_changeset_items')
      .select('changeset_id, field_id, webdo24_changesets!inner(status)')
      .contains('new_value', [{ asset_id: assetId }])
      .in('webdo24_changesets.status', ['draft', 'validated', 'preview_ready', 'approved']),
  ])

  const draftRows = [
    ...((draftScalar as Array<{ changeset_id: string; field_id: string }> | null) ?? []),
    ...((draftArray as Array<{ changeset_id: string; field_id: string }> | null) ?? []),
  ]
  const draftMeta = await fieldMetaByIds([...new Set(draftRows.map((r) => r.field_id))])
  const seen = new Set<string>()
  for (const row of draftRows) {
    const key = `${row.changeset_id}:${row.field_id}`
    if (seen.has(key)) continue
    seen.add(key)
    const meta = draftMeta.get(row.field_id) ?? null
    usage.push({
      field_key: meta?.field_key ?? '',
      label: meta?.label ?? '',
      location: 'draft',
      changeset_id: row.changeset_id,
    })
  }

  return usage
}

// --------------------------------------------------------------
// URL VARIANTY  (§7 – Supabase Image Transformations)
// --------------------------------------------------------------

export interface AssetUrlVariants {
  original_url: string
  optimized_url: string
  thumbnail_url: string
}

/**
 * Optimized/thumbnail URL přes Supabase Image Transformations
 * (render/image endpoint). Transformace se generují on-the-fly, nic se
 * nepředpočítává (§7 V1). Pro ne-obrázky (PDF) nebo když transforms
 * nejsou na projektu zapnuté, je bezpečný fallback original_url –
 * renderer vždy může číst original.
 */
export function getAssetUrlVariants(asset: MediaAsset): AssetUrlVariants {
  if (!asset.mime_type.startsWith('image/')) {
    return {
      original_url: asset.original_url,
      optimized_url: asset.original_url,
      thumbnail_url: asset.original_url,
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    return {
      original_url: asset.original_url,
      optimized_url: asset.optimized_url ?? asset.original_url,
      thumbnail_url: asset.thumbnail_url ?? asset.original_url,
    }
  }

  const render = `${supabaseUrl}/storage/v1/render/image/public/${BUCKET}/${asset.storage_path}`
  return {
    original_url: asset.original_url,
    optimized_url: `${render}?width=1600&format=webp&quality=80`,
    thumbnail_url: `${render}?width=400&format=webp&quality=75`,
  }
}
