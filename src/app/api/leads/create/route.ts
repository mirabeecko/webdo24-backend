import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { queueEmailToCustomer } from '@/lib/email/queue'
import { generateAutoReplyForLead } from '@/lib/actions/crm'

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
      company,
      budget,
      preferred_date,
    } = body as {
      project_id?: string
      name?: string
      phone?: string
      email?: string
      message?: string
      source?: string
      company?: string
      budget?: string
      preferred_date?: string
    }

    if (!project_id || !name || !message) {
      return NextResponse.json(
        { error: 'project_id, name and message are required' },
        { status: 400 }
      )
    }

    // ── Strukturovaná pole z textu poptávky (formulář na webu) ──
    // Web posílá řádky „Lokalita: …“, „Typ práce: …“, „Termín: …“ — parsujeme
    // je do metadata, aby CRM ukázalo „co poptává / kdy / kde“ strukturovaně.
    const msg = message.trim()
    const pick = (label: string) => {
      const m = msg.match(new RegExp(`${label}:\\s*(.+)`, 'i'))
      return m ? m[1].trim() : null
    }
    const metadata: Record<string, unknown> = {}
    const location = pick('Lokalita')
    const requestType = pick('Typ práce') || pick('Job')
    const parsedDate = pick('Termín')
    if (location) metadata.location = location
    if (requestType) metadata.request_type = requestType
    if (company) metadata.company = company.trim()
    if (budget) metadata.budget = budget.trim()
    if (preferred_date || parsedDate) metadata.preferred_date = preferred_date?.trim() || parsedDate

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
        message: msg,
        source: ['web', 'form', 'whatsapp', 'email', 'phone'].includes(source) ? source : 'web',
        status: 'new',
        metadata,
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

    // Automatická AI odpověď (fire-and-forget — nikdy neblokuje odpověď
    // formuláře; pokud má zákazník zapnuté ai_reply/auto_reply, vygeneruje
    // se návrh odpovědi do CRM)
    if (project.customer_id) {
      generateAutoReplyForLead({
        leadId: lead.id,
        projectId: project.id,
        customerId: project.customer_id,
        name: name.trim(),
        phone: phone?.trim(),
        email: email?.trim(),
        message: message.trim(),
      })
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
