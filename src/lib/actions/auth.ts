'use server'

import { createClient } from '@/lib/supabase/server'
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
    await supabase.from('webdo24_customers').insert({
      user_id: data.user.id,
      name,
      email,
    })
  }

  return { success: true }
}
