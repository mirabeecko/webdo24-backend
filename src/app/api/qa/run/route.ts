import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { project_id } = body

    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    const { data: project, error: projectError } = await admin
      .from('webdo24_projects')
      .select('*')
      .eq('id', project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { data: brief } = await admin
      .from('webdo24_project_briefs')
      .select('*')
      .eq('project_id', project_id)
      .single()

    // Update status to qa_check
    await admin
      .from('webdo24_projects')
      .update({ status: 'qa_check' })
      .eq('id', project_id)

    // Call n8n QA webhook
    const n8nUrl = process.env.N8N_QA_WEBHOOK_URL
    let n8nResponse = null
    let n8nError = null

    if (n8nUrl) {
      try {
        const res = await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id,
            preview_url: project.preview_url,
            brief: brief || null,
            project,
            callback_url: `${process.env.APP_URL}/api/pipeline/callback`,
          }),
        })
        n8nResponse = { status: res.status, ok: res.ok }
      } catch (err) {
        n8nError = err instanceof Error ? err.message : String(err)
      }
    }

    await admin.from('webdo24_project_events').insert({
      project_id,
      event_type: 'qa_started',
      message: 'QA check started.',
    })

    return NextResponse.json({
      success: true,
      n8n_response: n8nResponse,
      n8n_error: n8nError,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('QA run error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
