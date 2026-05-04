import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await request.json()

    const admin = createAdminClient()

    const { error } = await admin
      .from('webdo24_projects')
      .update(body)
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update project', details: error },
        { status: 500 }
      )
    }

    await admin.from('webdo24_project_events').insert({
      project_id: id,
      event_type: 'project_updated',
      message: `Project updated: ${JSON.stringify(body)}`,
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
    console.error('Update project error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
