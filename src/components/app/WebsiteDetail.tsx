'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Globe, FileText, Inbox, Plug, History, Activity, ExternalLink, RefreshCw, Power } from 'lucide-react'
import { getWebsiteDetail, disconnectWebsite, reconnectWebsite, websiteHealth } from '@/lib/actions/website-connect'
import type { ConnectedWebsite, WebsiteFormRecord } from '@/types/website-connection'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  CONNECTED: { label: 'Připojeno', cls: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30' },
  DEGRADED: { label: 'Omezeně', cls: 'bg-amber-400/10 text-amber-300 border-amber-400/30' },
  FAILED: { label: 'Chyba', cls: 'bg-red-400/10 text-red-300 border-red-400/30' },
  DISCONNECTED: { label: 'Odpojeno', cls: 'bg-slate-400/10 text-slate-400 border-slate-400/30' },
  DRAFT: { label: 'Koncept', cls: 'bg-slate-400/10 text-slate-400 border-slate-400/30' },
  AUDITING: { label: 'Audit', cls: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30' },
  READY: { label: 'Připraveno', cls: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30' },
  INSTALLING: { label: 'Instaluje se', cls: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30' },
  VERIFYING: { label: 'Ověřuje se', cls: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30' },
}

type Detail = {
  website: ConnectedWebsite
  runs: Array<Record<string, unknown>>
  steps: Array<Record<string, unknown>>
  forms: WebsiteFormRecord[]
  leads: Array<Record<string, unknown>>
}

const TABS = [
  { key: 'overview', label: 'Přehled', icon: Activity },
  { key: 'content', label: 'Obsah', icon: FileText },
  { key: 'forms', label: 'Formuláře', icon: Plug },
  { key: 'leads', label: 'Poptávky', icon: Inbox },
  { key: 'integration', label: 'Integrace', icon: Globe },
  { key: 'history', label: 'Historie', icon: History },
]

function timeAgo(iso: string | null | undefined) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'před chvílí'
  if (diff < 3600) return `před ${Math.floor(diff / 60)} min`
  return new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function WebsiteDetail({ websiteId }: { websiteId: string }) {
  const [data, setData] = useState<Detail | null>(null)
  const [tab, setTab] = useState('overview')
  const [health, setHealth] = useState<{ status: string; checks: Array<{ key: string; label: string; ok: boolean; detail?: string }> } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const load = () =>
    getWebsiteDetail(websiteId).then((d) => {
      setData(d as unknown as Detail)
      setLoading(false)
    })

  useEffect(() => {
    load()
    websiteHealth(websiteId).then(setHealth)
  }, [websiteId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="max-w-6xl mx-auto p-8"><div className="animate-pulse h-96 bg-white/5 rounded-2xl" /></div>
  if (!data) return <div className="max-w-3xl mx-auto p-8 text-slate-400">Web nenalezen.</div>

  const { website, forms, leads, runs, steps } = data
  const st = STATUS_BADGE[website.connection_status] || STATUS_BADGE.DRAFT

  const disconnect = () =>
    startTransition(async () => {
      if (!confirm('Odpojit web? Obsah a historie zůstanou zachované.')) return
      await disconnectWebsite(websiteId)
      await load()
    })

  const reconnect = () =>
    startTransition(async () => {
      await reconnectWebsite(websiteId)
      await load()
    })

  const refreshHealth = () => websiteHealth(websiteId).then(setHealth)

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/weby" className="p-2 rounded-lg bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl lg:text-2xl font-bold text-white truncate">{website.title}</h1>
          <p className="text-xs text-slate-500">{website.domain}{website.site_id ? ` · ${website.site_id}` : ''}</p>
        </div>
        <span className={`px-3 py-1 rounded-lg text-[11px] font-semibold border ${st.cls}`}>{st.label}</span>
        {website.connection_status === 'CONNECTED' || website.connection_status === 'DEGRADED' ? (
          <button onClick={disconnect} disabled={isPending} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 text-xs font-medium hover:border-red-400/30 hover:text-red-300 transition-colors">
            <Power className="h-3.5 w-3.5" /> Odpojit
          </button>
        ) : (
          <button onClick={reconnect} disabled={isPending} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 text-xs font-medium hover:border-cyan-400/30 hover:text-cyan-300 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Znovu připojit
          </button>
        )}
      </div>

      {/* Taby */}
      <div className="flex gap-1 overflow-x-auto border-b border-white/5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === t.key ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Přehled */}
      {tab === 'overview' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Obsah</p>
            <p className={`text-lg font-bold ${website.content_connected ? 'text-emerald-300' : 'text-slate-500'}`}>{website.content_connected ? '✓ Connected' : '○ Nepřipojeno'}</p>
          </div>
          <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Formuláře</p>
            <p className={`text-lg font-bold ${website.forms_connected ? 'text-emerald-300' : 'text-slate-500'}`}>{website.forms_connected ? '✓ Connected' : '○ Nepřipojeno'}</p>
            <p className="text-[11px] text-slate-500 mt-1">{forms.length} formulářů</p>
          </div>
          <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Sledování</p>
            <p className={`text-lg font-bold ${website.tracking_connected ? 'text-emerald-300' : 'text-slate-500'}`}>{website.tracking_connected ? '✓ Connected' : '○ Nepřipojeno'}</p>
          </div>
          <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Framework</p>
            <p className="text-white font-semibold">{website.framework || '—'}</p>
          </div>
          <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Connector</p>
            <p className="text-white font-semibold">{website.connector_version ? `v${website.connector_version}` : '—'}</p>
          </div>
          <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Poslední sync</p>
            <p className="text-white font-semibold">{timeAgo(website.last_sync_at)}</p>
          </div>

          {/* Health */}
          <div className="sm:col-span-2 lg:col-span-3 bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Stav připojení</h3>
              </div>
              <button onClick={refreshHealth} className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"><RefreshCw className="h-3.5 w-3.5" /></button>
            </div>
            {health ? (
              <div className="space-y-2">
                {health.checks.map((c) => (
                  <div key={c.key} className="flex items-center gap-2 text-sm">
                    <span className={c.ok ? 'text-emerald-400' : 'text-red-400'}>{c.ok ? '🟢' : '🔴'}</span>
                    <span className="text-slate-300">{c.label}</span>
                    {c.detail && <span className="text-slate-600 text-[11px]">{c.detail}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Kontrola zatím neproběhla.</p>
            )}
          </div>
        </div>
      )}

      {/* Obsah */}
      {tab === 'content' && (
        <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Obsah webu</h3>
            </div>
            <Link href="/obsah" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-400/10 border border-cyan-400/25 text-cyan-300 text-xs font-medium hover:bg-cyan-400/20 transition-colors">
              <ExternalLink className="h-3.5 w-3.5" /> Otevřít editor obsahu
            </Link>
          </div>
          <p className="text-sm text-slate-400">
            Obsah se upravuje v editoru obsahu (Content Registry) a publikuje verzovaně. Po publikování se nová verze projeví na připojeném webu přes <span className="font-mono text-cyan-300">/api/v1/sites/{'{site_id}'}/content</span>.
          </p>
        </div>
      )}

      {/* Formuláře */}
      {tab === 'forms' && (
        <div className="space-y-2">
          {forms.length > 0 ? (
            forms.map((f) => (
              <div key={f.id} className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                  <Plug className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{f.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">form_id: {f.form_id}{f.source_path ? ` · ${f.source_path}` : ''}</p>
                </div>
                <span className="text-[11px] text-emerald-300">{f.is_connected ? 'Connected ✓' : '○'}</span>
                <span className="text-[11px] text-slate-600">{f.last_submission_at ? `poslední: ${timeAgo(f.last_submission_at)}` : 'žádné'}</span>
              </div>
            ))
          ) : (
            <div className="bg-[#0d1525]/80 border border-dashed border-white/10 rounded-2xl p-8 text-center text-slate-500 text-sm">Žádné formuláře</div>
          )}
        </div>
      )}

      {/* Poptávky */}
      {tab === 'leads' && (
        <div className="space-y-2">
          {leads?.length ? (
            leads.map((l) => (
              <div key={l.id as string} className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${l.status === 'new' ? 'bg-amber-400/15 text-amber-300' : 'bg-white/5 text-slate-400'}`}>
                  {String(l.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{l.name as string}</p>
                  <p className="text-[11px] text-slate-500 truncate">{[l.email, l.phone].filter(Boolean).join(' · ') || l.message as string}</p>
                </div>
                <span className="text-[11px] text-slate-500">{timeAgo(l.created_at as string)}</span>
              </div>
            ))
          ) : (
            <div className="bg-[#0d1525]/80 border border-dashed border-white/10 rounded-2xl p-8 text-center text-slate-500 text-sm">Žádné poptávky</div>
          )}
        </div>
      )}

      {/* Integrace */}
      {tab === 'integration' && (
        <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Integrace</h3>
          </div>
          <div className="bg-black/40 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-1 overflow-x-auto">
            <p className="text-slate-500"># Veřejné integrační API</p>
            <p>GET /api/v1/sites/{'{site_id}'}/content</p>
            <p>GET /api/v1/sites/{'{site_id}'}/health</p>
            <p>POST /api/v1/leads</p>
          </div>
          <p className="text-xs text-slate-500">
            site_id: <span className="font-mono text-cyan-300">{website.site_id || '—'}</span> · allowed_domains: {website.allowed_domains?.join(', ') || '—'}
          </p>
        </div>
      )}

      {/* Historie */}
      {tab === 'history' && (
        <div className="space-y-2">
          <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Běhy připojení</h3>
            {runs?.length ? (
              <div className="space-y-2">
                {runs.map((r) => (
                  <div key={r.id as string} className="flex items-center gap-3 text-sm border-b border-white/5 pb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${r.status === 'COMPLETED' ? 'bg-emerald-400/10 text-emerald-300' : r.status === 'FAILED' ? 'bg-red-400/10 text-red-300' : 'bg-cyan-400/10 text-cyan-300'}`}>{r.status as string}</span>
                    <span className="text-slate-400">{timeAgo(r.created_at as string)}</span>
                    {r.error ? <span className="text-red-300 text-[11px] truncate flex-1">{r.error as string}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Žádné záznamy</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
