'use server'

import { createClient } from '@/lib/supabase/server'
import { getAppCustomerContext, requireAppCustomerContext } from '@/lib/customer-context'
import { revalidatePath } from 'next/cache'

export async function getProfile() {
  const context = await getAppCustomerContext()
  return context?.customer ?? null
}

export async function updateProfile(updates: {
  name?: string
  company?: string
  phone?: string
  ico?: string
  dic?: string
  address?: string
}) {
  const context = await requireAppCustomerContext()
  const supabase = await createClient()

  // Sanitize — email se mění přes Supabase Auth, ne tady
  const allowed = ['name', 'company', 'phone', 'ico', 'dic', 'address'] as const
  const safe = Object.fromEntries(
    allowed.filter((k) => k in updates).map((k) => [k, updates[k]])
  )

  const { data, error } = await supabase
    .from('webdo24_customers')
    .update(safe)
    .eq('id', context.customer.id)
    .select()

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Profil se nepodařilo uložit. Zkontroluj oprávnění v databázi.')

  revalidatePath('/nastaveni')
}

export async function sendChangeEmailLink(newEmail: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ email: newEmail })
  if (error) throw new Error(error.message)
}

export async function getAutomations() {
  const context = await getAppCustomerContext()
  if (!context) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('webdo24_automations')
    .select('*')
    .eq('customer_id', context.customer.id)

  return data || []
}

export async function toggleAutomation(id: string, enabled: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('webdo24_automations')
    .update({ enabled })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/nastaveni')
}

export async function getEmailPrefs() {
  const context = await getAppCustomerContext()
  if (!context) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('webdo24_customer_email_prefs')
    .select('*')
    .eq('customer_id', context.customer.id)
    .single()

  return data
}

export async function updateEmailPrefs(prefs: { notifications_enabled?: boolean; marketing_enabled?: boolean }) {
  const context = await requireAppCustomerContext()
  const supabase = await createClient()

  const { error } = await supabase
    .from('webdo24_customer_email_prefs')
    .upsert({
      customer_id: context.customer.id,
      notifications_enabled: prefs.notifications_enabled ?? true,
      marketing_enabled: prefs.marketing_enabled ?? true,
      updated_at: new Date().toISOString(),
    })

  if (error) throw new Error(error.message)
  revalidatePath('/nastaveni')
}
