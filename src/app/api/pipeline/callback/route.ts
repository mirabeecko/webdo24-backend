import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      project_id,
      pipeline_run_id,
      status,
      output_json,
      preview_url,
      error_message,
    } = body

    if (!project_id || !pipeline_run_id || !status) {
      return NextResponse.json(
        { error: 'project_id, pipeline_run_id and status are required' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    const updateData: Record<string, unknown> = {
      status,
      finished_at: new Date().toISOString(),
    }
    if (output_json) updateData.output_json = output_json
    if (error_message) updateData.error_message = error_message

    const { error: runError } = await admin
      .from('webdo24_pipeline_runs')
      .update(updateData)
      .eq('id', pipeline_run_id)

    if (runError) {
      console.error('Failed to update pipeline run:', runError)
    }

    const projectUpdate: Record<string, unknown> = {}
    let eventType = ''
    let eventMessage = ''

    if (status === 'success') {
      projectUpdate.status = 'generated'
      if (preview_url) projectUpdate.preview_url = preview_url
      eventType = 'pipeline_success'
      eventMessage = 'Pipeline completed successfully.'
    } else if (status === 'failed') {
      projectUpdate.status = 'needs_revision'
      eventType = 'pipeline_failed'
      eventMessage = error_message || 'Pipeline failed.'
    } else {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { error: projectError } = await admin
      .from('webdo24_projects')
      .update(projectUpdate)
      .eq('id', project_id)

    if (projectError) {
      console.error('Failed to update project:', projectError)
    }

    await admin.from('webdo24_project_events').insert({
      project_id,
      event_type: eventType,
      message: eventMessage,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Pipeline callback error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
