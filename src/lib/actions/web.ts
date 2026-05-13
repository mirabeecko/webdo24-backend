'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getCustomerProject() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: customer } = await supabase
    .from('webdo24_customers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!customer) return null

  const { data: project } = await supabase
    .from('webdo24_projects')
    .select('id, slug, production_url')
    .eq('customer_id', customer.id)
    .single()

  return project
}

// ── WEBSITE CONTENT ──
export async function getWebsiteContent() {
  const project = await getCustomerProject()
  if (!project) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('webdo24_website_content')
    .select('*')
    .eq('project_id', project.id)
    .order('sort_order', { ascending: true })

  return data || []
}

export async function updateWebsiteContent(id: string, value: string) {
  const supabase = await createClient()

  if (id.startsWith('default-')) {
    const sectionKey = id.replace('default-', '')
    const project = await getCustomerProject()
    if (!project) throw new Error('Projekt nenalezen')

    const typeMap: Record<string, string> = {
      hero_title: 'text', hero_subtitle: 'textarea', hero_image: 'image',
      phone: 'phone', email: 'text', address: 'text', hours: 'text', about_text: 'textarea',
    }

    const { error } = await supabase.from('webdo24_website_content').insert({
      project_id: project.id,
      section_key: sectionKey,
      content_type: typeMap[sectionKey] || 'text',
      content_value: value,
    })

    if (error) throw new Error(error.message)
    revalidatePath('/web')
    return
  }

  const { error } = await supabase
    .from('webdo24_website_content')
    .update({ content_value: value, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/web')
}

// ── TESTIMONIALS ──
export async function getTestimonials() {
  const project = await getCustomerProject()
  if (!project) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('webdo24_testimonials')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })

  return data || []
}

export async function createTestimonial(formData: { customer_name: string; rating: number; text: string }) {
  const project = await getCustomerProject()
  if (!project) throw new Error('Projekt nenalezen')

  const supabase = await createClient()
  const { error } = await supabase.from('webdo24_testimonials').insert({
    project_id: project.id,
    customer_name: formData.customer_name,
    rating: formData.rating,
    text: formData.text,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/web')
}

export async function deleteTestimonial(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('webdo24_testimonials').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/web')
}

// ── SERVICES ──
export async function getServices() {
  const project = await getCustomerProject()
  if (!project) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('webdo24_services')
    .select('*')
    .eq('project_id', project.id)
    .order('sort_order', { ascending: true })

  return data || []
}

export async function getProjectUrl() {
  const project = await getCustomerProject()
  if (!project) return null
  return project.production_url || `https://web.webdo24.cz/${project.slug}/`
}

export async function createService(formData: { title: string; description: string; price: string }) {
  const project = await getCustomerProject()
  if (!project) throw new Error('Projekt nenalezen')

  const supabase = await createClient()
  // Find max sort_order
  const { data: existing } = await supabase
    .from('webdo24_services')
    .select('sort_order')
    .eq('project_id', project.id)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.sort_order || 0) + 1

  const { error } = await supabase.from('webdo24_services').insert({
    project_id: project.id,
    title: formData.title,
    description: formData.description,
    price: formData.price,
    sort_order: nextOrder,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/web')
}

export async function deleteService(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('webdo24_services').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/web')
}
