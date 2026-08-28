'use server'

// ============================================
// CRM – poptávky, návštěvnost, automatické odpovědi
//
// Vše běží v rámci přihlášeného zákazníka (RLS na session klientovi).
// AI odpovědi: self-hosted n8n webhook (N8N_AI_ASSIST_WEBHOOK_URL) se
// secretem; pokud AI není dostupné, použije se lokální chytrá šablona
// (graceful degradation — CRM funguje i bez n8n).
// ============================================

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppCustomerContext } from '@/lib/customer-context'
import { revalidatePath } from 'next/cache'

const AI_TIMEOUT_MS = 45_000

// --------------------------------------------------------------
// Typy pro CRM (server → klient)
// --------------------------------------------------------------

export interface CrmLead {
  id: string
  name: string
  phone: string | null
  email: string | null
  message: string
  source: string
  status: string
  ai_reply: string | null
  ai_reply_used: boolean
  notes: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface CrmAnalyticsRow {
  event_date: string
  page_views: number
  unique_visitors: number
  form_submissions: number
}

export interface CrmData {
  projectTitle: string
  customerName: string
  companyPhone: string | null
  companyEmail: string | null
  leads: CrmLead[]
  analytics: CrmAnalyticsRow[]
  kpis: {
    newLeads7: number
    totalLeads: number
    views7: number
    unique7: number
    subs7: number
    conversion7: number
    viewsToday: number
    viewsYesterday: number
    subsToday: number
  }
  automations: Record<string, boolean>
}

// --------------------------------------------------------------
// Kontext projektu
// --------------------------------------------------------------

async function getCrmProject() {
  const context = await getAppCustomerContext()
  if (!context?.project) return null

  return {
    customerId: context.customer.id,
    customerName: context.customer.name || '',
    projectId: context.project.id,
    projectTitle: context.project.title || '',
    businessType: context.project.business_type || null,
    location: context.project.location || null,
  }
}

// --------------------------------------------------------------
// Hlavní načtení dat pro stránku /poptavky
// --------------------------------------------------------------

export async function getCrmData() {
  const ctx = await getCrmProject()
  if (!ctx) return null

  const admin = createAdminClient()
  const today = new Date()
  const iso = (d: Date) => d.toISOString().split('T')[0]
  const since14 = iso(new Date(today.getTime() - 13 * 86400000))
  const since7 = iso(new Date(today.getTime() - 6 * 86400000))

  const [{ data: leads }, { data: analytics }, { data: automations }, { data: company }] =
    await Promise.all([
      admin
        .from('webdo24_leads')
        .select('*')
        .eq('project_id', ctx.projectId)
        .order('created_at', { ascending: false })
        .limit(200),
      admin
        .from('webdo24_analytics')
        .select('event_date, page_views, unique_visitors, form_submissions')
        .eq('project_id', ctx.projectId)
        .gte('event_date', since14)
        .order('event_date', { ascending: true }),
      admin
        .from('webdo24_automations')
        .select('automation_key, enabled')
        .eq('customer_id', ctx.customerId),
      admin
        .from('webdo24_company_profiles')
        .select('company_name, phone, email, city')
        .eq('project_id', ctx.projectId)
        .maybeSingle(),
    ])

  const now = new Date()
  const isoNow = iso(now)
  const isoYesterday = iso(new Date(now.getTime() - 86400000))

  const leadsAll = (leads as Array<Record<string, unknown>>) || []
  const leads7 = leadsAll.filter((l) => l.created_at && String(l.created_at).slice(0, 10) >= since7)

  const sum = (rows: Array<Record<string, unknown>> | null, key: string) =>
    (rows || []).reduce((acc, r) => acc + Number(r[key] || 0), 0)

  const analyticsRows = (analytics as Array<Record<string, unknown>>) || []
  const views7 = sum(analyticsRows.filter((r) => String(r.event_date) >= since7), 'page_views')
  const unique7 = sum(analyticsRows.filter((r) => String(r.event_date) >= since7), 'unique_visitors')
  const subs7 = sum(analyticsRows.filter((r) => String(r.event_date) >= since7), 'form_submissions')

  const todayRow = analyticsRows.find((r) => r.event_date === isoNow)
  const yesterdayRow = analyticsRows.find((r) => r.event_date === isoYesterday)

  const automationsMap: Record<string, boolean> = {}
  for (const a of (automations as Array<{ automation_key: string; enabled: boolean }>) || []) {
    automationsMap[a.automation_key] = a.enabled
  }

  return {
    projectTitle: ctx.projectTitle,
    customerName: ctx.customerName,
    companyPhone: (company as Record<string, unknown> | null)?.phone as string | null ?? null,
    companyEmail: (company as Record<string, unknown> | null)?.email as string | null ?? null,
    leads: leadsAll as unknown as CrmLead[],
    analytics: analyticsRows as unknown as CrmAnalyticsRow[],
    kpis: {
      newLeads7: leads7.filter((l) => l.status === 'new').length,
      totalLeads: leadsAll.length,
      views7,
      unique7,
      subs7,
      conversion7: views7 > 0 ? Math.round((subs7 / views7) * 1000) / 10 : 0,
      viewsToday: (todayRow?.page_views as number) || 0,
      viewsYesterday: (yesterdayRow?.page_views as number) || 0,
      subsToday: (todayRow?.form_submissions as number) || 0,
    },
    automations: automationsMap,
  }
}

// --------------------------------------------------------------
// Akce nad poptávkou (všechny ověřují, že poptávka patří přihlášenému
// zákazníkovi — admin klient obchází RLS, proto explicitní kontrola)
// --------------------------------------------------------------

async function requireOwnLead(leadId: string) {
  const ctx = await getCrmProject()
  if (!ctx) throw new Error('not_authenticated')
  const admin = createAdminClient()
  const { data: lead } = await admin
    .from('webdo24_leads')
    .select('id')
    .eq('id', leadId)
    .eq('project_id', ctx.projectId)
    .maybeSingle()
  if (!lead) throw new Error('Poptávka nebyla nalezena')
  return ctx
}

export async function updateLeadStatus(leadId: string, status: string) {
  await requireOwnLead(leadId)
  const admin = createAdminClient()
  const { error } = await admin
    .from('webdo24_leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', leadId)
  if (error) throw new Error(error.message)
  revalidatePath('/poptavky')
  return { ok: true }
}

export async function updateLeadNotes(leadId: string, notes: string) {
  await requireOwnLead(leadId)
  const admin = createAdminClient()
  const { error } = await admin
    .from('webdo24_leads')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', leadId)
  if (error) throw new Error(error.message)
  revalidatePath('/poptavky')
  return { ok: true }
}

// Pole, která smí zákazník upravovat (jméno/kontakt/detail poptávky).
// Strukturovaná CRM pole žijí v metadata JSONB (žádná DDL migrace).
const EDITABLE_META_FIELDS = new Set(['company', 'budget', 'preferred_date', 'request_type', 'location'])

export async function updateLeadField(leadId: string, field: string, value: string) {
  await requireOwnLead(leadId)
  const admin = createAdminClient()

  // kontaktní pole jdou přímo do sloupců
  if (field === 'name' || field === 'phone' || field === 'email') {
    const { error } = await admin
      .from('webdo24_leads')
      .update({ [field]: value.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', leadId)
    if (error) throw new Error(error.message)
    revalidatePath('/poptavky')
    return { ok: true }
  }

  // CRM pole → metadata
  if (!EDITABLE_META_FIELDS.has(field)) throw new Error('Neznámé pole')
  const { data: lead } = await admin
    .from('webdo24_leads')
    .select('metadata')
    .eq('id', leadId)
    .maybeSingle()
  const nextMeta = { ...((lead?.metadata as Record<string, unknown> | null) || {}) }
  if (value.trim()) nextMeta[field] = value.trim()
  else delete nextMeta[field]
  const { error } = await admin
    .from('webdo24_leads')
    .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
    .eq('id', leadId)
  if (error) throw new Error(error.message)
  revalidatePath('/poptavky')
  return { ok: true }
}

export async function getMessages(leadId: string) {
  await requireOwnLead(leadId)
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_messages')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })
  return data || []
}

export async function sendMessage(leadId: string, content: string) {
  await requireOwnLead(leadId)
  const admin = createAdminClient()
  const { error } = await admin
    .from('webdo24_messages')
    .insert({ lead_id: leadId, sender_type: 'user', content })
  if (error) throw new Error(error.message)
  revalidatePath('/poptavky')
  return { ok: true }
}

// --------------------------------------------------------------
// AI odpověď na poptávku
// --------------------------------------------------------------

/** Lokální chytrá šablona (fallback, když n8n neodpovídá). */
function fallbackReply(projectTitle: string, leadName: string): string {
  return [
    `Dobrý den, ${leadName || 'zájemci o služby'},`,
    '',
    `děkuji za vaši poptávku. Zprávu jsem dostal a ozvu se vám zpět do 24 hodin s konkrétní nabídkou a případnými dotazy.`,
    '',
    `Pokud to spěchá, neváhejte mě kontaktovat telefonicky.`,
    '',
    `S pozdravem,`,
    projectTitle || 'Váš poskytovatel služeb',
  ].join('\n')
}

export async function generateLeadReply(leadId: string): Promise<{ reply: string; usedAi: boolean }> {
  const ctx = await requireOwnLead(leadId)

  const admin = createAdminClient()
  const { data: lead } = await admin
    .from('webdo24_leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle()
  if (!lead) throw new Error('Poptávka nebyla nalezena')

  // ── Pokus o AI odpověď (n8n) ──
  const url = process.env.N8N_AI_ASSIST_WEBHOOK_URL
  let reply = ''
  let usedAi = false
  if (url) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const secret = process.env.N8N_WEBHOOK_SECRET
      if (secret) headers['X-Webhook-Secret'] = secret

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'lead_reply',
          lead: {
            name: lead.name,
            phone: lead.phone || null,
            email: lead.email || null,
            message: lead.message || null,
            source: lead.source || 'web',
          },
          context: {
            company_name: ctx.projectTitle,
            business_type: ctx.businessType,
            location: ctx.location,
          },
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      })
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
        if (typeof json.reply === 'string' && json.reply.trim()) {
          reply = json.reply.trim()
          usedAi = true
        }
      }
    } catch {
      reply = ''
    }
  }

  if (!reply) reply = fallbackReply(ctx.projectTitle, (lead.name as string) || '')

  // Ulož návrh AI + zprávu do konverzace (is_ai_suggestion)
  const { error: upErr } = await admin
    .from('webdo24_leads')
    .update({ ai_reply: reply, ai_reply_used: false, updated_at: new Date().toISOString() })
    .eq('id', leadId)
  if (upErr) throw new Error(upErr.message)

  const { data: existing } = await admin
    .from('webdo24_messages')
    .select('id')
    .eq('lead_id', leadId)
    .eq('is_ai_suggestion', true)
    .limit(1)
  if (!existing || existing.length === 0) {
    await admin.from('webdo24_messages').insert({
      lead_id: leadId,
      sender_type: 'ai',
      content: reply,
      is_ai_suggestion: true,
      ai_action: 'lead_reply',
    })
  } else {
    await admin
      .from('webdo24_messages')
      .update({ content: reply, created_at: new Date().toISOString() })
      .eq('id', (existing[0] as { id: string }).id)
  }

  revalidatePath('/poptavky')
  return { reply, usedAi }
}

/** Použít AI odpověď → odešle jako zprávu od uživatele. */
export async function sendAiReply(leadId: string, content: string) {
  await requireOwnLead(leadId)
  const admin = createAdminClient()
  const { error } = await admin.from('webdo24_messages').insert({
    lead_id: leadId,
    sender_type: 'user',
    content,
  })
  if (error) throw new Error(error.message)
  await admin
    .from('webdo24_leads')
    .update({ ai_reply_used: true, updated_at: new Date().toISOString() })
    .eq('id', leadId)
  revalidatePath('/poptavky')
  return { ok: true }
}

// --------------------------------------------------------------
// Automatizace
// --------------------------------------------------------------

export async function toggleCrmAutomation(key: string, enabled: boolean) {
  const ctx = await getCrmProject()
  if (!ctx) throw new Error('not_authenticated')

  const admin = createAdminClient()
  const { error } = await admin.from('webdo24_automations').upsert(
    { customer_id: ctx.customerId, automation_key: key, enabled },
    { onConflict: 'customer_id,automation_key' },
  )
  if (error) throw new Error(error.message)
  revalidatePath('/poptavky')
  return { ok: true }
}

// --------------------------------------------------------------
// Automatická odpověď při příchodu poptávky (voláno z /api/leads/create)
// --------------------------------------------------------------

export interface AutoReplyInput {
  leadId: string
  projectId: string
  customerId: string
  name: string
  phone?: string
  email?: string
  message: string
}

/**
 * Fire-and-forget: pokud má zákazník zapnutou automatizaci ai_reply,
 * vygeneruje AI návrh odpovědi na novou poptávku a uloží ho (lead.ai_reply
 * + zpráva is_ai_suggestion). Nikdy nehází chybu — lead už je uložený.
 */
export async function generateAutoReplyForLead(input: AutoReplyInput) {
  try {
    const admin = createAdminClient()
    const { data: automations } = await admin
      .from('webdo24_automations')
      .select('automation_key, enabled')
      .eq('customer_id', input.customerId)
    const map: Record<string, boolean> = {}
    for (const a of (automations || []) as Array<{ automation_key: string; enabled: boolean }>) {
      map[a.automation_key] = a.enabled
    }
    if (!map.ai_reply && !map.auto_reply) return

    const ctx = await getCrmProject()
    // getCrmProject vyžaduje session (volá se z veřejného API → null);
    // projekt načteme přímo z input.projectId
    const [{ data: project }, { data: company }] = await Promise.all([
      admin
        .from('webdo24_projects')
        .select('title, business_type, location')
        .eq('id', input.projectId)
        .maybeSingle(),
      admin
        .from('webdo24_company_profiles')
        .select('company_name')
        .eq('project_id', input.projectId)
        .maybeSingle(),
    ])
    const projectInfo = {
      projectTitle: (project?.title as string) || (company?.company_name as string) || ctx?.projectTitle || '',
      businessType: (project?.business_type as string) || ctx?.businessType || null,
      location: (project?.location as string) || ctx?.location || null,
    }

    const url = process.env.N8N_AI_ASSIST_WEBHOOK_URL
    let reply = ''
    if (url) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        const secret = process.env.N8N_WEBHOOK_SECRET
        if (secret) headers['X-Webhook-Secret'] = secret
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'lead_reply',
            lead: {
              name: input.name,
              phone: input.phone || null,
              email: input.email || null,
              message: input.message,
              source: 'web',
            },
            context: {
              company_name: projectInfo.projectTitle,
              business_type: projectInfo.businessType,
              location: projectInfo.location,
            },
          }),
          signal: AbortSignal.timeout(AI_TIMEOUT_MS),
        })
        if (res.ok) {
          const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
          if (typeof json.reply === 'string' && json.reply.trim()) reply = json.reply.trim()
        }
      } catch {
        reply = ''
      }
    }

    if (!reply) {
      reply = fallbackReply(projectInfo.projectTitle, input.name)
    }

    await admin.from('webdo24_leads').update({ ai_reply: reply }).eq('id', input.leadId)
    await admin.from('webdo24_messages').insert({
      lead_id: input.leadId,
      sender_type: 'ai',
      content: reply,
      is_ai_suggestion: true,
      ai_action: 'lead_reply',
    })
  } catch (err) {
    console.error('[auto-reply] failed:', err)
  }
}

// --------------------------------------------------------------
// Odeslání odpovědi zájemci emailem (přes email frontu)
// --------------------------------------------------------------

export async function sendLeadEmailReply(leadId: string, reply: string) {
  const ctx = await requireOwnLead(leadId)

  const admin = createAdminClient()
  const { data: lead } = await admin
    .from('webdo24_leads')
    .select('name, email, phone')
    .eq('id', leadId)
    .maybeSingle()
  if (!lead || !lead.email) throw new Error('Poptávka nemá e-mail zájemce')

  const { data: customer } = await admin
    .from('webdo24_customers')
    .select('id')
    .eq('id', ctx.customerId)
    .maybeSingle()
  if (!customer) throw new Error('not_authenticated')

  const { data: company } = await admin
    .from('webdo24_company_profiles')
    .select('company_name')
    .eq('project_id', ctx.projectId)
    .maybeSingle()

  const { queueEmail } = await import('@/lib/email/queue')
  await queueEmail({
    customerId: customer.id as string,
    toEmail: lead.email as string,
    toName: (lead.name as string) || undefined,
    templateKey: 'lead_reply',
    metadata: {
      leadName: lead.name,
      companyName: (company as { company_name?: string } | null)?.company_name || ctx.projectTitle,
      reply,
    },
  })

  revalidatePath('/poptavky')
  return { ok: true }
}

// --------------------------------------------------------------
// Legacy helper (PipelineView na /web používá getLeads)
// --------------------------------------------------------------

export async function getLeads(): Promise<CrmLead[]> {
  const ctx = await getCrmProject()
  if (!ctx) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_leads')
    .select('id, name, phone, message, status, source, created_at')
    .eq('project_id', ctx.projectId)
    .order('created_at', { ascending: false })
  return (data as unknown as CrmLead[]) || []
}
