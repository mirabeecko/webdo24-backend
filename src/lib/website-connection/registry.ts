// ============================================
// Website Registry — registrace a stav připojených webů
// (rozšíření webdo24_projects = entita Website)
// ============================================

import { createAdminClient } from '@/lib/supabase/admin'
import { generateSiteId, isValidSiteId, normalizeDomain } from './site-id'
import { canTransition } from './status'
import type { ConnectedWebsite, ConnectionStatus } from '@/types/website-connection'

export async function listWebsites(customerId: string): Promise<ConnectedWebsite[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('webdo24_projects')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as ConnectedWebsite[]) || []
}

export async function getWebsite(customerId: string, websiteId: string): Promise<ConnectedWebsite | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_projects')
    .select('*')
    .eq('id', websiteId)
    .eq('customer_id', customerId)
    .maybeSingle()
  return (data as ConnectedWebsite) || null
}

export async function getWebsiteBySiteId(siteId: string): Promise<ConnectedWebsite | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('webdo24_projects')
    .select('*')
    .eq('site_id', siteId)
    .maybeSingle()
  return (data as ConnectedWebsite) || null
}

export interface RegisterWebsiteInput {
  customerId: string
  name: string
  domain: string
  connectionMethod: 'local' | 'github' | 'git' | 'deployment'
  localPath?: string
  repositoryUrl?: string
  repositoryBranch?: string
  framework?: string
}

/** Registruje nový web (projekt) a přidělí mu veřejný site_id. */
export async function registerWebsite(input: RegisterWebsiteInput): Promise<ConnectedWebsite> {
  const admin = createAdminClient()
  const siteId = generateSiteId()
  const allowed = [normalizeDomain(input.domain)]
  const { data, error } = await admin
    .from('webdo24_projects')
    .insert({
      customer_id: input.customerId,
      title: input.name,
      domain: normalizeDomain(input.domain),
      slug: `web-${siteId}`, // unikátní fallback slug
      site_id: siteId,
      status: 'deployed',
      language: 'cs',
      connection_status: 'DRAFT' as ConnectionStatus,
      connection_method: input.connectionMethod,
      framework: input.framework || null,
      local_path: input.localPath || null,
      repository_url: input.repositoryUrl || null,
      repository_branch: input.repositoryBranch || null,
      allowed_domains: allowed,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as ConnectedWebsite
}

export async function setConnectionStatus(
  customerId: string,
  websiteId: string,
  to: ConnectionStatus,
): Promise<ConnectedWebsite> {
  const admin = createAdminClient()
  const existing = await getWebsite(customerId, websiteId)
  if (!existing) throw new Error('Web nenalezen')
  const from = (existing.connection_status || 'DRAFT') as ConnectionStatus
  if (from !== to && !canTransition(from, to)) {
    throw new Error(`Nepovolený přechod stavu ${from} → ${to}`)
  }
  const { data, error } = await admin
    .from('webdo24_projects')
    .update({ connection_status: to, updated_at: new Date().toISOString() })
    .eq('id', websiteId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as ConnectedWebsite
}

export async function updateWebsiteConnection(customerId: string, websiteId: string, patch: Record<string, unknown>) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('webdo24_projects')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', websiteId)
    .eq('customer_id', customerId)
  if (error) throw new Error(error.message)
}

export async function ensureSiteId(customerId: string, websiteId: string): Promise<string> {
  const existing = await getWebsite(customerId, websiteId)
  if (!existing) throw new Error('Web nenalezen')
  if (isValidSiteId(existing.site_id)) return existing.site_id
  const siteId = generateSiteId()
  await updateWebsiteConnection(customerId, websiteId, { site_id: siteId })
  return siteId
}
