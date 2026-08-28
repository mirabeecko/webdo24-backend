'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { queueEmailToCustomer } from '@/lib/email/queue'
import { cookies } from 'next/headers'

export async function loginAction(email: string, password: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  // Explicitně nastavit session cookies pro SSR
  const cookieStore = await cookies()
  const session = data.session
  if (session) {
    cookieStore.set('sb-access-token', session.access_token, {
      path: '/',
      maxAge: session.expires_in,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    if (session.refresh_token) {
      cookieStore.set('sb-refresh-token', session.refresh_token, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 dní
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
    }
  }

  const role = data.user?.user_metadata?.role
  const redirectTo = role === 'admin' ? '/admin' : '/dashboard'
  return { success: true, redirectTo }
}

export async function registerAction(name: string, email: string, password: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role: 'customer', name },
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.user) {
    const admin = createAdminClient()
    const customerPayload = {
      user_id: data.user.id,
      name,
      email,
      phone: '',
      company: '',
      ico: '',
      dic: '',
      address: '',
      note: '',
      telegram_phone: '',
      telegram_connected: false,
      telegram_chat_id: '',
    }

    const { data: customer, error: customerError } = await admin
      .from('webdo24_customers')
      .insert(customerPayload)
      .select('id')
      .single()

    if (customerError || !customer?.id) {
      return { error: customerError?.message ?? 'Nepodařilo se vytvořit zákaznický profil.' }
    }

    const { error: membershipError } = await admin
      .from('webdo24_customer_memberships')
      .upsert({
        customer_id: customer.id,
        user_id: data.user.id,
        role: 'owner',
      })

    if (membershipError) {
      return { error: membershipError.message }
    }

    queueEmailToCustomer(customer.id, 'welcome', {
      customerName: name,
    }).catch((err) => console.error('[registerAction] welcome email failed:', err))
  }

  return { success: true }
}
