export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import CustomerProjectDetailClient from './CustomerProjectDetailClient'

export default async function CustomerProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: customer } = await supabase
    .from('webdo24_customers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const { data: project, error } = await supabase
    .from('webdo24_projects')
    .select('*')
    .eq('id', id)
    .eq('customer_id', customer?.id)
    .single()

  if (error || !project) {
    notFound()
  }

  const { data: brief } = await supabase
    .from('webdo24_project_briefs')
    .select('*')
    .eq('project_id', id)
    .single()

  const { data: files } = await supabase
    .from('webdo24_project_files')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  const { data: events } = await supabase
    .from('webdo24_project_events')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <CustomerProjectDetailClient
      project={project}
      brief={brief}
      files={files || []}
      events={events || []}
    />
  )
}
