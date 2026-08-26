import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { queueEmailToCustomer } from '@/lib/email/queue'
import { generateAutoReplyForLead } from '@/lib/actions/crm'
import type { FormField } from '@/lib/actions/sales'

/**
 * Public endpoint pro odeslání vyplněného formuláře (form builder).
 * Vytvoří poptávku (lead) → objeví se v CRM (Poptávky).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: formId } = await params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    const admin = createAdminClient()
    const { data: form } = await admin
      .from('webdo24_forms')
      .select('id, customer_id, project_id, name, fields, success_message')
      .eq('id', formId)
      .eq('status', 'active')
      .maybeSingle()

    if (!form) {
      return NextResponse.json({ error: 'Formulář neexistuje' }, { status: 404 })
    }

    const fields = (form.fields as FormField[]) || []
    // z odpovědí najdi jméno / e-mail / telefon (heuristika)
    let name = ''
    let email = ''
    let phone = ''
    const lines: string[] = []
    for (const f of fields) {
      const v = String(body[f.id] ?? '').trim()
      if (!v) continue
      if (!name && (f.label.toLowerCase().includes('jméno') || f.label.toLowerCase().includes('jmeno') || f.type === 'text')) {
        if (f.label.toLowerCase().includes('jméno') || f.label.toLowerCase().includes('jmeno')) name = v
      }
      if (!email && f.type === 'email') email = v
      if (!phone && f.type === 'phone') phone = v
      lines.push(`${f.label}: ${v}`)
    }
    if (!name && fields.length && body[fields[0].id]) name = String(body[fields[0].id]).trim()
    if (!name) name = 'Poptávka z formuláře'

    const message = lines.join('\n') || 'Poptávka z formuláře'

    const { data: lead, error: leadError } = await admin
      .from('webdo24_leads')
      .insert({
        project_id: form.project_id,
        name,
        phone: phone || null,
        email: email || null,
        message,
        source: 'form',
        status: 'new',
        metadata: { form_id: form.id, form_name: form.name, raw: body },
      })
      .select('id')
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Chyba při ukládání' }, { status: 500 })
    }

    // notifikace majiteli + případná AI auto-odpověď
    if (form.customer_id) {
      queueEmailToCustomer(form.customer_id, 'new_lead', {
        leadId: lead.id,
        leadName: name,
        leadPhone: phone,
        leadEmail: email,
        leadMessage: message,
      }).catch(() => {})
      generateAutoReplyForLead({
        leadId: lead.id,
        projectId: form.project_id,
        customerId: form.customer_id,
        name,
        phone,
        email,
        message,
      })
    }

    return NextResponse.json({ success: true, message: form.success_message || 'Děkujeme, formulář byl odeslán.' })
  } catch (err) {
    console.error('[forms/submit] error:', err)
    return NextResponse.json({ error: 'Chyba serveru' }, { status: 500 })
  }
}
