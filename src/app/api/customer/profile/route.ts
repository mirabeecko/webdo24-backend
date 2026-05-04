import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser, getCustomerId } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, phone, company, ico, dic, address } = body

    const customerId = await getCustomerId(user.id)
    if (!customerId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const admin = createAdminClient()

    const { data: customer, error } = await admin
      .from('webdo24_customers')
      .update({ name, phone, company, ico, dic, address })
      .eq('id', customerId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update profile', details: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, customer })
  } catch (err) {
    console.error('Profile update error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
