import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { project_id, production_url } = body

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

    const updateData: Record<string, unknown> = {
      status: 'deployed',
    }
    if (production_url) updateData.production_url = production_url

    const { error } = await admin
      .from('webdo24_projects')
      .update(updateData)
      .eq('id', project_id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to deploy project', details: error },
        { status: 500 }
      )
    }

    await admin.from('webdo24_project_events').insert({
      project_id,
      event_type: 'deployed',
      message: `Project deployed. Production URL: ${production_url || project.production_url || 'N/A'}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Deploy error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
