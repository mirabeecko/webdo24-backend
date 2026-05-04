export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { count: customersCount } = await supabase
    .from('webdo24_customers')
    .select('*', { count: 'exact', head: true })

  const { count: activeProjectsCount } = await supabase
    .from('webdo24_projects')
    .select('*', { count: 'exact', head: true })
    .not('status', 'in', '(archived,draft)')

  const { count: waitingMaterialsCount } = await supabase
    .from('webdo24_projects')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'waiting_for_materials')

  const { count: inProductionCount } = await supabase
    .from('webdo24_projects')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'generating')

  const { count: deployedCount } = await supabase
    .from('webdo24_projects')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'deployed')

  const { data: recentProjects } = await supabase
    .from('webdo24_projects')
    .select('*, customer:webdo24_customers(name)')
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: recentPipelineErrors } = await supabase
    .from('webdo24_pipeline_runs')
    .select('*, project:webdo24_projects(title)')
    .eq('status', 'failed')
    .order('started_at', { ascending: false })
    .limit(5)

  const stats = [
    { label: 'Zákazníci', value: customersCount || 0, color: 'bg-blue-500' },
    { label: 'Aktivní projekty', value: activeProjectsCount || 0, color: 'bg-green-500' },
    { label: 'Čeká na materiály', value: waitingMaterialsCount || 0, color: 'bg-yellow-500' },
    { label: 'Ve výrobě', value: inProductionCount || 0, color: 'bg-purple-500' },
    { label: 'Hotové weby', value: deployedCount || 0, color: 'bg-teal-500' },
  ]

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-gray-800">Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-white p-6 shadow-sm">
            <div className={`mb-2 inline-block rounded-full p-2 ${stat.color}`}>
              <div className="h-2 w-2 rounded-full bg-white" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Poslední projekty</h2>
            <Link href="/admin/projects" className="text-sm text-blue-600 hover:underline">
              Zobrazit vše
            </Link>
          </div>

          {recentProjects && recentProjects.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {recentProjects.map((project: any) => (
                <div key={project.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Link
                        href={`/admin/projects/${project.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {project.title}
                      </Link>
                      <p className="text-sm text-gray-500">
                        {project.customer?.name || 'Neznámý zákazník'}
                      </p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                      {project.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {formatDate(project.created_at)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Žádné projekty</p>
          )}
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Poslední chyby pipeline</h2>
          </div>

          {recentPipelineErrors && recentPipelineErrors.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {recentPipelineErrors.map((run: any) => (
                <div key={run.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {run.project?.title || 'Neznámý projekt'}
                      </p>
                      <p className="text-sm text-red-600">{run.error_message}</p>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {formatDate(run.started_at)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Žádné chyby</p>
          )}
        </div>
      </div>
    </div>
  )
}
