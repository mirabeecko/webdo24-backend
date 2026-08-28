'use server'

import { createClient } from '@/lib/supabase/server'
import { getAppCustomerContext, requireAppCustomerContext } from '@/lib/customer-context'
import { revalidatePath } from 'next/cache'

// Graceful wrappers that don't crash on missing columns/tables
// Run sql/010_mvp_telegram_sandbox_domain.sql in Supabase SQL Editor to enable all features

async function getCustomerSafe() {
  try {
    const context = await getAppCustomerContext()
    if (!context) return null
    return {
      id: context.customer.id,
      telegram_phone: context.customer.telegram_phone ?? null,
      telegram_connected: context.customer.telegram_connected ?? false,
      telegram_chat_id: context.customer.telegram_chat_id ?? null,
    }
  } catch { return null }
}

async function getProjectSafe() {
  try {
    const context = await getAppCustomerContext()
    return context?.project ?? null
  } catch { return null }
}

// ── TELEGRAM ──

export async function getTelegramSettings() {
  try {
    const customer = await getCustomerSafe()
    if (!customer) return null
    return {
      telegram_phone: (customer as any).telegram_phone ?? null,
      telegram_connected: (customer as any).telegram_connected ?? false,
    }
  } catch { return null }
}

export async function saveTelegramPhone(phone: string) {
  try {
    const context = await requireAppCustomerContext()
    const supabase = await createClient()
    const { error } = await supabase
      .from('webdo24_customers')
      .update({ telegram_phone: phone } as any)
      .eq('id', context.customer.id)
    if (error) throw new Error(error.message)
    revalidatePath('/nastaveni')
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Chyba při ukládání')
  }
}

// ── SANDBOX ──

export async function getSandboxStatus() {
  try {
    const project = await getProjectSafe()
    if (!project) return null
    return {
      sandbox_enabled: (project as any).sandbox_enabled ?? true,
      sandbox_url: (project as any).sandbox_url ?? null,
      production_url: (project as any).production_url ?? null,
      status: (project as any).status ?? 'draft',
    }
  } catch { return null }
}

export async function toggleSandbox(enabled: boolean) {
  try {
    const context = await requireAppCustomerContext()
    if (!context.project) throw new Error('Projekt nenalezen')
    const supabase = await createClient()
    const { error } = await supabase
      .from('webdo24_projects')
      .update({ sandbox_enabled: enabled } as any)
      .eq('id', context.project.id)
    if (error) throw new Error(error.message)
    revalidatePath('/nastaveni')
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Chyba při ukládání')
  }
}

// ── CUSTOM DOMAIN ──

export async function getDomainSettings() {
  try {
    const project = await getProjectSafe()
    if (!project) return null
    return {
      custom_domain: (project as any).custom_domain ?? null,
      custom_domain_verified: (project as any).custom_domain_verified ?? false,
      custom_domain_verification_token: (project as any).custom_domain_verification_token ?? null,
    }
  } catch { return null }
}

export async function saveCustomDomain(domain: string) {
  try {
    const context = await requireAppCustomerContext()
    if (!context.project) throw new Error('Projekt nenalezen')
    const supabase = await createClient()
    const token = `webdo24-verify-${crypto.randomUUID().slice(0, 8)}`
    const { error } = await supabase
      .from('webdo24_projects')
      .update({
        custom_domain: domain,
        custom_domain_verified: false,
        custom_domain_verification_token: token,
      } as any)
      .eq('id', context.project.id)
    if (error) throw new Error(error.message)
    revalidatePath('/nastaveni')
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Chyba při ukládání')
  }
}

// ── UPDATE SUGGESTIONS ──

export async function getUpdateSuggestions() {
  try {
    const project = await getProjectSafe()
    if (!project) return []
    const supabase = await createClient()
    const { data } = await supabase
      .from('webdo24_update_suggestions')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(5)
    return data || []
  } catch { return [] }
}

export async function acceptSuggestion(id: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('webdo24_update_suggestions')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() } as any)
      .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/nastaveni')
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Chyba')
  }
}

export async function dismissSuggestion(id: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('webdo24_update_suggestions')
      .update({ status: 'dismissed' } as any)
      .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/nastaveni')
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Chyba')
  }
}
