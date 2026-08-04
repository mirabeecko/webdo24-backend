import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { ChangeStatus, ChangeCategory } from '@/types'

const ALLOWED_STATUSES = new Set<ChangeStatus>([
  'new', 'classifying', 'planning', 'executing',
  'preview_ready', 'approved', 'publishing', 'published',
  'rejected', 'failed', 'escalated',
])

export async function POST(req: NextRequest) {
  // Auth — jen admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json() as {
    id: string
    status: ChangeStatus
    category: ChangeCategory
    preview_url?: string
    draft_version_id?: string
    error_message?: string | null
  }

  if (!body.id || !ALLOWED_STATUSES.has(body.status)) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: cr } = await admin
    .from('webdo24_change_requests')
    .select('id, status, project_id')
    .eq('id', body.id)
    .single()

  if (!cr) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const update: Record<string, unknown> = {
    status: body.status,
    category: body.category,
    error_message: body.error_message ?? null,
  }
  if (body.draft_version_id) update.draft_version_id = body.draft_version_id
  if (['published', 'rejected', 'failed'].includes(body.status)) {
    update.resolved_at = new Date().toISOString()
  }

  const { error } = await admin
    .from('webdo24_change_requests')
    .update(update)
    .eq('id', body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Pokud admin nastaví preview_url + status preview_ready → aktualizuj site_version
  if (body.preview_url && body.status === 'preview_ready' && body.draft_version_id) {
    await admin
      .from('webdo24_site_versions')
      .update({ preview_url: body.preview_url, status: 'preview' })
      .eq('id', body.draft_version_id)
  }

  await admin.from('webdo24_audit_log').insert({
    user_id: user.id,
    project_id: cr.project_id,
    action: `admin.change.update`,
    entity: 'change_request',
    entity_id: body.id,
    diff: { prev_status: cr.status, new_status: body.status, category: body.category },
  })

  revalidatePath('/admin/pozadavky')
  revalidatePath(`/admin/pozadavky/${body.id}`)
  revalidatePath('/pozadavky')
  revalidatePath(`/pozadavky/${body.id}`)
  revalidatePath('/dashboard')

  return NextResponse.json({ ok: true })
}
