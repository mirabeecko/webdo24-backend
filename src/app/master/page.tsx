export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  Users,
  Globe,
  Phone,
  Mail,
  Clock,
  Package,
  Star,
  MessageSquare,
  Calendar,
  ExternalLink,
} from 'lucide-react'

export default async function MasterDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.user_metadata?.role !== 'admin') {
    redirect('/login')
  }

  // Všechny zákazníci s projekty
  const { data: customers } = await supabase
    .from('webdo24_customers')
    .select('*, projects:webdo24_projects(*)')
    .order('created_at', { ascending: false })

  // Všechny služby
  const { data: allServices } = await supabase
    .from('webdo24_services')
    .select('*')

  // Všechny reference
  const { data: allTestimonials } = await supabase
    .from('webdo24_testimonials')
    .select('*')

  // Všechny poptávky
  const { data: allLeads } = await supabase
    .from('webdo24_leads')
    .select('*')

  // Všechny snapshoty (pro poslední aktualizaci)
  const { data: allSnapshots } = await supabase
    .from('webdo24_website_snapshots')
    .select('*')
    .order('created_at', { ascending: false })

  const totalCustomers = customers?.length || 0
  const totalServices = allServices?.length || 0
  const totalTestimonials = allTestimonials?.length || 0
  const totalLeads = allLeads?.length || 0

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#0F172A] flex items-center justify-center">
              <span className="text-white text-sm font-bold">W</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#0F172A]">WEBDO24</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Master Dashboard</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">{user.email}</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center"><Users className="h-5 w-5 text-blue-600" /></div>
              <span className="text-sm text-gray-500">Zákazníci</span>
            </div>
            <div className="text-3xl font-bold text-[#0F172A]">{totalCustomers}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center"><Package className="h-5 w-5 text-emerald-600" /></div>
              <span className="text-sm text-gray-500">Služby celkem</span>
            </div>
            <div className="text-3xl font-bold text-[#0F172A]">{totalServices}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center"><Star className="h-5 w-5 text-amber-600" /></div>
              <span className="text-sm text-gray-500">Reference celkem</span>
            </div>
            <div className="text-3xl font-bold text-[#0F172A]">{totalTestimonials}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center"><MessageSquare className="h-5 w-5 text-purple-600" /></div>
              <span className="text-sm text-gray-500">Poptávky celkem</span>
            </div>
            <div className="text-3xl font-bold text-[#0F172A]">{totalLeads}</div>
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-[#0F172A] flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-400" />
              Všichni zákazníci
            </h2>
            <span className="text-xs text-gray-400">{totalCustomers} celkem</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Zákazník</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Kontakt</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Web</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Služby</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Poptávky</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Poslední aktivita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers && customers.length > 0 ? customers.map((c: any) => {
                  const project = c.projects?.[0]
                  const customerServices = allServices?.filter((s: any) => s.project_id === project?.id) || []
                  const customerLeads = allLeads?.filter((l: any) => l.project_id === project?.id) || []
                  const customerSnapshots = allSnapshots?.filter((s: any) => s.project_id === project?.id) || []
                  const lastSnapshot = customerSnapshots[0]
                  const lastLead = customerLeads.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-xs font-bold">
                            {c.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#0F172A]">{c.name}</p>
                            <p className="text-xs text-gray-400">{c.company || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          {c.phone && <p className="text-xs text-gray-600 flex items-center gap-1"><Phone className="h-3 w-3 text-gray-400" />{c.phone}</p>}
                          {c.email && <p className="text-xs text-gray-600 flex items-center gap-1"><Mail className="h-3 w-3 text-gray-400" />{c.email}</p>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {project ? (
                          <div>
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                              <Globe className="h-3 w-3 text-gray-400" />{project.slug}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{project.status}</p>
                            {project.production_url && (
                              <a href={project.production_url} target="_blank" className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-[10px] font-medium hover:bg-blue-100 transition-colors">
                                <ExternalLink className="h-3 w-3" /> Zobrazit web
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Žádný web</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-sm text-[#0F172A]">{customerServices.length}</span>
                        </div>
                        {customerServices.length > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[120px]">
                            {customerServices.map((s: any) => s.title).join(', ')}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-sm text-[#0F172A]">{customerLeads.length}</span>
                          {customerLeads.filter((l: any) => l.status === 'new').length > 0 && (
                            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {customerLeads.filter((l: any) => l.status === 'new').length} nové
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          {lastLead && (
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                              <MessageSquare className="h-3 w-3 text-gray-400" />
                              Poptávka: {new Date(lastLead.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                          {lastSnapshot && (
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              Web: {new Date(lastSnapshot.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                          {!lastLead && !lastSnapshot && (
                            <p className="text-xs text-gray-400">Žádná aktivita</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">Žádní zákazníci</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
