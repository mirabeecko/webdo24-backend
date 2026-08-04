import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ run_id: string }> }
) {
  try {
    await requireAdmin()
    const { run_id } = await params

    if (!run_id) {
      return NextResponse.json(
        { error: 'run_id is required' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    const { data: run, error: runError } = await admin
      .from('webdo24_audit_runs')
      .select('*')
      .eq('id', run_id)
      .single()

    if (runError || !run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      )
    }

    const { data: project, error: projectError } = await admin
      .from('webdo24_audit_projects')
      .select('*')
      .eq('id', run.project_id)
      .single()

    if (projectError) {
      console.error('Project fetch error:', projectError)
    }

    const { data: findings, error: findingsError } = await admin
      .from('webdo24_audit_findings')
      .select('*')
      .eq('run_id', run_id)
      .order('severity', { ascending: false })

    if (findingsError) {
      console.error('Findings fetch error:', findingsError)
    }

    return NextResponse.json({
      project: project || null,
      run: run || null,
      findings: findings || [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Google audit detail error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
