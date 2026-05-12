'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: customer } = await supabase
    .from('webdo24_customers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return customer
}

export async function updateProfile(updates: { name?: string; company?: string; phone?: string; email?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nejste přihlášen')

  const { error } = await supabase
    .from('webdo24_customers')
    .update(updates)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/nastaveni')
}

export async function getAutomations() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: customer } = await supabase
    .from('webdo24_customers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!customer) return []

  const { data } = await supabase
    .from('webdo24_automations')
    .select('*')
    .eq('customer_id', customer.id)

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
