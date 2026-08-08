// ============================================
// CCC – Content Registry  (architektura §3.2, §3.3)
//
// Čtení/zápis Registry s adresací přes field_key. Zákaznická cesta jde
// vždy přes guard (requireProjectCapability), veřejný renderer čte jen
// published data přes getPublicContentMap (bez auth, service-role).
// ============================================

import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjectCapability } from '@/lib/ccc/guard'
import type {
  BrandProfile,
  CompanyProfile,
  ContentField,
  ContentFieldWithValue,
  FieldType,
  FieldValidation,
  Page,
} from '@/types/website-contract'

// --------------------------------------------------------------
// Interní typy pro DB řádky (join fields ↔ values)
// --------------------------------------------------------------

type ContentFieldRow = Omit<ContentField, 'validation'> & {
  validation: FieldValidation | null
}

type ContentValueJoinRow = {
  published_value: unknown | null
  published_at: string | null
} | null

function toFieldWithValue(
  field: ContentFieldRow,
  value: ContentValueJoinRow,
): ContentFieldWithValue {
  return {
    ...field,
    validation: field.validation ?? {},
    published_value: value?.published_value ?? null,
    published_at: value?.published_at ?? null,
  }
}

async function fetchFieldsWithValues(
  projectId: string,
  pageSlug?: string,
): Promise<ContentFieldWithValue[]> {
  const admin = createAdminClient()

  let pageId: string | null = null
  if (pageSlug !== undefined) {
    const { data: page } = await admin
      .from('webdo24_pages')
      .select('id')
      .eq('project_id', projectId)
      .eq('slug', pageSlug)
      .maybeSingle()
    if (!page) return []
    pageId = page.id as string
  }

  let query = admin
    .from('webdo24_content_fields')
    .select('*, webdo24_content_values(published_value, published_at)')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })

  // page slug zadaný → pole stránky + globální pole (page_id IS NULL)
  if (pageId) {
    query = query.or(`page_id.eq.${pageId},page_id.is.null`)
  }

  const { data, error } = await query
  if (error || !data) return []

  type JoinedRow = ContentFieldRow & {
    webdo24_content_values: ContentValueJoinRow | ContentValueJoinRow[]
  }

  return (data as JoinedRow[]).map((row) => {
    const { webdo24_content_values, ...field } = row
    const value = Array.isArray(webdo24_content_values)
      ? (webdo24_content_values[0] ?? null)
      : webdo24_content_values
    return toFieldWithValue(field, value)
  })
}

// --------------------------------------------------------------
// Stránky
// --------------------------------------------------------------

export async function listPages(projectId: string): Promise<Page[]> {
  await requireProjectCapability(projectId, 'view')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('webdo24_pages')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })

  if (error || !data) return []
  return data as Page[]
}

// --------------------------------------------------------------
// Obsah stránky / pole
// --------------------------------------------------------------

export async function getPageContent(
  projectId: string,
  pageSlug: string,
): Promise<{ page: Page | null; fields: ContentFieldWithValue[] }> {
  await requireProjectCapability(projectId, 'view')

  const admin = createAdminClient()
  const { data: page } = await admin
    .from('webdo24_pages')
    .select('*')
    .eq('project_id', projectId)
    .eq('slug', pageSlug)
    .maybeSingle()

  const fields = await fetchFieldsWithValues(projectId, pageSlug)
  return { page: (page as Page | null) ?? null, fields }
}

export async function getFieldByKey(
  projectId: string,
  fieldKey: string,
): Promise<ContentFieldWithValue | null> {
  await requireProjectCapability(projectId, 'view')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('webdo24_content_fields')
    .select('*, webdo24_content_values(published_value, published_at)')
    .eq('project_id', projectId)
    .eq('field_key', fieldKey)
    .maybeSingle()

  if (error || !data) return null

  const { webdo24_content_values, ...field } = data as ContentFieldRow & {
    webdo24_content_values: ContentValueJoinRow | ContentValueJoinRow[]
  }
  const value = Array.isArray(webdo24_content_values)
    ? (webdo24_content_values[0] ?? null)
    : webdo24_content_values
  return toFieldWithValue(field, value)
}

// --------------------------------------------------------------
// Zápis definic polí (migrace/seedy – service role, bez guardu;
// volají ho důvěryhodné serverové procesy, ne zákaznické UI)
// --------------------------------------------------------------

export interface ContentFieldInput {
  field_key: string
  field_type: FieldType
  label: string
  page_id?: string | null
  section_key?: string | null
  validation?: FieldValidation
  sort_order?: number
  schema_version?: number
}

export async function upsertContentFields(
  projectId: string,
  customerId: string,
  fields: ContentFieldInput[],
): Promise<{ upserted: number }> {
  if (fields.length === 0) return { upserted: 0 }

  const admin = createAdminClient()
  const rows = fields.map((f) => ({
    project_id: projectId,
    customer_id: customerId,
    page_id: f.page_id ?? null,
    field_key: f.field_key,
    section_key: f.section_key ?? null,
    field_type: f.field_type,
    label: f.label,
    validation: f.validation ?? {},
    sort_order: f.sort_order ?? 0,
    schema_version: f.schema_version ?? 1,
  }))

  const { error } = await admin
    .from('webdo24_content_fields')
    .upsert(rows, { onConflict: 'project_id,field_key' })

  if (error) throw new Error(`upsert_content_fields_failed: ${error.message}`)
  return { upserted: rows.length }
}

// --------------------------------------------------------------
// Globální profily  (§3.3)
// --------------------------------------------------------------

export async function getCompanyProfile(
  projectId: string,
): Promise<CompanyProfile | null> {
  await requireProjectCapability(projectId, 'view')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('webdo24_company_profiles')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error || !data) return null
  return data as CompanyProfile
}

export async function getBrandProfile(
  projectId: string,
): Promise<BrandProfile | null> {
  await requireProjectCapability(projectId, 'view')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('webdo24_brand_profiles')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error || !data) return null
  return data as BrandProfile
}

// --------------------------------------------------------------
// Plochá mapa published hodnot pro renderer
// --------------------------------------------------------------

/** Plochá mapa field_key → published hodnota (pro renderer i snapshoty verzí). */
export type ContentMap = Record<string, unknown>

/**
 * Whitelist sloupců profilů promítaných do company.* / branding.* klíčů.
 * Exportované – publish.ts je používá pro mapování ChangeSet itemů
 * (company.phone → sloupec phone) a zároveň jako ochranu proti zápisu
 * do libovolného sloupce přes field_key.
 */
export const COMPANY_MAP_COLUMNS = [
  'company_name', 'ico', 'dic', 'street', 'city', 'postal_code', 'country',
  'email', 'phone', 'secondary_phone', 'facebook', 'instagram', 'linkedin',
  'youtube', 'opening_hours', 'google_maps_url',
] as const

export const BRAND_MAP_COLUMNS = [
  'logo_asset_id', 'logo_light_asset_id', 'logo_dark_asset_id',
  'favicon_asset_id', 'icon_asset_id', 'primary_color', 'secondary_color',
] as const

function profileToEntries(
  prefix: 'company' | 'branding',
  profile: Record<string, unknown> | null,
  columns: readonly string[],
): Array<[string, unknown]> {
  if (!profile) return []
  return columns
    .filter((col) => profile[col] !== null && profile[col] !== undefined)
    .map((col) => [`${prefix}.${col}`, profile[col]])
}

/**
 * Sestaví plochou mapu field_key → published hodnota pro daný projekt.
 * Interní sdílená implementace – NEexportovat přímo; venku jsou
 * getPublishedContentMap (auth) a getPublicContentMap (public renderer).
 *
 * Přednost: profilové tabulky (company.*, branding.*) jsou základ,
 * Registry hodnoty je překryjí – Registry je kanonický model spravovaný
 * ChangeSety (§3.2).
 */
async function buildContentMap(projectId: string): Promise<ContentMap> {
  const admin = createAdminClient()

  const [fields, { data: company }, { data: brand }] = await Promise.all([
    fetchFieldsWithValues(projectId),
    admin
      .from('webdo24_company_profiles')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle(),
    admin
      .from('webdo24_brand_profiles')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle(),
  ])

  const map: ContentMap = {}

  for (const [key, value] of profileToEntries(
    'company',
    (company as Record<string, unknown> | null) ?? null,
    COMPANY_MAP_COLUMNS,
  )) {
    map[key] = value
  }
  for (const [key, value] of profileToEntries(
    'branding',
    (brand as Record<string, unknown> | null) ?? null,
    BRAND_MAP_COLUMNS,
  )) {
    map[key] = value
  }

  for (const field of fields) {
    if (field.published_value !== null && field.published_value !== undefined) {
      map[field.field_key] = field.published_value
    }
  }

  return map
}

/**
 * Zákaznická cesta: published mapa po ověření 'view' capability.
 */
export async function getPublishedContentMap(
  projectId: string,
): Promise<ContentMap> {
  await requireProjectCapability(projectId, 'view')
  return buildContentMap(projectId)
}

/**
 * Veřejný renderer (web.webdo24.cz/{slug}): NEVYŽADUJE auth. Čte přes
 * service role, ale vrací výhradně published data (draft žije jen
 * v changeset_items a sem se nikdy nedostane – §22).
 */
export async function getPublicContentMap(
  projectSlug: string,
): Promise<ContentMap | null> {
  const admin = createAdminClient()
  const { data: project, error } = await admin
    .from('webdo24_projects')
    .select('id')
    .eq('slug', projectSlug)
    .maybeSingle()

  if (error || !project) return null
  return buildContentMap(project.id as string)
}
