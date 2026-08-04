'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getCustomer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: customer } = await supabase
    .from('webdo24_customers')
    .select('id, telegram_phone, telegram_connected, telegram_chat_id')
    .eq('user_id', user.id)
    .single()
  return customer
}

async function getCustomerProject() {
  const customer = await getCustomer()
  if (!customer) return null

  const supabase = await createClient()
  const { data: project } = await supabase
    .from('webdo24_projects')
    .select('id, sandbox_enabled, sandbox_url, custom_domain, custom_domain_verified, production_url, status')
    .eq('customer_id', customer.id)
    .single()
  return project
}

// ── TELEGRAM ──

export async function getTelegramSettings() {
  const customer = await getCustomer()
  if (!customer) return null
  return {
    telegram_phone: customer.telegram_phone,
    telegram_connected: customer.telegram_connected,
  }
}

export async function saveTelegramPhone(phone: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nejste přihlášen')

  const { error } = await supabase
    .from('webdo24_customers')
    .update({ telegram_phone: phone })
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/nastaveni')
}

// ── SANDBOX ──

export async function getSandboxStatus() {
  const project = await getCustomerProject()
  if (!project) return null
  return {
    sandbox_enabled: project.sandbox_enabled,
    sandbox_url: project.sandbox_url,
    production_url: project.production_url,
    status: project.status,
  }
}

export async function toggleSandbox(enabled: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nejste přihlášen')

  const { data: customer } = await supabase
    .from('webdo24_customers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!customer) throw new Error('Zákazník nenalezen')

  const { error } = await supabase
    .from('webdo24_projects')
    .update({ sandbox_enabled: enabled })
    .eq('customer_id', customer.id)

  if (error) throw new Error(error.message)
  revalidatePath('/nastaveni')
}

// ── CUSTOM DOMAIN ──

export async function getDomainSettings() {
  const project = await getCustomerProject()
  if (!project) return null
  return {
    custom_domain: project.custom_domain,
    custom_domain_verified: project.custom_domain_verified,
  }
}

export async function saveCustomDomain(domain: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nejste přihlášen')

  const { data: customer } = await supabase
    .from('webdo24_customers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!customer) throw new Error('Zákazník nenalezen')

  const token = `webdo24-verify-${crypto.randomUUID().slice(0, 8)}`

  const { error } = await supabase
    .from('webdo24_projects')
    .update({
      custom_domain: domain,
      custom_domain_verified: false,
      custom_domain_verification_token: token,
    })
    .eq('customer_id', customer.id)

  if (error) throw new Error(error.message)
  revalidatePath('/nastaveni')
}

// ── UPDATE SUGGESTIONS ──

export async function getUpdateSuggestions() {
  const project = await getCustomerProject()
  if (!project) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('webdo24_update_suggestions')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(5)

  return data || []
}

export async function acceptSuggestion(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('webdo24_update_suggestions')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/nastaveni')
}

export async function dismissSuggestion(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('webdo24_update_suggestions')
    .update({ status: 'dismissed' })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/nastaveni')
}
