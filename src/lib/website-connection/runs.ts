// ============================================
// Connection Runs + Steps — auditovatelný průběh připojení
// ============================================

import { createAdminClient } from '@/lib/supabase/admin'
import type { ConnectionStepKey, StepStatus, WebsiteConnectionRun, WebsiteConnectionStep } from '@/types/website-connection'

export async function createRun(websiteId: string): Promise<WebsiteConnectionRun> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('webdo24_website_connection_runs')
    .insert({ website_id: websiteId, status: 'RUNNING' })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as WebsiteConnectionRun
}

export async function listRuns(websiteId: string): Promise<WebsiteConnectionRun[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_website_connection_runs')
    .select('*')
    .eq('website_id', websiteId)
    .order('created_at', { ascending: false })
  return (data as WebsiteConnectionRun[]) || []
}

export async function listSteps(runId: string): Promise<WebsiteConnectionStep[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_website_connection_steps')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true })
  return (data as WebsiteConnectionStep[]) || []
}

export async function setStep(runId: string, stepKey: ConnectionStepKey, status: StepStatus, message?: string, details?: Record<string, unknown>, error?: string) {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: existing } = await admin
    .from('webdo24_website_connection_steps')
    .select('id')
    .eq('run_id', runId)
    .eq('step_key', stepKey)
    .maybeSingle()

  if (existing) {
    await admin
      .from('webdo24_website_connection_steps')
      .update({
        status,
        message: message ?? null,
        details: details ?? {},
        error: error ?? null,
        finished_at: status === 'DONE' || status === 'FAILED' || status === 'SKIPPED' ? now : null,
      })
      .eq('id', (existing as { id: string }).id)
  } else {
    await admin.from('webdo24_website_connection_steps').insert({
      run_id: runId,
      step_key: stepKey,
      status,
      message: message ?? null,
      details: details ?? {},
      error: error ?? null,
      started_at: now,
      finished_at: status === 'DONE' || status === 'FAILED' || status === 'SKIPPED' ? now : null,
    })
  }
}

export async function finishRun(runId: string, result: 'SUCCESS' | 'FAILED', error?: string) {
  const admin = createAdminClient()
  await admin
    .from('webdo24_website_connection_runs')
    .update({ status: result === 'SUCCESS' ? 'COMPLETED' : 'FAILED', result, error: error ?? null, finished_at: new Date().toISOString() })
    .eq('id', runId)
}

export async function setCurrentStep(runId: string, stepKey: ConnectionStepKey | null) {
  const admin = createAdminClient()
  await admin.from('webdo24_website_connection_runs').update({ current_step: stepKey }).eq('id', runId)
}
