// ============================================
// CCC – ChangeSet engine: CRUD  (architektura §3.4, §2.2)
//
// Jediná cesta do produkce: GUI / AI / WebDo24 → ChangeSet(DRAFT) →
// validate → preview → approve → publish → verify. Tento modul pokrývá
// vytvoření, čtení (diff) a zrušení draftu. Přechody za 'draft'
// (validateChangeSet, requestPreview, approveChangeSet, publishChangeSet,
// rollbackPublication) implementuje Phase 2 v src/lib/ccc/preview.ts a
// src/lib/ccc/publish.ts – podpisy jsou navržené tak, aby na tento CRUD
// navazovaly (§5.2).
//
// Každá mutační funkce nejdřív requireCapability('edit'). Zápisy jdou přes
// service role (changeset_items jsou pro zákazníka SELECT-only).
// ============================================

import { createAdminClient } from '@/lib/supabase/admin'
import { GuardError, requireCapability, requireProjectCapability } from '@/lib/ccc/guard'
import type {
  ChangeSet,
  ChangeSetItem,
  ChangeSetItemType,
  ChangeSetItemWithField,
  ChangeSetSource,
  ChangeSetStatus,
  ChangeSetWithItems,
  FieldType,
} from '@/types/website-contract'

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/** Odvodí item_type z field_key / typu pole (§3.4). */
function inferItemType(fieldKey: string, fieldType: FieldType): ChangeSetItemType {
  if (fieldKey.startsWith('company.')) return 'company'
  if (fieldKey.startsWith('branding.')) return 'branding'
  if (fieldKey === 'seo' || fieldKey.startsWith('seo.') || fieldKey.includes('.seo')) {
    return 'seo'
  }
  if (['image', 'gallery', 'logo', 'video', 'file'].includes(fieldType)) return 'media'
  return 'content'
}

type FieldRow = {
  id: string
  field_key: string
  label: string
  field_type: FieldType
  webdo24_content_values:
    | { published_value: unknown | null }
    | { published_value: unknown | null }[]
    | null
}

function joinedValue(row: FieldRow): unknown | null {
  const v = row.webdo24_content_values
  const single = Array.isArray(v) ? (v[0] ?? null) : v
  return single?.published_value ?? null
}

type ItemJoinRow = ChangeSetItem & {
  webdo24_content_fields: {
    field_key: string
    label: string
    field_type: FieldType
  } | null
}

function toItemWithField(row: ItemJoinRow): ChangeSetItemWithField {
  const { webdo24_content_fields, ...item } = row
  return {
    ...item,
    field_key: webdo24_content_fields?.field_key ?? '',
    field_label: webdo24_content_fields?.label ?? '',
    field_type: webdo24_content_fields?.field_type ?? 'text',
  }
}

// --------------------------------------------------------------
// CREATE
// --------------------------------------------------------------

export interface CreateChangeSetItemInput {
  fieldKey: string
  newValue: unknown
}

export interface CreateChangeSetInput {
  projectId: string
  title: string
  items: CreateChangeSetItemInput[]
  source: ChangeSetSource
}

/**
 * Vytvoří ChangeSet ve stavu 'draft': přeloží field_key → field_id,
 * snapshotne old_value z published_value a vloží changeset + items jako
 * jednu logickou operaci (items bez changesetu nemají smysl; při chybě
 * insertu items se changeset smaže, dokud neexistuje DB transakce přes
 * PostgREST – Phase 2 může přejít na RPC).
 */
export async function createChangeSet(
  input: CreateChangeSetInput,
): Promise<ChangeSetWithItems> {
  const ctx = await requireProjectCapability(input.projectId, 'edit')

  const title = input.title.trim()
  if (!title) throw new GuardError('forbidden', 'Chybí název změny')
  if (input.items.length === 0) {
    throw new GuardError('forbidden', 'ChangeSet musí obsahovat alespoň jednu změnu')
  }

  const admin = createAdminClient()

  // 1. resolve field_key → field (včetně snapshotu published hodnoty)
  const fieldKeys = [...new Set(input.items.map((i) => i.fieldKey))]
  const { data: fieldRows, error: fieldsError } = await admin
    .from('webdo24_content_fields')
    .select('id, field_key, label, field_type, webdo24_content_values(published_value)')
    .eq('project_id', input.projectId)
    .in('field_key', fieldKeys)

  if (fieldsError) throw new Error(`resolve_fields_failed: ${fieldsError.message}`)

  const fieldsByKey = new Map((fieldRows as FieldRow[] | null)?.map((f) => [f.field_key, f]) ?? [])
  const unknown = fieldKeys.filter((k) => !fieldsByKey.has(k))
  if (unknown.length > 0) {
    throw new GuardError('not_found', `Neznámá pole: ${unknown.join(', ')}`)
  }

  // 2. changeset
  const { data: changeset, error: csError } = await admin
    .from('webdo24_changesets')
    .insert({
      project_id: input.projectId,
      customer_id: ctx.customerId,
      title,
      status: 'draft',
      source: input.source,
      created_by: ctx.userId,
    })
    .select('*')
    .single()

  if (csError || !changeset) {
    throw new Error(`create_changeset_failed: ${csError?.message ?? 'unknown'}`)
  }

  // 3. items (old_value = snapshot published_value při vytvoření)
  const itemRows = input.items.map((item) => {
    const field = fieldsByKey.get(item.fieldKey)!
    return {
      changeset_id: changeset.id as string,
      field_id: field.id,
      old_value: joinedValue(field),
      new_value: item.newValue,
      item_type: inferItemType(item.fieldKey, field.field_type),
    }
  })

  const { data: items, error: itemsError } = await admin
    .from('webdo24_changeset_items')
    .insert(itemRows)
    .select('*')

  if (itemsError) {
    // kompenzace – draft bez items nesmí zůstat viset
    await admin.from('webdo24_changesets').delete().eq('id', changeset.id)
    throw new Error(`create_changeset_items_failed: ${itemsError.message}`)
  }

  // 4. audit (vzor z src/lib/actions/changes.ts)
  await admin.from('webdo24_audit_log').insert({
    user_id: ctx.userId,
    customer_id: ctx.customerId,
    project_id: input.projectId,
    action: 'CHANGESET_CREATED',
    entity: 'changeset',
    entity_id: changeset.id,
    diff: {
      title,
      source: input.source,
      items: input.items.map((i) => ({ field_key: i.fieldKey })),
    },
  })

  const fieldMetaByKey = new Map(
    (fieldRows as FieldRow[] | null)?.map((f) => [f.id, f]) ?? [],
  )

  return {
    ...(changeset as ChangeSet),
    items: ((items as ChangeSetItem[] | null) ?? []).map((item) => {
      const field = fieldMetaByKey.get(item.field_id)
      return {
        ...item,
        field_key: field?.field_key ?? '',
        field_label: field?.label ?? '',
        field_type: field?.field_type ?? 'text',
      }
    }),
  }
}

// --------------------------------------------------------------
// LIST / GET (diff UI)
// --------------------------------------------------------------

export async function listChangeSets(
  projectId: string,
  limit = 50,
): Promise<ChangeSet[]> {
  await requireProjectCapability(projectId, 'view')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('webdo24_changesets')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data as ChangeSet[]
}

/**
 * Detail ChangeSetu včetně itemů joinutých s field_key / label / typ
 * (pro diff UI „Původní | Nový“).
 */
export async function getChangeSet(id: string): Promise<ChangeSetWithItems | null> {
  const admin = createAdminClient()
  const { data: changeset, error } = await admin
    .from('webdo24_changesets')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !changeset) return null

  await requireCapability(changeset.customer_id as string, 'view')

  const { data: items, error: itemsError } = await admin
    .from('webdo24_changeset_items')
    .select('*, webdo24_content_fields(field_key, label, field_type)')
    .eq('changeset_id', id)
    .order('created_at', { ascending: true })

  if (itemsError) throw new Error(`load_changeset_items_failed: ${itemsError.message}`)

  return {
    ...(changeset as ChangeSet),
    items: ((items as ItemJoinRow[] | null) ?? []).map(toItemWithField),
  }
}

// --------------------------------------------------------------
// CANCEL  (jen z draft/validated/preview_ready – §3.4 stavový automat)
// --------------------------------------------------------------

const CANCELLABLE_STATUSES: readonly ChangeSetStatus[] = [
  'draft',
  'validated',
  'preview_ready',
]

export async function cancelChangeSet(id: string): Promise<{ ok: true }> {
  const admin = createAdminClient()
  const { data: changeset, error } = await admin
    .from('webdo24_changesets')
    .select('id, project_id, customer_id, status')
    .eq('id', id)
    .maybeSingle()

  if (error || !changeset) throw new GuardError('not_found', 'ChangeSet nenalezen')

  const ctx = await requireCapability(changeset.customer_id as string, 'edit')

  const status = changeset.status as ChangeSetStatus
  if (!CANCELLABLE_STATUSES.includes(status)) {
    throw new GuardError('forbidden', `ChangeSet ve stavu '${status}' nelze zrušit`)
  }

  const { error: updateError } = await admin
    .from('webdo24_changesets')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (updateError) throw new Error(`cancel_changeset_failed: ${updateError.message}`)

  await admin.from('webdo24_audit_log').insert({
    user_id: ctx.userId,
    customer_id: ctx.customerId,
    project_id: changeset.project_id,
    action: 'CHANGESET_CANCELLED',
    entity: 'changeset',
    entity_id: id,
    diff: { previous_status: status },
  })

  return { ok: true }
}
