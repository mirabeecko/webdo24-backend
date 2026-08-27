'use server'

// ============================================
// Prodejní modul: E-mail (SMTP), formuláře, nabídky
// Ukládá se do existující tabulky (sales-store, bez DDL).
// ============================================

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendSmtpEmail, smtpConfigured, type SmtpSettings } from '@/lib/email/smtp'
import { quoteToHtml } from '@/lib/email/quote-html'
import {
  getStoredEmailSettings,
  putStoredEmailSettings,
  listStoredForms,
  getStoredForm,
  putStoredForm,
  deleteStoredForm,
  listStoredQuotes,
  getStoredQuote,
  putStoredQuote,
  deleteStoredQuote,
} from '@/lib/sales-store'
import { getFormTemplate } from '@/lib/form-templates'

// --------------------------------------------------------------
// Typy (rozhraní se nemění)
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
// Kontext
// --------------------------------------------------------------

async function getSalesContext() {
  const user = await getCurrentUser()
  if (!user) return null
  const admin = createAdminClient()
  // customer + projekty v JEDNOM dotazu (embedded resource)
  const { data: customer } = await admin
    .from('webdo24_customers')
    .select('id, name, email, webdo24_projects(id, title)')
    .eq('user_id', user.id)
    .order('created_at', { referencedTable: 'webdo24_projects', ascending: false })
    .maybeSingle()
  if (!customer) return null
  const projects = (customer.webdo24_projects as Array<{ id: string; title: string }> | null) ?? []
  const project = projects[0] ?? null
  return {
    customerId: customer.id as string,
    customerName: (customer.name as string) || '',
    customerEmail: (customer.email as string) || '',
    projectId: project?.id as string | null,
    projectTitle: project?.title || '',
  }
}

async function requireContext() {
  const ctx = await getSalesContext()
  if (!ctx) throw new Error('not_authenticated')
  return ctx
}

// --------------------------------------------------------------
// E-mail (SMTP)
// --------------------------------------------------------------

export async function getEmailSettings(): Promise<EmailSettings | null> {
  const ctx = await getSalesContext()
  if (!ctx) return null
  return (await getStoredEmailSettings(ctx.customerId)) as EmailSettings | null
}

export async function saveEmailSettings(settings: EmailSettings): Promise<{ ok: boolean }> {
  const ctx = await requireContext()
  await putStoredEmailSettings(ctx.customerId, { ...settings, updated_at: new Date().toISOString() })
  revalidatePath('/email')
  return { ok: true }
}

export async function testEmail(to: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await requireContext()
  const settings = (await getStoredEmailSettings(ctx.customerId)) as EmailSettings | null
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
  return (await listStoredForms(ctx.customerId)) as unknown as CrmForm[]
}

export async function getForm(formId: string): Promise<CrmForm | null> {
  const ctx = await getSalesContext()
  if (!ctx) return null
  return (await getStoredForm(ctx.customerId, formId)) as unknown as CrmForm | null
}

export async function createForm(name: string): Promise<{ id: string }> {
  const ctx = await requireContext()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await putStoredForm(ctx.customerId, id, {
    name: name || 'Nový formulář',
    description: '',
    fields: [
      { id: crypto.randomUUID(), label: 'Jméno', type: 'text', required: true, placeholder: 'Vaše jméno' },
      { id: crypto.randomUUID(), label: 'E-mail', type: 'email', required: true, placeholder: 'vas@email.cz' },
      { id: crypto.randomUUID(), label: 'Telefon', type: 'phone', required: false, placeholder: '+420 …' },
      { id: crypto.randomUUID(), label: 'Zpráva', type: 'textarea', required: true, placeholder: 'Vaše zpráva' },
    ],
    submit_button: 'Odeslat poptávku',
    success_message: 'Děkujeme, formulář byl odeslán.',
    status: 'active',
    project_id: ctx.projectId,
    created_at: now,
    updated_at: now,
  })
  revalidatePath('/formulare')
  return { id }
}

export async function createFormFromTemplate(templateKey: string): Promise<{ id: string }> {
  const ctx = await requireContext()
  const template = getFormTemplate(templateKey)
  if (!template) throw new Error('Šablona nenalezena')

  const fields: FormField[] = template.fields.map((tf) => ({
    id: crypto.randomUUID(),
    label: tf.label,
    type: tf.type,
    required: !!tf.required,
    placeholder: tf.placeholder || '',
    ...(tf.options ? { options: tf.options } : {}),
  }))

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await putStoredForm(ctx.customerId, id, {
    name: template.name,
    description: template.description,
    fields,
    submit_button: template.submit_button,
    success_message: 'Děkujeme, formulář byl odeslán.',
    status: 'active',
    project_id: ctx.projectId,
    created_at: now,
    updated_at: now,
  })
  revalidatePath('/formulare')
  return { id }
}

export async function updateForm(formId: string, patch: Partial<CrmForm>): Promise<{ ok: boolean }> {
  const ctx = await requireContext()
  const existing = await getStoredForm(ctx.customerId, formId)
  if (!existing) throw new Error('Formulář nenalezen')
  const next = { ...existing, ...patch, updated_at: new Date().toISOString() }
  await putStoredForm(ctx.customerId, formId, next)
  revalidatePath('/formulare')
  return { ok: true }
}

export async function duplicateForm(formId: string): Promise<{ id: string }> {
  const ctx = await requireContext()
  const src = await getStoredForm(ctx.customerId, formId)
  if (!src) throw new Error('Formulář nenalezen')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await putStoredForm(ctx.customerId, id, {
    ...src,
    name: `${src.name} (kopie)`,
    status: 'active',
    project_id: ctx.projectId,
    created_at: now,
    updated_at: now,
  })
  revalidatePath('/formulare')
  return { id }
}

export async function deleteForm(formId: string): Promise<{ ok: boolean }> {
  const ctx = await requireContext()
  await deleteStoredForm(ctx.customerId, formId)
  revalidatePath('/formulare')
  return { ok: true }
}

// --------------------------------------------------------------
// Nabídky
// --------------------------------------------------------------

export async function listQuotes(): Promise<Quote[]> {
  const ctx = await getSalesContext()
  if (!ctx) return []
  return (await listStoredQuotes(ctx.customerId)) as unknown as Quote[]
}

export async function getQuote(quoteId: string): Promise<Quote | null> {
  const ctx = await getSalesContext()
  if (!ctx) return null
  return (await getStoredQuote(ctx.customerId, quoteId)) as unknown as Quote | null
}

export async function createQuote(): Promise<{ id: string }> {
  const ctx = await requireContext()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await putStoredQuote(ctx.customerId, id, {
    number: `N-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    title: 'Nabídka',
    client_name: '',
    client_email: '',
    valid_until: '',
    note: '',
    items: [{ id: crypto.randomUUID(), name: 'Položka 1', qty: 1, unit_price: 0 }],
    vat_rate: 21,
    status: 'draft',
    project_id: ctx.projectId,
    created_at: now,
    updated_at: now,
  })
  revalidatePath('/nabidky')
  return { id }
}

export async function updateQuote(quoteId: string, patch: Partial<Quote>): Promise<{ ok: boolean }> {
  const ctx = await requireContext()
  const existing = await getStoredQuote(ctx.customerId, quoteId)
  if (!existing) throw new Error('Nabídka nenalezena')
  const next = { ...existing, ...patch, updated_at: new Date().toISOString() }
  await putStoredQuote(ctx.customerId, quoteId, next)
  revalidatePath('/nabidky')
  return { ok: true }
}

export async function duplicateQuote(quoteId: string): Promise<{ id: string }> {
  const ctx = await requireContext()
  const src = await getStoredQuote(ctx.customerId, quoteId)
  if (!src) throw new Error('Nabídka nenalezena')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await putStoredQuote(ctx.customerId, id, {
    ...src,
    number: `${src.number || 'N'}-K`,
    title: `${src.title} (kopie)`,
    status: 'draft',
    project_id: ctx.projectId,
    created_at: now,
    updated_at: now,
  })
  revalidatePath('/nabidky')
  return { id }
}

export async function deleteQuote(quoteId: string): Promise<{ ok: boolean }> {
  const ctx = await requireContext()
  await deleteStoredQuote(ctx.customerId, quoteId)
  revalidatePath('/nabidky')
  return { ok: true }
}

export async function sendQuoteEmail(quoteId: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await requireContext()
  const quote = await getStoredQuote(ctx.customerId, quoteId)
  const settings = (await getStoredEmailSettings(ctx.customerId)) as EmailSettings | null

  if (!quote) throw new Error('Nabídka nenalezena')
  if (!quote.client_email) return { ok: false, message: 'Nabídka nemá e-mail klienta — doplňte ho.' }
  if (!smtpConfigured(settings)) return { ok: false, message: 'SMTP není nastaveno — doplňte údaje v E-mail.' }

  const html = quoteToHtml({ quote: quote as unknown as Quote, companyName: ctx.projectTitle || ctx.customerName })
  try {
    await sendSmtpEmail({
      settings: settings as SmtpSettings,
      to: quote.client_email as string,
      toName: (quote.client_name as string) || undefined,
      subject: `${quote.number || 'Nabídka'} — ${quote.title}`,
      html,
    })
    await putStoredQuote(ctx.customerId, quoteId, { ...quote, status: 'sent', updated_at: new Date().toISOString() })
    revalidatePath('/nabidky')
    return { ok: true, message: `Nabídka odeslána na ${quote.client_email}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Chyba odesílání' }
  }
}
