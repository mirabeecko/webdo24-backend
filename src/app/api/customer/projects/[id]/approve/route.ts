import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser, getCustomerId } from '@/lib/auth'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const customerId = await getCustomerId(user.id)

    const admin = createAdminClient()

    // Verify ownership
    const { data: project, error: projectError } = await admin
      .from('webdo24_projects')
      .select('customer_id')
      .eq('id', id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const isAdmin = user.user_metadata?.role === 'admin'
    if (!isAdmin && project.customer_id !== customerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await admin
      .from('webdo24_projects')
      .update({ status: 'approved' })
      .eq('id', id)

    await admin.from('webdo24_project_events').insert({
      project_id: id,
      user_id: user.id,
      event_type: 'customer_approved',
      message: 'Customer approved the website',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Approve error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
