'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Globe, FileText, Inbox, Activity, ExternalLink } from 'lucide-react'
import { listConnectedWebsites } from '@/lib/actions/website-connect'
import type { ConnectedWebsite } from '@/types/website-connection'

const STATUS_BADGE: Record<string, { label: string; cls: string; dot: string }> = {
  CONNECTED: { label: 'Připojeno', cls: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30', dot: 'bg-emerald-400' },
  DEGRADED: { label: 'Omezeně', cls: 'bg-amber-400/10 text-amber-300 border-amber-400/30', dot: 'bg-amber-400' },
  FAILED: { label: 'Chyba', cls: 'bg-red-400/10 text-red-300 border-red-400/30', dot: 'bg-red-400' },
  DISCONNECTED: { label: 'Odpojeno', cls: 'bg-slate-400/10 text-slate-400 border-slate-400/30', dot: 'bg-slate-400' },
  DRAFT: { label: 'Koncept', cls: 'bg-slate-400/10 text-slate-400 border-slate-400/30', dot: 'bg-slate-400' },
  AUDITING: { label: 'Audit', cls: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30', dot: 'bg-cyan-400' },
  READY: { label: 'Připraveno', cls: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30', dot: 'bg-cyan-400' },
  INSTALLING: { label: 'Instaluje se', cls: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30', dot: 'bg-cyan-400' },
  VERIFYING: { label: 'Ověřuje se', cls: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30', dot: 'bg-cyan-400' },
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'před chvílí'
  if (diff < 3600) return `před ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} h`
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1 text-[11px] ${ok ? 'text-emerald-300' : 'text-slate-600'}`}>
      {ok ? '✓' : '○'} {label}
    </span>
  )
}

export default function WebsitesView() {
  const [sites, setSites] = useState<ConnectedWebsite[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listConnectedWebsites().then((s) => {
      setSites(s)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="max-w-6xl mx-auto p-8"><div className="animate-pulse h-72 bg-white/5 rounded-2xl" /></div>

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Weby</h1>
          <p className="mt-1 text-sm text-slate-400">Připojené weby — obsah, formuláře a poptávky na jednom místě.</p>
        </div>
        <Link
          href="/weby/pripojit"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Připojit web
        </Link>
      </div>

      {sites.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sites.map((s) => {
            const st = STATUS_BADGE[s.connection_status] || STATUS_BADGE.DRAFT
            return (
              <Link key={s.id} href={`/weby/${s.id}`} className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5 flex flex-col hover:border-cyan-400/20 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                      <Globe className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white truncate">{s.title}</h3>
                      <p className="text-[11px] text-slate-500 truncate">{s.domain || s.site_id || '—'}</p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wide border ${st.cls} shrink-0`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} /> {st.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-3">
                  {s.framework && <span className="px-1.5 py-0.5 rounded bg-white/5">{s.framework}</span>}
                  {s.connector_version && <span>connector v{s.connector_version}</span>}
                </div>

                <div className="flex items-center gap-3 mt-auto pt-3 border-t border-white/5">
                  <Check ok={s.content_connected} label="Obsah" />
                  <Check ok={s.forms_connected} label="Formuláře" />
                  <Check ok={s.tracking_connected} label="Sledování" />
                  <span className="ml-auto text-[10px] text-slate-600">sync {timeAgo(s.last_sync_at)}</span>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="bg-[#0d1525]/80 border border-dashed border-white/10 rounded-2xl p-12 text-center">
          <Globe className="h-10 w-10 mx-auto mb-3 text-slate-700" />
          <p className="text-slate-400 text-sm mb-1">Zatím žádný připojený web</p>
          <p className="text-slate-600 text-xs mb-4">Připojte první web a spravujte jeho obsah a poptávky</p>
          <Link href="/weby/pripojit" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] text-sm font-semibold hover:opacity-90">
            <Plus className="h-4 w-4" /> Připojit web
          </Link>
        </div>
      )}
    </div>
  )
}
