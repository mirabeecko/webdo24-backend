'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { classifyChangeRequest } from '@/lib/ai/change-classifier'
import { queueEmailToCustomer } from '@/lib/email/queue'
import type { ChangeRequest, ChangeCategory } from '@/types'

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

async function getCallerProject() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: customer } = await supabase
    .from('webdo24_customers')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!customer) return null

  const { data: project } = await supabase
    .from('webdo24_projects')
    .select('id, current_version_id')
    .eq('customer_id', customer.id)
    .single()
  if (!project) return null

  return { projectId: project.id, customerId: customer.id, userId: user.id, currentVersionId: project.current_version_id }
}

// --------------------------------------------------------------
// LIST
// --------------------------------------------------------------

export async function listChangeRequests(limit = 30): Promise<ChangeRequest[]> {
  const ctx = await getCallerProject()
  if (!ctx) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('webdo24_change_requests')
    .select('*')
    .eq('project_id', ctx.projectId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data as ChangeRequest[]) ?? []
}

export async function getChangeRequest(id: string): Promise<ChangeRequest | null> {
  const ctx = await getCallerProject()
  if (!ctx) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('webdo24_change_requests')
    .select('*')
    .eq('id', id)
    .eq('project_id', ctx.projectId)
    .single()

  return (data as ChangeRequest | null) ?? null
}

// --------------------------------------------------------------
// CREATE  (vstupní bod „Řekněte co chcete změnit")
// --------------------------------------------------------------

export async function createChangeRequest(rawInput: string): Promise<{
  ok: true
  id: string
  category: ChangeCategory
  confidence: number
  status: string
  errorMessage: string | null
}> {
  const ctx = await getCallerProject()
  if (!ctx) throw new Error('not_authenticated')

  const trimmed = rawInput.trim()
  if (!trimmed) throw new Error('empty_input')
  if (trimmed.length > 2000) throw new Error('input_too_long')

  // rychlá lokální klasifikace (později nahradí LLM)
  const classification = classifyChangeRequest(trimmed)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('webdo24_change_requests')
    .insert({
      project_id: ctx.projectId,
      user_id: ctx.userId,
      raw_input: trimmed,
      category: classification.category,
      confidence: classification.confidence,
      status: 'classifying',
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'create_change_failed')

  // audit log (via admin – RLS protected table)
  const admin = createAdminClient()
  await admin.from('webdo24_audit_log').insert({
    user_id: ctx.userId,
    customer_id: ctx.customerId,
    project_id: ctx.projectId,
    action: 'change.create',
    entity: 'change_request',
    entity_id: data.id,
    diff: { input_preview: trimmed.slice(0, 120), category: classification.category },
  })

  // Kick off n8n pipeline (fire-and-forget, neblokuje odpověď)
  const webhookUrl = process.env.N8N_PIPELINE_WEBHOOK_URL
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        change_request_id: data.id,
        project_id: ctx.projectId,
        customer_id: ctx.customerId,
        raw_input: trimmed,
        category: classification.category,
        confidence: classification.confidence,
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {}) // ignoruj síťové chyby — admin to pickne z DB
  }

  // Notify customer that we received their request
  queueEmailToCustomer(ctx.customerId, 'change_request_received', {
    rawInput: trimmed,
    changeRequestId: data.id,
  }).catch((err) => console.error('[createChangeRequest] email failed:', err))

  revalidatePath('/pozadavky')
  revalidatePath('/dashboard')

  // Finální stav po requestu (klasifikace / selhání pipeline) — UI ho
  // použije místo optimistického "Analyzujeme".
  const { data: final } = await admin
    .from('webdo24_change_requests')
    .select('status, error_message')
    .eq('id', data.id)
    .single()

  return {
    ok: true,
    id: data.id,
    category: classification.category,
    confidence: classification.confidence,
    status: (final?.status as string) ?? 'classifying',
    errorMessage: (final?.error_message as string | null) ?? null,
  }
}

// --------------------------------------------------------------
// APPROVE / REJECT  (klient potvrzuje preview)
// --------------------------------------------------------------

export async function approveChangeRequest(id: string): Promise<{ ok: true }> {
  const ctx = await getCallerProject()
  if (!ctx) throw new Error('not_authenticated')

  const admin = createAdminClient()
  const { data: cr, error } = await admin
    .from('webdo24_change_requests')
    .select('id, project_id, status, draft_version_id')
    .eq('id', id)
    .single()
  if (error || !cr) throw new Error('not_found')
  if (cr.project_id !== ctx.projectId) throw new Error('forbidden')
  if (cr.status !== 'preview_ready') throw new Error(`cannot_approve_in_status:${cr.status}`)
  if (!cr.draft_version_id) throw new Error('no_draft_to_publish')

  await admin
    .from('webdo24_change_requests')
    .update({ status: 'approved' })
    .eq('id', id)

  // Trigger n8n publish workflow
  const publishUrl = process.env.N8N_QA_WEBHOOK_URL
  if (publishUrl) {
    fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        change_request_id: id,
        project_id: ctx.projectId,
        draft_version_id: cr.draft_version_id,
        action: 'publish',
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {})
  }

  await admin.from('webdo24_audit_log').insert({
    user_id: ctx.userId,
    customer_id: ctx.customerId,
    project_id: ctx.projectId,
    action: 'change.approve',
    entity: 'change_request',
    entity_id: id,
  })

  revalidatePath('/pozadavky')
  revalidatePath(`/pozadavky/${id}`)
  return { ok: true }
}

export async function rejectChangeRequest(id: string, reason?: string): Promise<{ ok: true }> {
  const ctx = await getCallerProject()
  if (!ctx) throw new Error('not_authenticated')

  const admin = createAdminClient()
  const { data: cr } = await admin
    .from('webdo24_change_requests')
    .select('id, project_id, status, raw_input')
    .eq('id', id)
    .single()
  if (!cr || cr.project_id !== ctx.projectId) throw new Error('forbidden')

  await admin
    .from('webdo24_change_requests')
    .update({
      status: 'rejected',
      resolved_at: new Date().toISOString(),
      error_message: reason ?? null,
    })
    .eq('id', id)

  queueEmailToCustomer(ctx.customerId, 'change_rejected', {
    rawInput: cr.raw_input,
    reason: reason ?? '',
  }).catch((err) => console.error('[rejectChangeRequest] email failed:', err))

  await admin.from('webdo24_audit_log').insert({
    user_id: ctx.userId,
    customer_id: ctx.customerId,
    project_id: ctx.projectId,
    action: 'change.reject',
    entity: 'change_request',
    entity_id: id,
    diff: reason ? { reason } : null,
  })

  revalidatePath('/pozadavky')
  return { ok: true }
}
