import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { queueEmailToCustomer } from '@/lib/email/queue'
import type { ChangeStatus } from '@/types'

// n8n autentizace přes sdílený secret v hlavičce X-Webhook-Secret
const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET

// Allowed status transitions that n8n may set
const ALLOWED_STATUSES = new Set<ChangeStatus>([
  'planning', 'executing', 'preview_ready', 'published', 'failed', 'escalated',
])

export async function POST(req: NextRequest) {
  // Ověření identita volajícího
  if (WEBHOOK_SECRET) {
    const incoming = req.headers.get('x-webhook-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
    if (incoming !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const {
    change_request_id,
    status,
    preview_url,
    draft_version_id,
    error_message,
    note,
  } = body as Record<string, string | undefined>

  if (!change_request_id) {
    return NextResponse.json({ error: 'missing_change_request_id' }, { status: 400 })
  }
  if (!status || !ALLOWED_STATUSES.has(status as ChangeStatus)) {
    return NextResponse.json({ error: `invalid_status: ${status}` }, { status: 400 })
  }

  const admin = createAdminClient()

  // Načti aktuální request (ověř existenci)
  const { data: cr, error: fetchErr } = await admin
    .from('webdo24_change_requests')
    .select('id, project_id, status, raw_input')
    .eq('id', change_request_id)
    .single()

  if (fetchErr || !cr) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Build update payload
  const update: Record<string, unknown> = {
    status,
    error_message: error_message ?? null,
  }
  if (draft_version_id) update.draft_version_id = draft_version_id
  if (preview_url && status === 'preview_ready') {
    // ukládáme preview_url do draft_version nebo jako poznámku
  }
  if (status === 'published') {
    update.resolved_at = new Date().toISOString()
    if (draft_version_id) update.published_version_id = draft_version_id
  }
  if (status === 'failed') {
    update.resolved_at = new Date().toISOString()
  }

  const { error: updateErr } = await admin
    .from('webdo24_change_requests')
    .update(update)
    .eq('id', change_request_id)

  if (updateErr) {
    console.error('[n8n webhook] update failed:', updateErr.message)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Audit log
  await admin.from('webdo24_audit_log').insert({
    project_id: cr.project_id,
    action: `change.status.${status}`,
    entity: 'change_request',
    entity_id: change_request_id,
    diff: {
      prev_status: cr.status,
      new_status: status,
      preview_url: preview_url ?? null,
      note: note ?? null,
    },
  })

  // Pokud je preview_ready — aktualizuj draft site version s preview URL
  if (status === 'preview_ready' && preview_url && draft_version_id) {
    await admin
      .from('webdo24_site_versions')
      .update({ preview_url, status: 'preview' })
      .eq('id', draft_version_id)
  }

  // Send customer notifications for key states
  if (status === 'preview_ready' || status === 'published' || status === 'failed') {
    const { data: project } = await admin
      .from('webdo24_projects')
      .select('customer_id, slug, production_url')
      .eq('id', cr.project_id)
      .single()

    if (project?.customer_id) {
      const websiteUrl = project.production_url || `https://web.webdo24.cz/${project.slug}/`

      if (status === 'preview_ready') {
        queueEmailToCustomer(project.customer_id, 'change_request_preview_ready', {
          rawInput: cr.raw_input,
          changeRequestId: change_request_id,
          previewUrl: preview_url,
        }).catch((err) => console.error('[n8n webhook] preview email failed:', err))
      }

      if (status === 'published') {
        queueEmailToCustomer(project.customer_id, 'change_published', {
          rawInput: cr.raw_input,
          changeRequestId: change_request_id,
          websiteUrl,
        }).catch((err) => console.error('[n8n webhook] published email failed:', err))
      }
    }
  }

  return NextResponse.json({ ok: true, new_status: status })
}
