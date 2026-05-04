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

    const admin = createAdminClient()

    const { data: invoice, error: fetchError } = await admin
      .from('webdo24_invoices')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const { error } = await admin
      .from('webdo24_invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update invoice', details: error },
        { status: 500 }
      )
    }

    if (invoice.project_id) {
      await admin.from('webdo24_project_events').insert({
        project_id: invoice.project_id,
        event_type: 'invoice_paid',
        message: `Invoice ${invoice.amount} ${invoice.currency} marked as paid`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Pay invoice error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
