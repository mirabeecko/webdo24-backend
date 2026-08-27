// ============================================
// Prodejní data-store (bez nutnosti DDL)
//
// Formuláře, nabídky a SMTP nastavení se ukládají do existující tabulky
// webdo24_automations (customer_id + automation_key UNIQUE + settings JSONB),
// takže modul funguje okamžitě — žádná migrace nutná. Klíče jsou namespaced:
//   sales_email_settings  → SMTP
//   sales_form:<uuid>     → formulář
//   sales_quote:<uuid>    → nabídka
//
// Poznámka: sql/015_email_forms_quotes.sql obsahuje „čistou" migraci na
// dedikované tabulky pro budoucí přechod.
// ============================================

import { createAdminClient } from '@/lib/supabase/admin'

const EMAIL_KEY = 'sales_email_settings'
const FORM_PREFIX = 'sales_form:'
const QUOTE_PREFIX = 'sales_quote:'

export type StoredEmailSettings = Record<string, unknown>
export type StoredDoc = Record<string, unknown>

function docKey(prefix: string, id: string) {
  return `${prefix}${id}`
}

// --------------------------------------------------------------
// E-mail
// --------------------------------------------------------------

export async function getStoredEmailSettings(customerId: string): Promise<StoredEmailSettings | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_automations')
    .select('settings')
    .eq('customer_id', customerId)
    .eq('automation_key', EMAIL_KEY)
    .maybeSingle()
  return (data?.settings as StoredEmailSettings) || null
}

export async function putStoredEmailSettings(customerId: string, settings: StoredEmailSettings) {
  const admin = createAdminClient()
  const { error } = await admin.from('webdo24_automations').upsert(
    { customer_id: customerId, automation_key: EMAIL_KEY, settings, enabled: true },
    { onConflict: 'customer_id,automation_key' },
  )
  if (error) throw new Error(error.message)
}

// --------------------------------------------------------------
// Formuláře
// --------------------------------------------------------------

export async function listStoredForms(customerId: string): Promise<StoredDoc[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_automations')
    .select('automation_key, settings')
    .eq('customer_id', customerId)
    .like('automation_key', `${FORM_PREFIX}%`)
  return (data || [])
    .map((r): StoredDoc => ({ ...(r.settings as StoredDoc), id: r.automation_key.slice(FORM_PREFIX.length) }))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
}

export async function getStoredForm(customerId: string, formId: string): Promise<StoredDoc | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_automations')
    .select('settings')
    .eq('customer_id', customerId)
    .eq('automation_key', docKey(FORM_PREFIX, formId))
    .maybeSingle()
  if (!data?.settings) return null
  return { ...(data.settings as StoredDoc), id: formId }
}

export async function putStoredForm(customerId: string, formId: string, form: StoredDoc) {
  const admin = createAdminClient()
  const { error } = await admin.from('webdo24_automations').upsert(
    { customer_id: customerId, automation_key: docKey(FORM_PREFIX, formId), settings: form, enabled: form.status !== 'archived' },
    { onConflict: 'customer_id,automation_key' },
  )
  if (error) throw new Error(error.message)
}

export async function deleteStoredForm(customerId: string, formId: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('webdo24_automations')
    .delete()
    .eq('customer_id', customerId)
    .eq('automation_key', docKey(FORM_PREFIX, formId))
  if (error) throw new Error(error.message)
}

// --------------------------------------------------------------
// Nabídky
// --------------------------------------------------------------

export async function listStoredQuotes(customerId: string): Promise<StoredDoc[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_automations')
    .select('automation_key, settings')
    .eq('customer_id', customerId)
    .like('automation_key', `${QUOTE_PREFIX}%`)
  return (data || [])
    .map((r): StoredDoc => ({ ...(r.settings as StoredDoc), id: r.automation_key.slice(QUOTE_PREFIX.length) }))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
}

export async function getStoredQuote(customerId: string, quoteId: string): Promise<StoredDoc | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_automations')
    .select('settings')
    .eq('customer_id', customerId)
    .eq('automation_key', docKey(QUOTE_PREFIX, quoteId))
    .maybeSingle()
  if (!data?.settings) return null
  return { ...(data.settings as StoredDoc), id: quoteId }
}

export async function putStoredQuote(customerId: string, quoteId: string, quote: StoredDoc) {
  const admin = createAdminClient()
  const { error } = await admin.from('webdo24_automations').upsert(
    { customer_id: customerId, automation_key: docKey(QUOTE_PREFIX, quoteId), settings: quote, enabled: true },
    { onConflict: 'customer_id,automation_key' },
  )
  if (error) throw new Error(error.message)
}

export async function deleteStoredQuote(customerId: string, quoteId: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('webdo24_automations')
    .delete()
    .eq('customer_id', customerId)
    .eq('automation_key', docKey(QUOTE_PREFIX, quoteId))
  if (error) throw new Error(error.message)
}

// --------------------------------------------------------------
// Veřejné čtení formuláře (bez customerId — přes service role)
// --------------------------------------------------------------

export async function getPublicStoredForm(formId: string): Promise<StoredDoc | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_automations')
    .select('settings')
    .eq('automation_key', docKey(FORM_PREFIX, formId))
    .maybeSingle()
  if (!data?.settings) return null
  const form = data.settings as StoredDoc
  if (form.status === 'archived') return null
  return form
}

export async function getPublicFormCustomer(formId: string): Promise<{ customer_id: string; project_id: string | null } | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_automations')
    .select('customer_id, settings')
    .eq('automation_key', docKey(FORM_PREFIX, formId))
    .maybeSingle()
  if (!data) return null
  return { customer_id: data.customer_id as string, project_id: (data.settings as StoredDoc).project_id as string | null }
}
