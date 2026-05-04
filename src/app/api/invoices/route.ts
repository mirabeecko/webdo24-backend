import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { customer_id, project_id, amount, currency, payment_type, due_date } = body

    if (!customer_id || !amount) {
      return NextResponse.json(
        { error: 'customer_id and amount are required' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    const { data: invoice, error } = await admin
      .from('webdo24_invoices')
      .insert({
        customer_id,
        project_id: project_id || null,
        amount,
        currency: currency || 'CZK',
        payment_type: payment_type || 'one_time',
        due_date: due_date || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error || !invoice) {
      return NextResponse.json(
        { error: 'Failed to create invoice', details: error },
        { status: 500 }
      )
    }

    if (project_id) {
      await admin.from('webdo24_project_events').insert({
        project_id,
        event_type: 'invoice_created',
        message: `Invoice created: ${amount} ${invoice.currency}`,
      })
    }

    return NextResponse.json({ success: true, invoice })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Invoice create error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
