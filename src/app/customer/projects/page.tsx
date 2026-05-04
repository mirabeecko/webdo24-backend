export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default async function CustomerProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>Unauthorized</div>
  }

  const { data: customer } = await supabase
    .from('webdo24_customers')
    .select('id')
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
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Moje projekty</h1>
        <Link
          href="/customer/new-project"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nový projekt
        </Link>
      </div>

      {projects && projects.length > 0 ? (
        <div className="space-y-4">
          {projects.map((project: any) => (
            <div key={project.id} className="rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <Link
                    href={`/customer/projects/${project.id}`}
                    className="text-xl font-medium text-gray-900 hover:text-blue-600"
                  >
                    {project.title}
                  </Link>
                  <p className="mt-1 text-sm text-gray-500">
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
                      Zobrazit preview
                    </a>
                  )}
                  {project.production_url && (
                    <a
                      href={project.production_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-green-600 hover:underline"
                    >
                      Živý web
                    </a>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Vytvořeno: {formatDate(project.created_at)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <p className="text-gray-500">Zatím nemáte žádné projekty.</p>
          <Link
            href="/customer/new-project"
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Vytvořit první projekt
          </Link>
        </div>
      )}
    </div>
  )
}
