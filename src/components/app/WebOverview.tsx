'use client'

import Link from 'next/link'
import {
  Globe, Eye, Inbox, Sparkles, ExternalLink,
  ChevronRight, ArrowRight, RefreshCw,
} from 'lucide-react'
import type { ChangeStatus, SiteVersionStatus } from '@/types'

// ── Types ───────────────────────────────────────────────────────────

interface Project {
  id: string
  title: string
  slug: string | null
  domain: string | null
  production_url: string | null
  status: string
  current_version_id: string | null
  created_at: string
}

interface Version {
  id: string
  status: SiteVersionStatus
  note: string | null
  created_by_type: string
  published_at: string | null
  created_at: string
}

interface ChangeRow {
  id: string
  raw_input: string
  status: ChangeStatus
  created_at: string
}

interface Props {
  project: Project
  weekViews: number
  weekLeads: number
  versions: Version[]
  recentChanges: ChangeRow[]
}

// ── Helpers ─────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'právě teď'
  if (diff < 3_600_000) return `před ${Math.floor(diff / 60_000)} min`
  if (diff < 86_400_000) return `před ${Math.floor(diff / 3_600_000)} h`
  return `před ${Math.floor(diff / 86_400_000)} d`
}

const VERSION_BADGE: Record<SiteVersionStatus, { label: string; cls: string }> = {
  live:     { label: 'Live',     cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  preview:  { label: 'Náhled',   cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  draft:    { label: 'Koncept',  cls: 'bg-gray-50 text-gray-500 ring-gray-200' },
  archived: { label: 'Archiv',  cls: 'bg-gray-50 text-gray-400 ring-gray-100' },
  failed:   { label: 'Chyba',   cls: 'bg-red-50 text-red-600 ring-red-200' },
}

const CHANGE_STATUS_COLOR: Partial<Record<ChangeStatus, string>> = {
  preview_ready: 'text-amber-600',
  published:     'text-emerald-600',
  failed:        'text-red-500',
}

const CHANGE_STATUS_LABEL: Partial<Record<ChangeStatus, string>> = {
  new: 'Přijato', classifying: 'Analyzujeme', planning: 'Plánujeme',
  executing: 'Pracujeme', preview_ready: 'Ke schválení', approved: 'Schváleno',
  publishing: 'Publikujeme', published: 'Hotovo', rejected: 'Zrušeno',
  failed: 'Chyba', escalated: 'V řešení',
}

// ── Component ────────────────────────────────────────────────────────

export default function WebOverview({ project, weekViews, weekLeads, versions, recentChanges }: Props) {
  const liveUrl = project.production_url || (project.domain ? `https://${project.domain}` : null)
  const displayUrl = project.domain || project.production_url || project.slug || '—'
  const isLive = project.status === 'deployed'

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">Můj web</h1>
            <div className="mt-2 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              <span className="text-sm text-gray-500">{isLive ? 'Online' : project.status}</span>
              {liveUrl && (
                <>
                  <span className="text-gray-300">·</span>
                  <a href={liveUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-[#0F172A] transition-colors flex items-center gap-1">
                    {displayUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </div>
          </div>
          {liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors shrink-0"
            >
              <Globe className="h-4 w-4" />
              Zobrazit web
            </a>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Eye className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Návštěvy</span>
            </div>
            <div className="text-3xl font-bold text-[#0F172A]">{weekViews.toLocaleString('cs-CZ')}</div>
            <div className="text-xs text-gray-400 mt-1">posledních 7 dní</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Inbox className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Poptávky</span>
            </div>
            <div className="text-3xl font-bold text-[#0F172A]">{weekLeads}</div>
            <div className="text-xs text-gray-400 mt-1">posledních 7 dní</div>
          </div>
        </div>

        {/* AI Change CTA */}
        <div className="rounded-2xl bg-[#0F172A] text-white p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg mb-1">Chcete něco změnit?</h2>
              <p className="text-sm text-white/60 leading-relaxed">
                Napište jednou větou co upravit — texty, fotky, ceny, nové sekce.
                Uděláme to za vás do 24 hodin.
              </p>
            </div>
          </div>
          <Link
            href="/pozadavky"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white text-[#0F172A] px-6 py-3 text-sm font-bold hover:bg-gray-100 transition-colors shadow-sm"
          >
            Říct co změnit
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Verze webu */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-gray-400" />
                <h2 className="font-semibold text-[#0F172A] text-sm">Historie verzí</h2>
              </div>
            </div>
            {versions.length > 0 ? (
              <ul className="divide-y divide-gray-50">
                {versions.map((v) => {
                  const badge = VERSION_BADGE[v.status] ?? VERSION_BADGE.draft
                  return (
                    <li key={v.id} className="flex items-center gap-3 px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset shrink-0 ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 truncate">
                          {v.note ?? (v.created_by_type === 'ai' ? 'AI aktualizace' : 'Manuální verze')}
                        </p>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(v.created_at)}</span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="p-8 text-center text-sm text-gray-400">
                Zatím žádné verze.
              </div>
            )}
          </div>

          {/* Poslední požadavky */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gray-400" />
                <h2 className="font-semibold text-[#0F172A] text-sm">Poslední požadavky</h2>
              </div>
              <Link href="/pozadavky" className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-0.5">
                Vše <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {recentChanges.length > 0 ? (
              <ul className="divide-y divide-gray-50">
                {recentChanges.map((cr) => {
                  const needsAction = cr.status === 'preview_ready'
                  const color = CHANGE_STATUS_COLOR[cr.status] ?? 'text-gray-400'
                  return (
                    <li key={cr.id}>
                      <Link
                        href={`/pozadavky/${cr.id}`}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#0F172A] line-clamp-1">{cr.raw_input}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-semibold ${color}`}>
                              {CHANGE_STATUS_LABEL[cr.status] ?? cr.status}
                            </span>
                            <span className="text-[10px] text-gray-300">·</span>
                            <span className="text-[10px] text-gray-400">{timeAgo(cr.created_at)}</span>
                          </div>
                        </div>
                        {needsAction ? (
                          <span className="shrink-0 text-xs font-semibold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 ring-1 ring-inset ring-amber-200">
                            Schválit
                          </span>
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-400 mb-3">Zatím žádné požadavky.</p>
                <Link href="/pozadavky" className="text-sm font-semibold text-[#0F172A] hover:underline">
                  Říct nám co změnit →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Pokročilá editace — sekundární odkaz */}
        <div className="mt-6 text-center">
          <Link href="/web/editor" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Pokročilá editace obsahu →
          </Link>
        </div>

      </div>
    </div>
  )
}
