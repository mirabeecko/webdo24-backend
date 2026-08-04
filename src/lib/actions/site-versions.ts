'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SiteVersion, SiteSnapshot } from '@/types'

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

async function getActiveProjectForCurrentUser() {
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
    .select('id, slug, current_version_id, production_url, preview_url')
    .eq('customer_id', customer.id)
    .single()

  return project
    ? { ...project, customerId: customer.id, userId: user.id }
    : null
}

// --------------------------------------------------------------
// LIST + READ
// --------------------------------------------------------------

export async function listSiteVersions(): Promise<SiteVersion[]> {
  const project = await getActiveProjectForCurrentUser()
  if (!project) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('webdo24_site_versions')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (data as SiteVersion[]) ?? []
}

export async function getCurrentLiveVersion(): Promise<SiteVersion | null> {
  const project = await getActiveProjectForCurrentUser()
  if (!project || !project.current_version_id) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('webdo24_site_versions')
    .select('*')
    .eq('id', project.current_version_id)
    .single()

  return (data as SiteVersion | null) ?? null
}

// --------------------------------------------------------------
// CREATE DRAFT  (typically called from change-request executor)
// --------------------------------------------------------------

export async function createDraftVersion(opts: {
  projectId: string
  baseVersionId?: string | null
  snapshot: SiteSnapshot
  createdBy: 'ai' | 'admin' | 'customer' | 'system'
  createdByUserId?: string | null
  note?: string
}): Promise<SiteVersion> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('webdo24_site_versions')
    .insert({
      project_id: opts.projectId,
      parent_version_id: opts.baseVersionId ?? null,
      snapshot: opts.snapshot,
      status: 'draft',
      created_by_type: opts.createdBy,
      created_by_user_id: opts.createdByUserId ?? null,
      note: opts.note ?? null,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'create_draft_failed')
  return data as SiteVersion
}

// --------------------------------------------------------------
// PROMOTE  (publish or rollback)
// --------------------------------------------------------------

export async function promoteVersionToLive(versionId: string): Promise<{
  ok: true
  versionId: string
}> {
  const project = await getActiveProjectForCurrentUser()
  if (!project) throw new Error('not_authorized')

  // ensure version belongs to caller's project
  const supabase = await createClient()
  const { data: version } = await supabase
    .from('webdo24_site_versions')
    .select('id, project_id, status')
    .eq('id', versionId)
    .eq('project_id', project.id)
    .single()

  if (!version) throw new Error('version_not_found')

  // mutations via service role to keep RLS strict (read-only for customer)
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  // archive current live
  if (project.current_version_id && project.current_version_id !== versionId) {
    await admin
      .from('webdo24_site_versions')
      .update({ status: 'archived', archived_at: nowIso })
      .eq('id', project.current_version_id)
  }

  // mark new live
  const { error: e1 } = await admin
    .from('webdo24_site_versions')
    .update({ status: 'live', published_at: nowIso })
    .eq('id', versionId)
  if (e1) throw new Error(e1.message)

  // point project to new live
  const { error: e2 } = await admin
    .from('webdo24_projects')
    .update({ current_version_id: versionId, updated_at: nowIso })
    .eq('id', project.id)
  if (e2) throw new Error(e2.message)

  // audit
  await admin.from('webdo24_audit_log').insert({
    user_id: project.userId,
    customer_id: project.customerId,
    project_id: project.id,
    action: 'site.promote_to_live',
    entity: 'site_version',
    entity_id: versionId,
  })

  revalidatePath('/web')
  revalidatePath('/dashboard')
  return { ok: true, versionId }
}

// --------------------------------------------------------------
// ROLLBACK – syntactic sugar nad promote
// --------------------------------------------------------------

export async function rollbackToVersion(versionId: string) {
  return promoteVersionToLive(versionId)
}
