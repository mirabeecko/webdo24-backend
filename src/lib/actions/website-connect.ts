'use server'

// ============================================
// Website Connection Manager — server actions
// Orchestrace průvodce „Připojit web"
// ============================================

import { getCurrentUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { registerWebsite, getWebsite, listWebsites, setConnectionStatus, ensureSiteId } from '@/lib/website-connection/registry'
import { createRun, finishRun, setStep, setCurrentStep } from '@/lib/website-connection/runs'
import { runDiscovery } from '@/lib/website-connection/discovery'
import { importContent, getContentBySiteId } from '@/lib/website-connection/content'
import { upsertForms, listWebsiteForms, runHealthCheck, auditWebsite } from '@/lib/website-connection/connect'
import type { ConnectionStepKey, DiscoveredContent, DiscoveredForm, DiscoveryResult } from '@/types/website-connection'

const CONNECTOR_VERSION = '1.0.0'

async function ctx() {
  const user = await getCurrentUser()
  if (!user) throw new Error('not_authenticated')
  const admin = createAdminClient()
  const { data: customer } = await admin.from('webdo24_customers').select('id').eq('user_id', user.id).maybeSingle()
  if (!customer) throw new Error('not_authenticated')
  return { userId: user.id, customerId: customer.id as string }
}

// --------------------------------------------------------------
// Seznam a detail
// --------------------------------------------------------------

export async function listConnectedWebsites() {
  const c = await ctx()
  return listWebsites(c.customerId)
}

export async function getWebsiteDetail(websiteId: string) {
  const c = await ctx()
  const website = await getWebsite(c.customerId, websiteId)
  if (!website) return null
  const admin = createAdminClient()
  const [{ data: runs }, { data: steps }, forms] = await Promise.all([
    admin.from('webdo24_website_connection_runs').select('*').eq('website_id', websiteId).order('created_at', { ascending: false }).limit(10),
    admin.from('webdo24_website_connection_steps').select('*').in('run_id', [] as string[]).order('created_at', { ascending: true }),
    listWebsiteForms(websiteId),
  ])
  const runIds = (runs || []).map((r: { id: string }) => r.id)
  const { data: allSteps } = runIds.length
    ? await admin.from('webdo24_website_connection_steps').select('*').in('run_id', runIds).order('created_at', { ascending: true })
    : { data: [] }
  const { data: leads } = await admin
    .from('webdo24_leads')
    .select('*')
    .eq('project_id', websiteId)
    .order('created_at', { ascending: false })
    .limit(50)
  return { website, runs, steps: allSteps || steps, forms, leads }
}

// --------------------------------------------------------------
// Průvodce — krok 1: registrace + discovery + audit
// --------------------------------------------------------------

export interface StartConnectionInput {
  name: string
  domain: string
  connectionMethod: 'local' | 'github' | 'git' | 'deployment'
  localPath?: string
  repositoryUrl?: string
  repositoryBranch?: string
}

export async function startConnection(input: StartConnectionInput) {
  const c = await ctx()
  const website = await registerWebsite({
    customerId: c.customerId,
    name: input.name,
    domain: input.domain,
    connectionMethod: input.connectionMethod,
    localPath: input.localPath,
    repositoryUrl: input.repositoryUrl,
    repositoryBranch: input.repositoryBranch,
  })
  const run = await createRun(website.id)
  await setCurrentStep(run.id, 'DISCOVERY')

  // DISCOVERY + AUDIT
  await setStep(run.id, 'DISCOVERY', 'RUNNING', 'Analyzuji projekt…')
  const discovery = runDiscovery(input.localPath || null)
  await setStep(run.id, 'DISCOVERY', 'DONE', `Framework: ${discovery.framework}`, { framework: discovery.framework, forms: discovery.forms.length, content: discovery.content.length })

  await setStep(run.id, 'AUDIT', 'RUNNING', 'Audituji web…')
  await setStep(run.id, 'AUDIT', 'DONE', `Nalezeno ${discovery.content.length} polí obsahu, ${discovery.forms.length} formulářů`, { warnings: discovery.warnings })

  await setConnectionStatus(c.customerId, website.id, 'AUDITING')
  await updateWebsiteMeta(website.id, { framework: discovery.framework })
  await auditWebsite(c.customerId, website.id, 'website.connection.started', { domain: input.domain, method: input.connectionMethod })

  revalidatePath('/weby')
  return { websiteId: website.id, runId: run.id, discovery }
}

async function updateWebsiteMeta(websiteId: string, patch: Record<string, unknown>) {
  const admin = createAdminClient()
  await admin.from('webdo24_projects').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', websiteId)
}

// --------------------------------------------------------------
// Průvodce — krok 2: dokončení (import, forms, connect, verify)
// --------------------------------------------------------------

export async function completeConnection(websiteId: string, runId: string, discovery: DiscoveryResult) {
  const c = await ctx()
  const website = await getWebsite(c.customerId, websiteId)
  if (!website) throw new Error('Web nenalezen')

  const siteId = await ensureSiteId(c.customerId, websiteId)
  const mark = async (key: ConnectionStepKey, fn: () => Promise<void>) => {
    await setCurrentStep(runId, key)
    await setStep(runId, key, 'RUNNING', `Krok: ${key}`)
    try {
      await fn()
      await setStep(runId, key, 'DONE')
    } catch (e) {
      await setStep(runId, key, 'FAILED', undefined, undefined, e instanceof Error ? e.message : String(e))
      throw e
    }
  }

  await setConnectionStatus(c.customerId, websiteId, 'INSTALLING')
  await mark('REGISTER', async () => {})
  await mark('CONTENT_DISCOVERY', async () => {})
  await mark('FORM_DISCOVERY', async () => {})

  await mark('CONNECTOR_INSTALL', async () => {
    await updateWebsiteMeta(websiteId, { connector_version: CONNECTOR_VERSION })
  })

  await mark('CONTENT_CONNECT', async () => {
    const imported = await importContent(websiteId, c.customerId, discovery.content as DiscoveredContent[])
    await setStep(runId, 'CONTENT_CONNECT', 'DONE', `Importováno ${imported} polí obsahu`, { imported })
  })

  await mark('FORM_CONNECT', async () => {
    const n = await upsertForms(websiteId, discovery.forms as DiscoveredForm[])
    await updateWebsiteMeta(websiteId, { forms_connected: n > 0 })
    await setStep(runId, 'FORM_CONNECT', 'DONE', `Propojeno ${n} formulářů`, { count: n })
  })

  await mark('TRACKING_CONNECT', async () => {
    await updateWebsiteMeta(websiteId, { tracking_connected: true })
  })

  await mark('VERIFY_CONTENT', async () => {
    const content = await getContentBySiteId(siteId)
    if (!content) throw new Error('Obsah se nepodařilo ověřit')
  })

  await mark('VERIFY_FORMS', async () => {
    const forms = await listWebsiteForms(websiteId)
    if (forms.length === 0) throw new Error('Žádné formuláře k ověření')
  })

  await mark('HEALTH_CHECK', async () => {
    await runHealthCheck(siteId)
  })

  await mark('COMPLETE', async () => {})

  await setConnectionStatus(c.customerId, websiteId, 'CONNECTED')
  await finishRun(runId, 'SUCCESS')
  await setCurrentStep(runId, null)
  await auditWebsite(c.customerId, websiteId, 'website.connected', { site_id: siteId, connector_version: CONNECTOR_VERSION })

  revalidatePath('/weby')
  return { ok: true, siteId }
}

// --------------------------------------------------------------
// Odpojení / znovupřipojení
// --------------------------------------------------------------

export async function disconnectWebsite(websiteId: string) {
  const c = await ctx()
  await setConnectionStatus(c.customerId, websiteId, 'DISCONNECTED')
  await updateWebsiteMeta(websiteId, { content_connected: false, forms_connected: false, tracking_connected: false })
  await auditWebsite(c.customerId, websiteId, 'website.disconnected')
  revalidatePath('/weby')
  return { ok: true }
}

export async function reconnectWebsite(websiteId: string) {
  const c = await ctx()
  await setConnectionStatus(c.customerId, websiteId, 'READY')
  const run = await createRun(websiteId)
  await auditWebsite(c.customerId, websiteId, 'website.reconnect.started')
  revalidatePath('/weby')
  return { runId: run.id }
}

export async function websiteHealth(websiteId: string) {
  const c = await ctx()
  const website = await getWebsite(c.customerId, websiteId)
  if (!website || !website.site_id) return null
  return runHealthCheck(website.site_id)
}
