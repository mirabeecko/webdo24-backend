'use server'

import { createClient } from '@/lib/supabase/server'
import type { ChangeRequest } from '@/types'

export async function getDashboardData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: customer } = await supabase
    .from('webdo24_customers')
    .select('id, name, company, has_pro_pack')
    .eq('user_id', user.id)
    .single()
  if (!customer) return null

  const { data: project } = await supabase
    .from('webdo24_projects')
    .select('id, title, slug, domain, production_url, status')
    .eq('customer_id', customer.id)
    .single()
  if (!project) return null

  const [
    { count: newLeadsCount },
    { data: todayAnalytics },
    { data: yesterdayAnalytics },
    { data: recentLeads },
    { data: testimonials },
    { data: recentChanges },
  ] = await Promise.all([
    supabase
      .from('webdo24_leads')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .eq('status', 'new'),
    supabase
      .from('webdo24_analytics')
      .select('page_views, unique_visitors, form_submissions')
      .eq('project_id', project.id)
      .eq('event_date', new Date().toISOString().split('T')[0])
      .single(),
    supabase
      .from('webdo24_analytics')
      .select('page_views')
      .eq('project_id', project.id)
      .eq('event_date', new Date(Date.now() - 86400000).toISOString().split('T')[0])
      .single(),
    supabase
      .from('webdo24_leads')
      .select('id, name, message, source, status, created_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('webdo24_testimonials')
      .select('rating')
      .eq('project_id', project.id),
    supabase
      .from('webdo24_change_requests')
      .select('id, raw_input, category, status, created_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const avgRating = testimonials?.length
    ? (testimonials.reduce((sum: number, t: { rating?: number }) => sum + (t.rating || 0), 0) / testimonials.length).toFixed(1)
    : '0'

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
    recentChanges: (recentChanges as ChangeRequest[]) || [],
  }
}
