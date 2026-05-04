export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import CustomerProfileForm from '@/components/customer/CustomerProfileForm'

export default async function CustomerDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>Unauthorized</div>
  }

  const { data: customer } = await supabase
    .from('webdo24_customers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { data: projects } = await supabase
    .from('webdo24_projects')
    .select('*')
    .eq('customer_id', customer?.id)
    .order('created_at', { ascending: false })

  const statusLabels: Record<string, string> = {
    draft: 'Koncept',
    submitted: 'Odesláno',
    waiting_for_materials: 'Čeká na materiály',
    ready_for_generation: 'Připraveno k generaci',
    generating: 'Generování',
    generated: 'Vygenerováno',
    qa_check: 'QA kontrola',
    needs_revision: 'Potřebuje úpravy',
    approved: 'Schváleno',
    deployed: 'Nasazeno',
    archived: 'Archivováno',
  }

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-gray-800">Můj účet</h1>

      <div className="mb-8 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Základní informace</h2>
        <CustomerProfileForm customer={customer} />
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Moje projekty</h2>
          <Link
            href="/customer/new-project"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Nový projekt
          </Link>
        </div>

        {projects && projects.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {projects.map((project: any) => (
              <div key={project.id} className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/customer/projects/${project.id}`}
                      className="text-lg font-medium text-gray-900 hover:text-blue-600"
                    >
                      {project.title}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {statusLabels[project.status] || project.status}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    {project.preview_url && (
                      <a
                        href={project.preview_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Preview
                      </a>
                    )}
                    <span className="text-xs text-gray-400">
                      {formatDate(project.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Zatím nemáte žádné projekty.</p>
        )}
      </div>
    </div>
  )
}
