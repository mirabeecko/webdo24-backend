'use server'

import { createClient } from '@/lib/supabase/server'

export async function getDashboardData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  console.log('=== getDashboardData ===')
  console.log('user:', user?.email || 'null')
  console.log('user_id:', user?.id || 'null')
  
  if (!user) {
    console.log('→ NO USER, returning null')
    return null
  }

  const { data: customer, error: customerErr } = await supabase
    .from('webdo24_customers')
    .select('id, name, company, has_pro_pack')
    .eq('user_id', user.id)
    .single()

  console.log('customer:', customer, 'error:', customerErr?.message)

  if (!customer) {
    console.log('→ NO CUSTOMER, returning null')
    return null
  }

  const { data: project, error: projectErr } = await supabase
    .from('webdo24_projects')
    .select('id, title, slug, domain, production_url, status')
    .eq('customer_id', customer.id)
    .single()

  console.log('project:', project, 'error:', projectErr?.message)

  if (!project) {
    console.log('→ NO PROJECT, returning null')
    return null
  }

  const { count: newLeadsCount } = await supabase
    .from('webdo24_leads')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .eq('status', 'new')

  const today = new Date().toISOString().split('T')[0]
  const { data: todayAnalytics } = await supabase
    .from('webdo24_analytics')
    .select('page_views, unique_visitors, form_submissions')
    .eq('project_id', project.id)
    .eq('event_date', today)
    .single()

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const { data: yesterdayAnalytics } = await supabase
    .from('webdo24_analytics')
    .select('page_views')
    .eq('project_id', project.id)
    .eq('event_date', yesterday)
    .single()

  const { data: recentLeads } = await supabase
    .from('webdo24_leads')
    .select('id, name, message, source, status, created_at')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: testimonials } = await supabase
    .from('webdo24_testimonials')
    .select('rating')
    .eq('project_id', project.id)

  const avgRating = testimonials?.length
    ? (testimonials.reduce((sum: number, t: any) => sum + (t.rating || 0), 0) / testimonials.length).toFixed(1)
    : '0'

  console.log('→ RETURNING data with', newLeadsCount, 'new leads,', recentLeads?.length, 'recent leads')

  return {
    customerName: customer.name,
    customerEmail: user.email || '',
    hasProPack: customer.has_pro_pack || false,
    companyName: customer.company,
    project,
    newLeadsCount: newLeadsCount || 0,
    todayViews: todayAnalytics?.page_views || 0,
    todayVisitors: todayAnalytics?.unique_visitors || 0,
    yesterdayViews: yesterdayAnalytics?.page_views || 0,
    recentLeads: recentLeads || [],
    testimonialsCount: testimonials?.length || 0,
    avgRating,
  }
}
