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
    .select('id, slug')
    .eq('customer_id', customer.id)
    .single()

  return project
}

// ── SNAPSHOT (zálohy) ──
export async function createSnapshot(name?: string) {
  const project = await getCustomerProject()
  if (!project) throw new Error('Projekt nenalezen')

  const supabase = await createClient()

  // Načíst všechna data
  const [{ data: content }, { data: services }, { data: testimonials }] = await Promise.all([
    supabase.from('webdo24_website_content').select('*').eq('project_id', project.id),
    supabase.from('webdo24_services').select('*').eq('project_id', project.id),
    supabase.from('webdo24_testimonials').select('*').eq('project_id', project.id),
  ])

  const snapshot = {
    website_content: content || [],
    services: services || [],
    testimonials: testimonials || [],
    created_at: new Date().toISOString(),
  }

  // Uchovat max 4 zálohy - smazat nejstarší
  const { data: existing } = await supabase
    .from('webdo24_website_snapshots')
    .select('id')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })

  if (existing && existing.length >= 4) {
    const toDelete = existing.slice(3).map((s) => s.id)
    await supabase.from('webdo24_website_snapshots').delete().in('id', toDelete)
  }

  const { error } = await supabase.from('webdo24_website_snapshots').insert({
    project_id: project.id,
    name: name || `Záloha ${new Date().toLocaleDateString('cs-CZ')}`,
    snapshot_json: snapshot,
    is_auto: !name,
  })

  if (error) throw new Error(error.message)
}

export async function getSnapshots() {
  const project = await getCustomerProject()
  if (!project) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('webdo24_website_snapshots')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(4)

  return data || []
}

export async function restoreSnapshot(snapshotId: string) {
  const project = await getCustomerProject()
  if (!project) throw new Error('Projekt nenalezen')

  const supabase = await createClient()

  const { data: snap } = await supabase
    .from('webdo24_website_snapshots')
    .select('snapshot_json')
    .eq('id', snapshotId)
    .single()

  if (!snap) throw new Error('Záloha nenalezena')

  const snapshot = snap.snapshot_json as any

  // Nejdřív smazat existující data
  await supabase.from('webdo24_website_content').delete().eq('project_id', project.id)
  await supabase.from('webdo24_services').delete().eq('project_id', project.id)
  await supabase.from('webdo24_testimonials').delete().eq('project_id', project.id)

  // Obnovit z zálohy
  if (snapshot.website_content?.length) {
    const rows = snapshot.website_content.map((r: any) => ({
      project_id: project.id,
      section_key: r.section_key,
      content_type: r.content_type,
      content_value: r.content_value,
      sort_order: r.sort_order || 0,
    }))
    await supabase.from('webdo24_website_content').insert(rows)
  }

  if (snapshot.services?.length) {
    const rows = snapshot.services.map((r: any) => ({
      project_id: project.id,
      title: r.title,
      description: r.description,
      price: r.price,
      sort_order: r.sort_order || 0,
    }))
    await supabase.from('webdo24_services').insert(rows)
  }

  if (snapshot.testimonials?.length) {
    const rows = snapshot.testimonials.map((r: any) => ({
      project_id: project.id,
      customer_name: r.customer_name,
      rating: r.rating,
      text: r.text,
    }))
    await supabase.from('webdo24_testimonials').insert(rows)
  }

  revalidatePath('/web')
}

// ── PUBLISH ──
export async function publishWebsite() {
  const project = await getCustomerProject()
  if (!project) throw new Error('Projekt nenalezen')

  // Vytvořit zálohu před publikováním
  await createSnapshot('Před publikováním')

  // Revalidovat veřejnou stránku
  revalidatePath(`/${project.slug}`)
  revalidatePath('/web')

  return { success: true, url: `https://web.webdo24.cz/${project.slug}/` }
}

// ── VEŘEJNÝ WEB DATA ──
export async function getPublicWebsiteData(slug: string) {
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('webdo24_projects')
    .select('id, title, slug, domain, production_url')
    .eq('slug', slug)
    .single()

  if (!project) return null

  const [{ data: content }, { data: services }, { data: testimonials }] = await Promise.all([
    supabase.from('webdo24_website_content').select('*').eq('project_id', project.id).order('sort_order', { ascending: true }),
    supabase.from('webdo24_services').select('*').eq('project_id', project.id).order('sort_order', { ascending: true }),
    supabase.from('webdo24_testimonials').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
  ])

  return {
    project,
    content: content || [],
    services: services || [],
    testimonials: testimonials || [],
  }
}
