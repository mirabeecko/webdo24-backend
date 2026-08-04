import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { queueEmailToCustomer } from '@/lib/email/queue'

/**
 * Public endpoint for creating a lead from a customer website contact form.
 * The project_id is public on the rendered website, so we only validate
 * that the project exists.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      project_id,
      name,
      phone,
      email,
      message,
      source = 'web',
    } = body as {
      project_id?: string
      name?: string
      phone?: string
      email?: string
      message?: string
      source?: string
    }

    if (!project_id || !name || !message) {
      return NextResponse.json(
        { error: 'project_id, name and message are required' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Verify project exists and load customer
    const { data: project, error: projectError } = await admin
      .from('webdo24_projects')
      .select('id, customer_id')
      .eq('id', project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Insert lead
    const { data: lead, error: leadError } = await admin
      .from('webdo24_leads')
      .insert({
        project_id: project.id,
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        message: message.trim(),
        source: ['web', 'form', 'whatsapp', 'email', 'phone'].includes(source) ? source : 'web',
        status: 'new',
      })
      .select('id')
      .single()

    if (leadError || !lead) {
      console.error('[leads/create] insert failed:', leadError)
      return NextResponse.json(
        { error: leadError?.message || 'Failed to create lead' },
        { status: 500 }
      )
    }

    // Notify customer
    if (project.customer_id) {
      queueEmailToCustomer(project.customer_id, 'new_lead', {
        leadId: lead.id,
        leadName: name.trim(),
        leadPhone: phone?.trim() || '',
        leadEmail: email?.trim() || '',
        leadMessage: message.trim(),
      }).catch((err) => console.error('[leads/create] notification email failed:', err))
    }

    return NextResponse.json({ success: true, lead_id: lead.id })
  } catch (err) {
    console.error('[leads/create] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
