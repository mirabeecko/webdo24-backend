export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAppCustomerContext } from '@/lib/customer-context'
import WebOverview from '@/components/app/WebOverview'

export default async function WebPage() {
  const context = await getAppCustomerContext()
  if (!context?.user) redirect('/login')
  if (!context.project) redirect('/dashboard')

  const project = context.project
  const supabase = await createClient()

  // Analytics — posledních 7 dní
  const since = new Date(Date.now() - 7 * 86400_000).toISOString().split('T')[0]
  const { data: analytics } = await supabase
    .from('webdo24_analytics')
    .select('event_date, page_views, unique_visitors, form_submissions')
    .eq('project_id', project.id)
    .gte('event_date', since)
    .order('event_date', { ascending: false })

  // Verze webu
  const { data: versions } = await supabase
    .from('webdo24_site_versions')
    .select('id, status, note, created_by_type, published_at, created_at')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Poslední 3 change requesty
  const { data: recentChanges } = await supabase
    .from('webdo24_change_requests')
    .select('id, raw_input, status, created_at')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(3)

  const weekViews  = (analytics ?? []).reduce((s, r) => s + (r.page_views ?? 0), 0)
  const weekLeads  = (analytics ?? []).reduce((s, r) => s + (r.form_submissions ?? 0), 0)

  return (
    <WebOverview
      project={project as any}
      weekViews={weekViews}
      weekLeads={weekLeads}
      versions={(versions ?? []) as any}
      recentChanges={(recentChanges ?? []) as any}
    />
  )
}
