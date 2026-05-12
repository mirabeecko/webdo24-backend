import Link from 'next/link'
import {
  Inbox,
  Eye,
  Globe,
  MessageSquare,
  Star,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Clock,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'
import { getDashboardData } from '@/lib/actions/dashboard'
import UpsellCard from './UpsellCard'

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
  if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />
  return <Minus className="h-3.5 w-3.5 text-gray-400" />
}

function SourceBadge({ source }: { source: string }) {
  const styles: Record<string, string> = {
    web: 'bg-blue-50 text-blue-600',
    form: 'bg-purple-50 text-purple-600',
    whatsapp: 'bg-green-50 text-green-600',
    email: 'bg-amber-50 text-amber-600',
    phone: 'bg-gray-50 text-gray-600',
  }
  const labels: Record<string, string> = {
    web: 'Web',
    form: 'Formulář',
    whatsapp: 'WhatsApp',
    email: 'Email',
    phone: 'Telefon',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${styles[source] || 'bg-gray-50 text-gray-500'}`}>
      {labels[source] || source}
    </span>
  )
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'před chvílí'
  if (diff < 3600) return `před ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} h`
  return `před ${Math.floor(diff / 86400)} d`
}

export default async function DashboardView() {
  const data = await getDashboardData()

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto p-4 lg:p-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <h2 className="text-xl font-bold text-[#0F172A] mb-2">Vítejte v WEBDO24 LEAD MACHINE™</h2>
          <p className="text-gray-500 mb-6">Zatím nemáte žádná data. Jakmile začnete dostávat poptávky, objeví se zde.</p>
          <Link href="/web" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F172A] text-white text-sm font-medium hover:bg-gray-800 transition-colors">
            Upravit web
          </Link>
        </div>
      </div>
    )
  }

  const { customerName, customerEmail, hasProPack, companyName, project, newLeadsCount, todayViews, todayVisitors, yesterdayViews, recentLeads, testimonialsCount, avgRating } = data

  const trend: 'up' | 'down' | 'neutral' = todayViews > yesterdayViews ? 'up' : todayViews < yesterdayViews ? 'down' : 'neutral'
  const trendValue = yesterdayViews > 0
    ? `${todayViews > yesterdayViews ? '+' : ''}${todayViews - yesterdayViews} oproti včerejšku`
    : 'Dnes první návštěvy'

  const stats = [
    {
      label: 'Nové poptávky',
      value: newLeadsCount,
      icon: Inbox,
      color: 'bg-blue-50 text-blue-600',
      trend: (newLeadsCount > 0 ? 'up' : 'neutral') as 'up' | 'down' | 'neutral',
      trendValue: newLeadsCount > 0 ? 'Ke zpracování' : 'Vše vyřízeno',
    },
    {
      label: 'Návštěvy dnes',
      value: todayViews,
      icon: Eye,
      color: 'bg-emerald-50 text-emerald-600',
      trend,
      trendValue,
    },
    {
      label: 'Stav webu',
      value: project.status === 'deployed' ? 'Aktivní' : project.status,
      icon: Globe,
      color: 'bg-emerald-50 text-emerald-600',
      trend: 'neutral' as const,
      trendValue: 'Vše funguje',
    },
  ]

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-[#0F172A]">
          👋 Dobrý den, {customerName?.split(' ')[0] || 'uživateli'}!
        </h1>
        <p className="mt-1 text-gray-500">
          {newLeadsCount > 0 ? (
            <>
              Dnes máte <span className="font-semibold text-[#0F172A]">{newLeadsCount} {newLeadsCount === 1 ? 'novou poptávku' : newLeadsCount < 5 ? 'nové poptávky' : 'nových poptávek'}</span> 🔥
            </>
          ) : (
            'Dnes zatím žádné nové poptávky. Sdílejte svůj web!'
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`h-10 w-10 rounded-xl ${stat.color} flex items-center justify-center`}>
                  <Icon className="h-5 w-5" />
                </div>
                {stat.trend && (
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <TrendIcon trend={stat.trend} />
                  </div>
                )}
              </div>
              <div className="text-3xl font-bold text-[#0F172A] mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-gray-500">{stat.label}</div>
              {stat.trendValue && (
                <div className="mt-2 text-xs text-gray-400">{stat.trendValue}</div>
              )}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-gray-400" />
                <h2 className="font-semibold text-[#0F172A]">Poslední zprávy</h2>
                {newLeadsCount > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {newLeadsCount}
                  </span>
                )}
              </div>
              <Link
                href="/zpravy"
                className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-0.5"
              >
                Vše <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="divide-y divide-gray-50">
              {recentLeads.length > 0 ? (
                recentLeads.map((lead: any) => (
                  <Link
                    key={lead.id}
                    href={`/zpravy/${lead.id}`}
                    className="flex gap-4 p-5 hover:bg-gray-50/50 transition-colors group"
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      lead.status === 'new' ? 'bg-[#0F172A] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {lead.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-[#0F172A]">{lead.name}</span>
                        <SourceBadge source={lead.source} />
                        {lead.status === 'new' && (
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                        {lead.message}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(lead.created_at)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-500 shrink-0 self-center transition-colors" />
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center text-gray-400">
                  <p className="text-sm">Zatím žádné zprávy</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Rychlé akce
            </h2>
            <div className="space-y-3">
              <Link
                href="/zakaznici"
                className="flex items-center justify-between w-full rounded-xl px-4 py-3.5 text-sm font-medium bg-[#0F172A] text-white hover:bg-gray-800 shadow-sm transition-all"
              >
                ✨ Napsat nabídku
                <ArrowUpRight className="h-4 w-4 opacity-70" />
              </Link>
              <Link
                href="/web"
                className="flex items-center justify-between w-full rounded-xl px-4 py-3.5 text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all"
              >
                ➕ Přidat referenci
                <ArrowUpRight className="h-4 w-4 opacity-70" />
              </Link>
            </div>
          </div>

          {/* Web Preview Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[#0F172A]">Můj web</h2>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 mb-3">
              <div className="text-xs text-gray-400 mb-1">URL</div>
              <div className="text-sm font-medium text-[#0F172A] truncate">
                {project.production_url || project.domain || project.slug}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {project.status === 'deployed' ? 'Online' : project.status}
            </div>
            <Link
              href="/web"
              className="flex items-center justify-center w-full rounded-xl bg-gray-50 text-gray-700 py-2.5 text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Upravit web
            </Link>
          </div>

          {/* Upsell */}
          {!hasProPack && (
            <UpsellCard customerEmail={customerEmail} projectId={project.id} />
          )}

          {/* Rating Preview */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-[#0F172A] mb-2">Reference</h2>
            <div className="flex items-center gap-1 mb-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-5 w-5 ${i < Math.round(Number(avgRating)) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
              ))}
              <span className="ml-2 text-lg font-bold text-[#0F172A]">{avgRating}</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">z {testimonialsCount} hodnocení</p>
            <Link
              href="/web"
              className="text-sm text-blue-600 font-medium hover:text-blue-700"
            >
              Spravovat reference →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
