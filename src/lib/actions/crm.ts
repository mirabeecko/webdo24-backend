'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getLeads() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: customer } = await supabase
    .from('webdo24_customers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!customer) return []

  const { data: project } = await supabase
    .from('webdo24_projects')
    .select('id')
    .eq('customer_id', customer.id)
    .single()

  if (!project) return []

  const { data: leads } = await supabase
    .from('webdo24_leads')
    .select('*, messages:webdo24_messages(id, sender_type, content, created_at)')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })

  return leads || []
}

export async function updateLeadStatus(leadId: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('webdo24_leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) throw new Error(error.message)
  revalidatePath('/zakaznici')
}

export async function getMessages(leadId: string) {
  const supabase = await createClient()
  const { data: messages } = await supabase
    .from('webdo24_messages')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })

  return messages || []
}

export async function sendMessage(leadId: string, content: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('webdo24_messages')
    .insert({ lead_id: leadId, sender_type: 'user', content })

  if (error) throw new Error(error.message)
  revalidatePath('/zpravy')
}
