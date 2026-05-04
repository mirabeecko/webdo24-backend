export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProjectDetailClient from './ProjectDetailClient'

export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project, error } = await supabase
    .from('webdo24_projects')
    .select('*, customer:webdo24_customers(*)')
    .eq('id', id)
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

  const { data: pipelineRuns } = await supabase
    .from('webdo24_pipeline_runs')
    .select('*')
    .eq('project_id', id)
    .order('started_at', { ascending: false })

  const { data: events } = await supabase
    .from('webdo24_project_events')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: invoices } = await supabase
    .from('webdo24_invoices')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  return (
    <ProjectDetailClient
      project={project}
      brief={brief}
      files={files || []}
      pipelineRuns={pipelineRuns || []}
      events={events || []}
      invoices={invoices || []}
    />
  )
}
