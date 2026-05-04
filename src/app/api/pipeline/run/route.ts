import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { project_id, pipeline_type } = body

    if (!project_id || !pipeline_type) {
      return NextResponse.json(
        { error: 'project_id and pipeline_type are required' },
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

    const { data: files } = await admin
      .from('webdo24_project_files')
      .select('*')
      .eq('project_id', project_id)

    const inputJson = {
      project,
      brief: brief || null,
      files: files || [],
    }

    const { data: pipelineRun, error: runError } = await admin
      .from('webdo24_pipeline_runs')
      .insert({
        project_id,
        pipeline_type,
        status: 'running',
        input_json: inputJson,
      })
      .select()
      .single()

    if (runError || !pipelineRun) {
      return NextResponse.json(
        { error: 'Failed to create pipeline run', details: runError },
        { status: 500 }
      )
    }

    await admin
      .from('webdo24_projects')
      .update({ status: 'generating', pipeline_type })
      .eq('id', project_id)

    const n8nUrl = process.env.N8N_PIPELINE_WEBHOOK_URL
    let n8nResponse = null
    let n8nError = null

    if (n8nUrl) {
      try {
        const res = await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id,
            pipeline_run_id: pipelineRun.id,
            pipeline_type,
            data: inputJson,
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
      event_type: 'pipeline_started',
      message: `Pipeline ${pipeline_type} started. Run ID: ${pipelineRun.id}`,
    })

    return NextResponse.json({
      success: true,
      pipeline_run: pipelineRun,
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
    console.error('Pipeline run error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
