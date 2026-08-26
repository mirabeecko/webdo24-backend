'use client'

// ============================================
// Přehled (dashboard) — prémiový přehled byznysu
// Stejný designový jazyk jako /poptavky (CRM)
// ============================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Zap,
  MessageSquare,
  Eye,
  Users,
  TrendingUp,
  ArrowRight,
  Inbox,
  FileText,
  Sparkles,
  Globe,
  MousePointerClick,
} from 'lucide-react'
import { getCrmData } from '@/lib/actions/crm'
import type { CrmData, CrmLead } from '@/lib/actions/crm'

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'před chvílí'
  if (diff < 3600) return `před ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `před ${Math.floor(diff / 86400)} d`
  return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
}

function initials(name: string) {
  return name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?'
}

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
  contacted: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30',
  negotiation: 'bg-violet-400/10 text-violet-300 border-violet-400/30',
  done: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
  lost: 'bg-slate-400/10 text-slate-400 border-slate-400/30',
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Nová',
  contacted: 'Kontaktovaná',
  negotiation: 'V jednání',
  done: 'Dokončená',
  lost: 'Prohraná',
}

function Kpi({ icon: Icon, label, value, sub, accent }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
  accent: string
}) {
  return (
    <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-4 flex items-start gap-3 hover:border-cyan-400/20 transition-colors">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-white leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

function MiniChart({ rows, days }: { rows: CrmData['analytics']; days: number }) {
  const slice = rows.slice(-days)
  const max = Math.max(...slice.map((r) => r.page_views), 1)
  return (
    <div className="flex items-end gap-1 h-16">
      {slice.map((r) => {
        const h = Math.max((r.page_views / max) * 100, 4)
        return (
          <div key={r.event_date} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full rounded-sm bg-gradient-to-t from-cyan-500/30 to-cyan-400/70 group-hover:from-cyan-500/60 group-hover:to-cyan-400 transition-colors"
              style={{ height: `${h}%` }}
              title={`${r.event_date}: ${r.page_views} návštěv`}
            />
          </div>
        )
      })}
    </div>
  )
}

export default function OverviewDashboard() {
  const [data, setData] = useState<CrmData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    getCrmData().then((d) => {
      if (!alive) return
      setData(d)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-4">
        <div className="animate-pulse h-12 w-64 bg-white/5 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white/5 rounded-2xl" />
          ))}
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-72 bg-white/5 rounded-2xl" />
          <div className="h-72 bg-white/5 rounded-2xl" />
        </div>
      </div>
    )
  }

  const kpis = data?.kpis
  const leads = data?.leads || []
  const recentLeads = leads.slice(0, 5)

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-5">
      {/* Hlavička */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-cyan-400/70 font-medium uppercase tracking-widest">Přehled</p>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight mt-1">
            {data?.projectTitle || 'Váš web'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">Jak si váš web vede — na první pohled.</p>
        </div>
        <Link
          href="/poptavky"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Inbox className="h-4 w-4" /> Otevřít poptávky
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={MessageSquare} label="Celkem poptávek" value={kpis?.totalLeads ?? 0} sub={`${kpis?.newLeads7 ?? 0} nových za 7 dní`} accent="bg-cyan-400/15 text-cyan-300" />
        <Kpi icon={Eye} label="Návštěvy · 7 dní" value={(kpis?.views7 ?? 0).toLocaleString('cs-CZ')} sub={`dnes ${kpis?.viewsToday ?? 0} · včera ${kpis?.viewsYesterday ?? 0}`} accent="bg-blue-400/15 text-blue-300" />
        <Kpi icon={Users} label="Unikátní · 7 dní" value={(kpis?.unique7 ?? 0).toLocaleString('cs-CZ')} sub="přibližně" accent="bg-violet-400/15 text-violet-300" />
        <Kpi icon={TrendingUp} label="Konverze · 7 dní" value={`${kpis?.conversion7 ?? 0} %`} sub={`${kpis?.subs7 ?? 0} poptávek z formuláře`} accent="bg-emerald-400/15 text-emerald-300" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Návštěvnost + poslední poptávky */}
        <div className="lg:col-span-2 space-y-4">
          {/* Návštěvnost */}
          <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Návštěvnost · 7 dní</h2>
              </div>
              <Link href="/web" className="text-[11px] text-slate-500 hover:text-cyan-300 flex items-center gap-1 transition-colors">
                detail <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {data?.analytics?.length ? (
              <MiniChart rows={data.analytics} days={7} />
            ) : (
              <div className="h-16 flex items-center justify-center text-slate-500 text-xs">Zatím bez dat</div>
            )}
          </div>

          {/* Poslední poptávky */}
          <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex items-center gap-2">
                <Inbox className="h-4 w-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Poslední poptávky</h2>
              </div>
              <Link href="/poptavky" className="text-[11px] text-slate-500 hover:text-cyan-300 flex items-center gap-1 transition-colors">
                všechny <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {recentLeads.length > 0 ? (
              <div className="divide-y divide-white/5">
                {recentLeads.map((lead: CrmLead) => {
                  const st = STATUS_STYLE[lead.status] || STATUS_STYLE.new
                  return (
                    <Link key={lead.id} href="/poptavky" className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className="h-9 w-9 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-[11px] font-bold text-slate-300 shrink-0">
                        {initials(lead.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{lead.name}</p>
                        <p className="text-xs text-slate-500 truncate">{lead.message}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wide border ${st} shrink-0`}>
                        {STATUS_LABEL[lead.status] || lead.status}
                      </span>
                      <span className="text-[10px] text-slate-600 shrink-0">{timeAgo(lead.created_at)}</span>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-slate-500 text-sm">Zatím žádné poptávky</div>
            )}
          </div>
        </div>

        {/* Rychlé akce */}
        <div className="space-y-4">
          <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Rychlé akce</h2>
            <div className="space-y-2">
              {[
                { href: '/poptavky', icon: Inbox, label: 'Vyřídit poptávky', sub: 'Odpovědi, stavy, AI', accent: 'text-cyan-400' },
                { href: '/obsah', icon: FileText, label: 'Upravit obsah webu', sub: 'Texty a obrázky', accent: 'text-emerald-400' },
                { href: '/pozadavky', icon: Sparkles, label: 'Požádat o změnu', sub: 'AI asistent', accent: 'text-violet-400' },
                { href: '/web', icon: Globe, label: 'Náhled webu', sub: 'Verze a doména', accent: 'text-blue-400' },
              ].map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-400/20 hover:bg-white/[0.04] transition-all group"
                >
                  <div className={`h-9 w-9 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0 ${a.accent}`}>
                    <a.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{a.label}</p>
                    <p className="text-[11px] text-slate-500">{a.sub}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-cyan-300 transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          {/* Návrh tip */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-violet-500/10 border border-cyan-400/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Tip pro růst</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Poptávky z webu končí v <span className="text-cyan-300 font-medium">Poptávkách</span>. Zapněte AI odpovědi a zájemci dostanou reakci okamžitě — i když jste na zakázce.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
