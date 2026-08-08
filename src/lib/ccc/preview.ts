// ============================================
// CCC – Preview workflow  (architektura §6)
//
// requestPreview: validace itemů → draft → validated → preview_ready →
// HMAC signed token (24h expiry) → preview URL pro veřejný renderer.
// verifyPreviewToken: čisté HMAC ověření BEZ auth – volá ho veřejný
// renderer (Phase 4) při ?__wd24_cs=…&__wd24_preview=…&__wd24_exp=…
//
// Validace je ruční validátor nad content_fields.validation (jsonb z DB),
// NE zod: pravidla přicházejí z databáze jako data, takže zod schema by
// se muselo generovat dynamicky – ruční průchod pravidly je přímější,
// typově bezpečný a bez nových dependencies.
//
// Token je stateless: HMAC(`${changesetId}:${projectId}:${expiryMs}`),
// expiry je součástí payloadu i URL → není potřeba nic ukládat do DB
// (proto changesets nemá preview sloupce – záměr, ne opomenutí).
// ============================================

import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { GuardError, requireCapability } from '@/lib/ccc/guard'
import type {
  ChangeSet,
  ChangeSetItem,
  ChangeSetStatus,
  FieldType,
  FieldValidation,
} from '@/types/website-contract'

const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000 // 24 h (§6)

// --------------------------------------------------------------
// Validace itemů
// --------------------------------------------------------------

export interface ItemValidationError {
  field_key: string
  label: string
  message: string
}

/** Typovaná chyba validace – route handlery ji mapují na HTTP 422. */
export class ValidationError extends Error {
  constructor(public readonly errors: ItemValidationError[]) {
    super(`Validace selhala (${errors.length}×)`)
    this.name = 'ValidationError'
  }
}

/** Item joinutý s metadaty pole potřebnými pro validaci/publish. */
export interface ValidatedItem extends ChangeSetItem {
  field_key: string
  field_label: string
  field_type: FieldType
  field_validation: FieldValidation
}

type ItemValidationRow = ChangeSetItem & {
  webdo24_content_fields: {
    field_key: string
    label: string
    field_type: FieldType
    validation: FieldValidation | null
  } | null
}

const URL_RE = /^https?:\/\/.+/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9\s\-()]{6,20}$/
const COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Ověří new_value jednoho itemu proti typu pole a validation jsonb.
 * Vrací seznam chyb (česky, pro diff/validační UI); prázdný = OK.
 */
export function validateFieldValue(
  field: {
    field_key: string
    label: string
    field_type: FieldType
    validation: FieldValidation
  },
  value: unknown,
): ItemValidationError[] {
  const errors: ItemValidationError[] = []
  const fail = (message: string) =>
    errors.push({ field_key: field.field_key, label: field.label, message })

  const isEmpty =
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')

  if (field.validation.required && isEmpty) {
    fail('Pole je povinné')
    return errors
  }
  if (isEmpty) return errors // nepovinné prázdné pole je OK

  // Typová kontrola dle field_type
  switch (field.field_type) {
    case 'text':
    case 'textarea':
    case 'rich_text':
      if (typeof value !== 'string') fail('Hodnota musí být text')
      break
    case 'number':
      if (typeof value !== 'number' && !(typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)))) {
        fail('Hodnota musí být číslo')
      }
      break
    case 'boolean':
      if (typeof value !== 'boolean') fail('Hodnota musí být ano/ne')
      break
    case 'url':
      if (typeof value !== 'string' || !URL_RE.test(value)) {
        fail('Hodnota musí být platná URL (https://…)')
      }
      break
    case 'email':
      if (typeof value !== 'string' || !EMAIL_RE.test(value)) {
        fail('Hodnota musí být platný e-mail')
      }
      break
    case 'phone':
      if (typeof value !== 'string' || !PHONE_RE.test(value)) {
        fail('Hodnota musí být platné telefonní číslo')
      }
      break
    case 'color':
      if (typeof value !== 'string' || !COLOR_RE.test(value)) {
        fail('Hodnota musí být barva ve formátu #RRGGBB')
      }
      break
    case 'select':
      if (
        field.validation.options &&
        field.validation.options.length > 0 &&
        (typeof value !== 'string' || !field.validation.options.includes(value))
      ) {
        fail(`Hodnota musí být jedna z: ${field.validation.options.join(', ')}`)
      }
      break
    case 'image':
    case 'logo':
      if (!isRecord(value) || typeof value.asset_id !== 'string') {
        fail('Hodnota musí být objekt s asset_id (Media Library)')
      }
      break
    case 'gallery':
      if (
        !Array.isArray(value) ||
        value.some((v) => !isRecord(v) || typeof v.asset_id !== 'string')
      ) {
        fail('Hodnota musí být pole objektů s asset_id')
      }
      break
    case 'video':
    case 'file':
      if (
        !(isRecord(value) && (typeof value.asset_id === 'string' || typeof value.url === 'string'))
      ) {
        fail('Hodnota musí být objekt s asset_id nebo url')
      }
      break
    case 'cta':
      if (!isRecord(value)) fail('Hodnota musí být objekt (label, url)')
      break
    case 'repeater':
      if (!Array.isArray(value)) fail('Hodnota musí být pole položek')
      break
  }

  // Obecná pravidla z validation jsonb (jen pro textové hodnoty)
  if (typeof value === 'string') {
    if (
      field.validation.max_length !== undefined &&
      value.length > field.validation.max_length
    ) {
      fail(`Maximální délka je ${field.validation.max_length} znaků`)
    }
    if (field.validation.pattern) {
      try {
        if (!new RegExp(field.validation.pattern).test(value)) {
          fail('Hodnota neodpovídá požadovanému formátu')
        }
      } catch {
        // nevalidní regex v DB – validaci přeskočit, neblokovat publish
      }
    }
  }

  return errors
}

/**
 * Načte changeset + items s metadaty polí a zvaliduje všechny new_value.
 * Interní sdílená implementace pro requestPreview i publishChangeSet
 * (re-validace před aplikací, §5.2 krok 3). NEexportuje auth – autorizaci
 * si řeší volající.
 */
export async function loadAndValidateChangeSet(
  changesetId: string,
): Promise<{
  changeset: ChangeSet
  items: ValidatedItem[]
  errors: ItemValidationError[]
}> {
  const admin = createAdminClient()

  const { data: changeset, error } = await admin
    .from('webdo24_changesets')
    .select('*')
    .eq('id', changesetId)
    .maybeSingle()

  if (error || !changeset) throw new GuardError('not_found', 'ChangeSet nenalezen')

  const { data: itemRows, error: itemsError } = await admin
    .from('webdo24_changeset_items')
    .select('*, webdo24_content_fields(field_key, label, field_type, validation)')
    .eq('changeset_id', changesetId)

  if (itemsError) throw new Error(`load_changeset_items_failed: ${itemsError.message}`)

  const items: ValidatedItem[] = ((itemRows as ItemValidationRow[] | null) ?? []).map(
    (row) => {
      const { webdo24_content_fields, ...item } = row
      return {
        ...item,
        field_key: webdo24_content_fields?.field_key ?? '',
        field_label: webdo24_content_fields?.label ?? '',
        field_type: webdo24_content_fields?.field_type ?? 'text',
        field_validation: webdo24_content_fields?.validation ?? {},
      }
    },
  )

  const errors = items.flatMap((item) =>
    validateFieldValue(
      {
        field_key: item.field_key,
        label: item.field_label,
        field_type: item.field_type,
        validation: item.field_validation,
      },
      item.new_value,
    ),
  )

  return { changeset: changeset as ChangeSet, items, errors }
}

// --------------------------------------------------------------
// HMAC tokeny  (§6 krok 1)
// --------------------------------------------------------------

function getPreviewSecret(): string {
  const secret = process.env.PREVIEW_TOKEN_SECRET
  if (!secret) {
    throw new Error('missing_preview_token_secret: doplň PREVIEW_TOKEN_SECRET do env')
  }
  return secret
}

function computePreviewToken(
  changesetId: string,
  projectId: string,
  expiryMs: number,
): string {
  return createHmac('sha256', getPreviewSecret())
    .update(`${changesetId}:${projectId}:${expiryMs}`)
    .digest('hex')
}

export interface PreviewResult {
  changesetId: string
  status: ChangeSetStatus
  previewUrl: string
  expiresAt: string
}

/**
 * POST /api/v1/changesets/{id}/preview:
 * validace všech itemů → status draft → validated → preview_ready →
 * preview URL s HMAC tokenem (expiry 24h).
 */
export async function requestPreview(changesetId: string): Promise<PreviewResult> {
  const { changeset, errors } = await loadAndValidateChangeSet(changesetId)

  const ctx = await requireCapability(changeset.customer_id, 'edit')

  const status = changeset.status
  if (status !== 'draft' && status !== 'validated') {
    throw new GuardError(
      'forbidden',
      `Preview lze vytvořit jen ze stavu draft/validated (aktuálně '${status}')`,
    )
  }

  if (errors.length > 0) throw new ValidationError(errors)

  const admin = createAdminClient()

  // stavový automat §4: draft → validated → preview_ready
  const { error: validatedError } = await admin
    .from('webdo24_changesets')
    .update({ status: 'validated' })
    .eq('id', changesetId)
  if (validatedError) throw new Error(`validate_failed: ${validatedError.message}`)

  const expiryMs = Date.now() + PREVIEW_TTL_MS
  const token = computePreviewToken(changesetId, changeset.project_id, expiryMs)

  const { error: readyError } = await admin
    .from('webdo24_changesets')
    .update({ status: 'preview_ready' })
    .eq('id', changesetId)
  if (readyError) throw new Error(`preview_ready_failed: ${readyError.message}`)

  // slug projektu pro preview URL
  const { data: project } = await admin
    .from('webdo24_projects')
    .select('slug')
    .eq('id', changeset.project_id)
    .single()

  const baseUrl = process.env.APP_PUBLIC_URL ?? 'https://web.webdo24.cz'
  const slug = (project?.slug as string | null) ?? ''
  const previewUrl =
    `${baseUrl}/${slug}?__wd24_cs=${changesetId}` +
    `&__wd24_preview=${token}&__wd24_exp=${expiryMs}`

  await admin.from('webdo24_audit_log').insert({
    user_id: ctx.userId,
    customer_id: ctx.customerId,
    project_id: changeset.project_id,
    action: 'CHANGESET_PREVIEW',
    entity: 'changeset',
    entity_id: changesetId,
    diff: { expires_at: new Date(expiryMs).toISOString() },
  })

  return {
    changesetId,
    status: 'preview_ready',
    previewUrl,
    expiresAt: new Date(expiryMs).toISOString(),
  }
}

/**
 * Ověří preview token – BEZ auth, čistě HMAC + expiry (volá veřejný
 * renderer v Phase 4). Časově bezpečné porovnání.
 */
export async function verifyPreviewToken(
  changesetId: string,
  token: string,
  expiry: string,
): Promise<boolean> {
  const expiryMs = Number(expiry)
  if (!Number.isFinite(expiryMs) || expiryMs < Date.now()) return false

  let secret: string
  try {
    secret = getPreviewSecret()
  } catch {
    return false // bez secretu nelze ověřit – preview vypnuté
  }

  // project_id je součást HMAC payloadu → dotáhnout z DB (service role,
  // bez auth – výstup je jen ano/ne, žádná data neunikají)
  const admin = createAdminClient()
  const { data: changeset } = await admin
    .from('webdo24_changesets')
    .select('project_id, status')
    .eq('id', changesetId)
    .maybeSingle()

  if (!changeset) return false

  // preview dává smysl jen před publish (§6: ověří status changesetu)
  const previewable: readonly ChangeSetStatus[] = [
    'preview_ready',
    'approved',
    'publishing',
  ]
  if (!previewable.includes(changeset.status as ChangeSetStatus)) return false

  const expected = createHmac('sha256', secret)
    .update(`${changesetId}:${changeset.project_id}:${expiryMs}`)
    .digest('hex')

  const a = Buffer.from(token, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Draft overlay data pro renderer (§6 krok 2): field_key → new_value
 * z changeset_items. BEZ auth – renderer ji volá až PO úspěšném
 * verifyPreviewToken. Nikdy nevrací nic mimo daný changeset.
 */
export async function getChangeSetDraftMap(
  changesetId: string,
): Promise<Record<string, unknown>> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('webdo24_changeset_items')
    .select('new_value, webdo24_content_fields(field_key)')
    .eq('changeset_id', changesetId)

  if (error || !data) return {}

  const map: Record<string, unknown> = {}
  for (const row of data as Array<{
    new_value: unknown
    webdo24_content_fields: { field_key: string } | { field_key: string }[] | null
  }>) {
    const field = Array.isArray(row.webdo24_content_fields)
      ? row.webdo24_content_fields[0]
      : row.webdo24_content_fields
    if (field?.field_key) map[field.field_key] = row.new_value
  }
  return map
}
