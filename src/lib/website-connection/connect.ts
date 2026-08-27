// ============================================
// Forms registry + Health check + Audit
// ============================================

import { createAdminClient } from '@/lib/supabase/admin'
import { getWebsiteBySiteId } from './registry'
import { getContentBySiteId } from './content'
import type { DiscoveredForm, HealthResult, WebsiteFormRecord } from '@/types/website-connection'

// --------------------------------------------------------------
// Form registry
// --------------------------------------------------------------

export async function upsertForms(websiteId: string, forms: DiscoveredForm[]): Promise<number> {
  const admin = createAdminClient()
  let count = 0
  for (const f of forms) {
    const { error } = await admin.from('webdo24_website_forms').upsert(
      {
        website_id: websiteId,
        form_id: f.form_id,
        name: f.name,
        source_path: f.source_path || null,
        fields_schema: f.fields,
        is_connected: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'website_id,form_id' },
    )
    if (!error) count++
  }
  return count
}

export async function listWebsiteForms(websiteId: string): Promise<WebsiteFormRecord[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_website_forms')
    .select('*')
    .eq('website_id', websiteId)
    .order('name', { ascending: true })
  return (data as WebsiteFormRecord[]) || []
}

export async function getWebsiteFormBySiteId(siteId: string, formId: string) {
  const site = await getWebsiteBySiteId(siteId)
  if (!site) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_website_forms')
    .select('*')
    .eq('website_id', site.id)
    .eq('form_id', formId)
    .maybeSingle()
  return data as WebsiteFormRecord | null
}

// --------------------------------------------------------------
// Health check
// --------------------------------------------------------------

export async function runHealthCheck(siteId: string): Promise<HealthResult> {
  const site = await getWebsiteBySiteId(siteId)
  const checks: HealthResult['checks'] = []

  if (!site) {
    return { status: 'OFFLINE', checks: [{ key: 'website', label: 'Web nalezen', ok: false, detail: 'site_id neznámý' }], content_version: null, checked_at: new Date().toISOString() }
  }

  checks.push({ key: 'website', label: 'Web registrovaný', ok: true, detail: site.title })

  // content API reachable (lokální renderer je vždy dostupný)
  let contentOk = false
  try {
    const c = await getContentBySiteId(siteId)
    contentOk = !!c
    checks.push({ key: 'content', label: 'Obsah dostupný', ok: contentOk, detail: contentOk ? `verze ${c?.version}` : undefined })
  } catch {
    checks.push({ key: 'content', label: 'Obsah dostupný', ok: false })
  }

  // forms
  const admin = createAdminClient()
  const { data: forms } = await admin.from('webdo24_website_forms').select('id, form_id, is_connected').eq('website_id', site.id)
  const connectedForms = (forms || []).filter((f: { is_connected: boolean }) => f.is_connected)
  checks.push({ key: 'forms', label: 'Formuláře propojeny', ok: connectedForms.length > 0, detail: `${connectedForms.length} formulářů` })

  // website reachable (HTTP HEAD, graceful)
  let webOk = false
  if (site.domain) {
    try {
      const res = await fetch(`https://${site.domain}/`, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000) })
      webOk = res.ok
    } catch {
      webOk = false
    }
  }
  checks.push({ key: 'reachable', label: 'Web online', ok: webOk, detail: site.domain || undefined })

  const okCount = checks.filter((c) => c.ok).length
  const status: HealthResult['status'] = okCount === checks.length ? 'HEALTHY' : okCount === 0 ? 'OFFLINE' : 'DEGRADED'

  // persist
  await admin
    .from('webdo24_projects')
    .update({ last_health_check_at: new Date().toISOString() })
    .eq('id', site.id)

  return { status, checks, content_version: contentOk ? null : null, checked_at: new Date().toISOString() }
}

// --------------------------------------------------------------
// Audit log (REUSE webdo24_audit_log)
// --------------------------------------------------------------

export async function auditWebsite(customerId: string, websiteId: string, action: string, diff: Record<string, unknown> = {}) {
  const admin = createAdminClient()
  await admin.from('webdo24_audit_log').insert({
    customer_id: customerId,
    project_id: websiteId,
    action,
    entity: 'website',
    entity_id: websiteId,
    diff,
  })
}
