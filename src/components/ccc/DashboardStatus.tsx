// DashboardStatus (§17): stavový přehled nad AI chatem –
// stav webu, rozpracované změny, poptávky, notifikace.
// Server component: čte vlastní data (zákazníkovo, přes service role).

import Link from 'next/link'
import { Globe, FileText, MessageSquare, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import NotificationsList from '@/components/ccc/NotificationsList'
import type { Notification } from '@/types/website-contract'

export default async function DashboardStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: customer } = await admin
    .from('webdo24_customers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!customer) return null

  const { data: project } = await admin
    .from('webdo24_projects')
    .select('id, slug, status, production_url, current_version_id')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!project) return null

  const [
    { count: draftCount },
    { count: newLeadsCount },
    { data: notifications },
    { data: liveVersion },
  ] = await Promise.all([
    admin
      .from('webdo24_changesets')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .in('status', ['draft', 'validated', 'preview_ready', 'approved']),
    admin
      .from('webdo24_leads')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .eq('status', 'new'),
    admin
      .from('webdo24_notifications')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(5),
    project.current_version_id
      ? admin
          .from('webdo24_site_versions')
          .select('published_at')
          .eq('id', project.current_version_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const webUrl =
    (project.production_url as string | null) ??
    (project.slug ? `https://web.webdo24.cz/${project.slug}` : null)
  const online = project.status === 'deployed'

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 pt-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Stav webu */}
        <div className="bg-[#0d1525] rounded-2xl border border-white/5 p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <Globe className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              Stav webu
            </h3>
          </div>
          <p className={`text-sm font-semibold ${online ? 'text-emerald-400' : 'text-amber-400'}`}>
            {online ? 'Online' : 'Připravuje se'}
          </p>
          {webUrl && (
            <a
              href={webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-xs text-cyan-400 hover:underline break-all"
            >
              {webUrl.replace(/^https?:\/\//, '')}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          )}
          <p className="mt-1 text-[10px] text-white/25">
            {liveVersion?.published_at
              ? `Poslední publikace: ${new Date(liveVersion.published_at as string).toLocaleString('cs-CZ')}`
              : 'Zatím nic publikováno'}
          </p>
        </div>

        {/* Rozpracované změny */}
        <Link
          href="/obsah"
          className="bg-[#0d1525] rounded-2xl border border-white/5 p-5 hover:border-cyan-400/20 transition-colors"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <FileText className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              Rozpracované změny
            </h3>
          </div>
          <p className="text-2xl font-bold text-white">{draftCount ?? 0}</p>
          <p className="mt-1 text-xs text-cyan-400">
            {(draftCount ?? 0) > 0 ? 'Pokračovat v úpravách →' : 'Upravit obsah →'}
          </p>
        </Link>

        {/* Poptávky */}
        <Link
          href="/zpravy"
          className="bg-[#0d1525] rounded-2xl border border-white/5 p-5 hover:border-cyan-400/20 transition-colors"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <MessageSquare className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              Nové poptávky
            </h3>
          </div>
          <p className="text-2xl font-bold text-white">{newLeadsCount ?? 0}</p>
          <p className="mt-1 text-xs text-cyan-400">Zobrazit poptávky →</p>
        </Link>

        {/* Notifikace */}
        <div className="bg-[#0d1525] rounded-2xl border border-white/5 p-5 sm:col-span-2 lg:col-span-1">
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
            Notifikace
          </h3>
          <NotificationsList notifications={(notifications as Notification[]) ?? []} />
        </div>
      </div>
    </div>
  )
}
