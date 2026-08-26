'use server'

// ============================================
// Prodejní modul: E-mail (SMTP), formuláře, nabídky
// ============================================

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendSmtpEmail, smtpConfigured, type SmtpSettings } from '@/lib/email/smtp'
import { quoteToHtml } from '@/lib/email/quote-html'

// --------------------------------------------------------------
// Typy
// --------------------------------------------------------------

export interface FormField {
  id: string
  label: string
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'date' | 'number'
  required: boolean
  options?: string[]
  placeholder?: string
}

export interface CrmForm {
  id: string
  name: string
  description: string | null
  fields: FormField[]
  submit_button: string
  success_message: string
  status: string
  created_at: string
  updated_at: string
}

export interface QuoteItem {
  id: string
  name: string
  qty: number
  unit_price: number
}

export interface Quote {
  id: string
  number: string | null
  title: string
  client_name: string | null
  client_email: string | null
  valid_until: string | null
  note: string | null
  items: QuoteItem[]
  vat_rate: number
  status: string
  created_at: string
  updated_at: string
}

export interface EmailSettings extends SmtpSettings {
  signature_html?: string | null
}

// --------------------------------------------------------------
// Kontext (user → customer → project)
// --------------------------------------------------------------

async function getSalesContext() {
  const user = await getCurrentUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: customer } = await admin
    .from('webdo24_customers')
    .select('id, name, email')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!customer) return null
  const { data: project } = await admin
    .from('webdo24_projects')
    .select('id, title')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return {
    customerId: customer.id as string,
    customerName: (customer.name as string) || '',
    customerEmail: (customer.email as string) || '',
    projectId: project?.id as string | null,
    projectTitle: (project?.title as string) || '',
  }
}

// --------------------------------------------------------------
// E-mail (SMTP) nastavení
// --------------------------------------------------------------

export async function getEmailSettings(): Promise<EmailSettings | null> {
  const ctx = await getSalesContext()
  if (!ctx) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_email_settings')
    .select('*')
    .eq('customer_id', ctx.customerId)
    .maybeSingle()
  return (data as EmailSettings) || null
}

export async function saveEmailSettings(settings: EmailSettings): Promise<{ ok: boolean }> {
  const ctx = await getSalesContext()
  if (!ctx) throw new Error('not_authenticated')
  const admin = createAdminClient()
  const { error } = await admin.from('webdo24_email_settings').upsert(
    {
      customer_id: ctx.customerId,
      smtp_host: settings.smtp_host || null,
      smtp_port: settings.smtp_port || 587,
      smtp_secure: settings.smtp_secure || 'tls',
      smtp_user: settings.smtp_user || null,
      smtp_pass: settings.smtp_pass || null,
      from_name: settings.from_name || null,
      from_email: settings.from_email || null,
      signature_html: settings.signature_html || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'customer_id' },
  )
  if (error) throw new Error(error.message)
  revalidatePath('/email')
  return { ok: true }
}

export async function testEmail(to: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await getSalesContext()
  if (!ctx) throw new Error('not_authenticated')
  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('webdo24_email_settings')
    .select('*')
    .eq('customer_id', ctx.customerId)
    .maybeSingle()
  if (!smtpConfigured(settings)) {
    return { ok: false, message: 'SMTP není nastaveno — doplňte host a e-mail odesílatele.' }
  }
  try {
    await sendSmtpEmail({
      settings: settings as SmtpSettings,
      to,
      subject: 'Testovací e-mail — WebDo24',
      html: `<p>Dobrý den,</p><p>toto je testovací e-mail z vašeho WebDo24 účtu.</p><p style="color:#888;font-size:12px">Pokud ho vidíte, je odesílání správně nastaveno.</p>`,
    })
    return { ok: true, message: `Testovací e-mail odeslán na ${to}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Chyba odesílání' }
  }
}

// --------------------------------------------------------------
// Formuláře
// --------------------------------------------------------------

export async function listForms(): Promise<CrmForm[]> {
  const ctx = await getSalesContext()
  if (!ctx) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_forms')
    .select('*')
    .eq('customer_id', ctx.customerId)
    .order('created_at', { ascending: false })
  return (data as CrmForm[]) || []
}

export async function getForm(formId: string): Promise<CrmForm | null> {
  const ctx = await getSalesContext()
  if (!ctx) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_forms')
    .select('*')
    .eq('id', formId)
    .eq('customer_id', ctx.customerId)
    .maybeSingle()
  return (data as CrmForm) || null
}

export async function createForm(name: string): Promise<{ id: string }> {
  const ctx = await getSalesContext()
  if (!ctx) throw new Error('not_authenticated')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('webdo24_forms')
    .insert({
      customer_id: ctx.customerId,
      project_id: ctx.projectId,
      name: name || 'Nový formulář',
      fields: [
        { id: crypto.randomUUID(), label: 'Jméno', type: 'text', required: true, placeholder: 'Vaše jméno' },
        { id: crypto.randomUUID(), label: 'E-mail', type: 'email', required: true, placeholder: 'vas@email.cz' },
        { id: crypto.randomUUID(), label: 'Zpráva', type: 'textarea', required: true, placeholder: 'Vaše zpráva' },
      ],
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/formulare')
  return { id: data.id as string }
}

export async function updateForm(formId: string, patch: Partial<CrmForm>): Promise<{ ok: boolean }> {
  const ctx = await getSalesContext()
  if (!ctx) throw new Error('not_authenticated')
  const admin = createAdminClient()
  const allowed: Record<string, unknown> = {}
  if (typeof patch.name === 'string') allowed.name = patch.name
  if (typeof patch.description === 'string' || patch.description === null) allowed.description = patch.description
  if (Array.isArray(patch.fields)) allowed.fields = patch.fields
  if (typeof patch.submit_button === 'string') allowed.submit_button = patch.submit_button
  if (typeof patch.success_message === 'string') allowed.success_message = patch.success_message
  if (patch.status === 'active' || patch.status === 'archived') allowed.status = patch.status
  allowed.updated_at = new Date().toISOString()
  const { error } = await admin
    .from('webdo24_forms')
    .update(allowed)
    .eq('id', formId)
    .eq('customer_id', ctx.customerId)
  if (error) throw new Error(error.message)
  revalidatePath('/formulare')
  return { ok: true }
}

export async function duplicateForm(formId: string): Promise<{ id: string }> {
  const ctx = await getSalesContext()
  if (!ctx) throw new Error('not_authenticated')
  const admin = createAdminClient()
  const { data: src } = await admin
    .from('webdo24_forms')
    .select('*')
    .eq('id', formId)
    .eq('customer_id', ctx.customerId)
    .maybeSingle()
  if (!src) throw new Error('Formulář nenalezen')
  const { data, error } = await admin
    .from('webdo24_forms')
    .insert({
      customer_id: ctx.customerId,
      project_id: ctx.projectId,
      name: `${src.name} (kopie)`,
      description: src.description,
      fields: src.fields,
      submit_button: src.submit_button,
      success_message: src.success_message,
      status: 'active',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/formulare')
  return { id: data.id as string }
}

export async function deleteForm(formId: string): Promise<{ ok: boolean }> {
  const ctx = await getSalesContext()
  if (!ctx) throw new Error('not_authenticated')
  const admin = createAdminClient()
  const { error } = await admin
    .from('webdo24_forms')
    .delete()
    .eq('id', formId)
    .eq('customer_id', ctx.customerId)
  if (error) throw new Error(error.message)
  revalidatePath('/formulare')
  return { ok: true }
}

// --------------------------------------------------------------
// Nabídky
// --------------------------------------------------------------

export async function listQuotes(): Promise<Quote[]> {
  const ctx = await getSalesContext()
  if (!ctx) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_quotes')
    .select('*')
    .eq('customer_id', ctx.customerId)
    .order('created_at', { ascending: false })
  return (data as Quote[]) || []
}

export async function getQuote(quoteId: string): Promise<Quote | null> {
  const ctx = await getSalesContext()
  if (!ctx) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('customer_id', ctx.customerId)
    .maybeSingle()
  return (data as Quote) || null
}

export async function createQuote(): Promise<{ id: string }> {
  const ctx = await getSalesContext()
  if (!ctx) throw new Error('not_authenticated')
  const admin = createAdminClient()
  const number = `N-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  const { data, error } = await admin
    .from('webdo24_quotes')
    .insert({
      customer_id: ctx.customerId,
      project_id: ctx.projectId,
      number,
      title: 'Nabídka',
      items: [
        { id: crypto.randomUUID(), name: 'Položka 1', qty: 1, unit_price: 0 },
      ],
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/nabidky')
  return { id: data.id as string }
}

export async function updateQuote(quoteId: string, patch: Partial<Quote>): Promise<{ ok: boolean }> {
  const ctx = await getSalesContext()
  if (!ctx) throw new Error('not_authenticated')
  const admin = createAdminClient()
  const allowed: Record<string, unknown> = {}
  const strFields = ['title', 'client_name', 'client_email', 'valid_until', 'note', 'number', 'status'] as const
  for (const f of strFields) {
    if (typeof (patch as Record<string, unknown>)[f] === 'string') allowed[f] = (patch as Record<string, unknown>)[f]
  }
  if (Array.isArray(patch.items)) allowed.items = patch.items
  if (typeof patch.vat_rate === 'number') allowed.vat_rate = patch.vat_rate
  allowed.updated_at = new Date().toISOString()
  const { error } = await admin
    .from('webdo24_quotes')
    .update(allowed)
    .eq('id', quoteId)
    .eq('customer_id', ctx.customerId)
  if (error) throw new Error(error.message)
  revalidatePath('/nabidky')
  return { ok: true }
}

export async function duplicateQuote(quoteId: string): Promise<{ id: string }> {
  const ctx = await getSalesContext()
  if (!ctx) throw new Error('not_authenticated')
  const admin = createAdminClient()
  const { data: src } = await admin
    .from('webdo24_quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('customer_id', ctx.customerId)
    .maybeSingle()
  if (!src) throw new Error('Nabídka nenalezena')
  const { data, error } = await admin
    .from('webdo24_quotes')
    .insert({
      customer_id: ctx.customerId,
      project_id: ctx.projectId,
      number: `${src.number || 'N'}-K`,
      title: `${src.title} (kopie)`,
      client_name: src.client_name,
      client_email: src.client_email,
      valid_until: src.valid_until,
      note: src.note,
      items: src.items,
      vat_rate: src.vat_rate,
      status: 'draft',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/nabidky')
  return { id: data.id as string }
}

export async function deleteQuote(quoteId: string): Promise<{ ok: boolean }> {
  const ctx = await getSalesContext()
  if (!ctx) throw new Error('not_authenticated')
  const admin = createAdminClient()
  const { error } = await admin
    .from('webdo24_quotes')
    .delete()
    .eq('id', quoteId)
    .eq('customer_id', ctx.customerId)
  if (error) throw new Error(error.message)
  revalidatePath('/nabidky')
  return { ok: true }
}

/** Odešle nabídku jako HTML e-mail zákazníkovi (přes SMTP zákazníka). */
export async function sendQuoteEmail(quoteId: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await getSalesContext()
  if (!ctx) throw new Error('not_authenticated')
  const admin = createAdminClient()

  const [{ data: quote }, { data: settings }] = await Promise.all([
    admin.from('webdo24_quotes').select('*').eq('id', quoteId).eq('customer_id', ctx.customerId).maybeSingle(),
    admin.from('webdo24_email_settings').select('*').eq('customer_id', ctx.customerId).maybeSingle(),
  ])

  if (!quote) throw new Error('Nabídka nenalezena')
  if (!quote.client_email) return { ok: false, message: 'Nabídka nemá e-mail klienta — doplňte ho.' }
  if (!smtpConfigured(settings)) return { ok: false, message: 'SMTP není nastaveno — doplňte údaje v E-mail.' }

  const html = quoteToHtml({
    quote: quote as Quote,
    companyName: ctx.projectTitle || ctx.customerName,
  })

  try {
    await sendSmtpEmail({
      settings: settings as SmtpSettings,
      to: quote.client_email as string,
      toName: (quote.client_name as string) || undefined,
      subject: `${quote.number || 'Nabídka'} — ${quote.title}`,
      html,
    })
    await admin
      .from('webdo24_quotes')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', quoteId)
    revalidatePath('/nabidky')
    return { ok: true, message: `Nabídka odeslána na ${quote.client_email}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Chyba odesílání' }
  }
}
