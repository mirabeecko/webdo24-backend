'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Loader2, Check, AlertTriangle, Globe, FileText, Inbox, Sparkles } from 'lucide-react'
import { startConnection, completeConnection, type StartConnectionInput } from '@/lib/actions/website-connect'
import { CONNECTION_STEPS } from '@/lib/website-connection/status'
import type { DiscoveryResult } from '@/types/website-connection'

type Phase = 'form' | 'preview' | 'installing' | 'done' | 'error'

export default function ConnectWizard() {
  const [phase, setPhase] = useState<Phase>('form')
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [method, setMethod] = useState<StartConnectionInput['connectionMethod']>('local')
  const [localPath, setLocalPath] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [repoBranch, setRepoBranch] = useState('')
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null)
  const [websiteId, setWebsiteId] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [siteId, setSiteId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [activeStep, setActiveStep] = useState(0)
  const [isPending, startTransition] = useTransition()

  const inputCls =
    'w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400/40'

  const submit = () => {
    if (!name.trim() || !domain.trim()) return
    setError('')
    startTransition(async () => {
      try {
        const r = await startConnection({
          name: name.trim(),
          domain: domain.trim(),
          connectionMethod: method,
          localPath: method === 'local' ? localPath.trim() || undefined : undefined,
          repositoryUrl: method === 'github' ? repoUrl.trim() || undefined : undefined,
          repositoryBranch: repoBranch.trim() || undefined,
        })
        setWebsiteId(r.websiteId)
        setRunId(r.runId)
        setDiscovery(r.discovery)
        setPhase('preview')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Chyba')
      }
    })
  }

  const install = () => {
    if (!websiteId || !runId || !discovery) return
    setError('')
    setPhase('installing')
    setActiveStep(0)
    startTransition(async () => {
      // animace kroku (průběh se reálně dokončí v completeConnection)
      let i = 0
      const timer = setInterval(() => {
        i = Math.min(i + 1, CONNECTION_STEPS.length - 1)
        setActiveStep(i)
      }, 220)
      try {
        const r = await completeConnection(websiteId, runId, discovery)
        clearInterval(timer)
        setActiveStep(CONNECTION_STEPS.length - 1)
        setSiteId(r.siteId)
        setPhase('done')
      } catch (e) {
        clearInterval(timer)
        setError(e instanceof Error ? e.message : 'Chyba')
        setPhase('error')
      }
    })
  }

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-8 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/weby" className="p-2 rounded-lg bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">Připojit web</h1>
          <p className="text-xs text-slate-500 mt-0.5">Průvodce připojením webu k backendu</p>
        </div>
      </div>

      {/* ── Form ── */}
      {phase === 'form' && (
        <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Základní informace</h2>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Název webu</label>
            <input className={inputCls + ' mt-1'} value={name} onChange={(e) => setName(e.target.value)} placeholder="Např. Pavel Douša – Elektroinstalace" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Doména / URL</label>
            <input className={inputCls + ' mt-1'} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.cz" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Způsob přístupu</label>
            <select className={inputCls + ' mt-1'} value={method} onChange={(e) => setMethod(e.target.value as StartConnectionInput['connectionMethod'])}>
              <option value="local">Lokální projekt (cesta)</option>
              <option value="github">GitHub repository</option>
              <option value="git">Git repository</option>
              <option value="deployment">Existující deployment</option>
            </select>
          </div>
          {method === 'local' && (
            <div>
              <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Lokální cesta</label>
              <input className={inputCls + ' mt-1'} value={localPath} onChange={(e) => setLocalPath(e.target.value)} placeholder="/Users/mb/dev/customer-website" />
            </div>
          )}
          {method === 'github' && (
            <div className="grid sm:grid-cols-[1fr_160px] gap-3">
              <div>
                <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">URL repository</label>
                <input className={inputCls + ' mt-1'} value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/…/repo" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Branch</label>
                <input className={inputCls + ' mt-1'} value={repoBranch} onChange={(e) => setRepoBranch(e.target.value)} placeholder="main" />
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={submit}
            disabled={isPending || !name.trim() || !domain.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Analyzovat web
          </button>
        </div>
      )}

      {/* ── Preview auditu ── */}
      {phase === 'preview' && discovery && (
        <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Nalezeno</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Framework</p>
              <p className="text-white font-medium">{discovery.framework}</p>
              {discovery.package_manager && <p className="text-[11px] text-slate-500 mt-1">PM: {discovery.package_manager}{discovery.deploy_target ? ` · ${discovery.deploy_target}` : ''}</p>}
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Obsah</p>
              <p className="text-white font-medium">{discovery.content.length} polí</p>
              <p className="text-[11px] text-slate-500 mt-1">hero, služby, o nás, kontakt, SEO…</p>
            </div>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Formuláře ({discovery.forms.length})</p>
            {discovery.forms.length > 0 ? (
              <ul className="space-y-1">
                {discovery.forms.map((f) => (
                  <li key={f.form_id} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check className="h-3.5 w-3.5 text-emerald-400" /> {f.name} <span className="text-slate-600 text-[11px]">· {f.fields.length} polí</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Žádné formuláře nenalezeny</p>
            )}
          </div>
          {discovery.warnings.length > 0 && (
            <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-3 space-y-1">
              {discovery.warnings.map((w) => (
                <p key={w} className="flex items-center gap-2 text-[12px] text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {w}
                </p>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setPhase('form')} className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 text-sm font-medium hover:border-white/25 transition-colors">
              Zpět
            </button>
            <button
              onClick={install}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Nainstalovat propojení
            </button>
          </div>
        </div>
      )}

      {/* ── Instalace ── */}
      {phase === 'installing' && (
        <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Připojuji web</h2>
          <div className="space-y-2">
            {CONNECTION_STEPS.map((s, i) => {
              const state = i < activeStep ? 'done' : i === activeStep ? 'running' : 'pending'
              return (
                <div key={s.key} className="flex items-center gap-3 text-sm">
                  <span className={`w-5 text-center ${state === 'done' ? 'text-emerald-400' : state === 'running' ? 'text-cyan-400' : 'text-slate-600'}`}>
                    {state === 'done' ? '✓' : state === 'running' ? '◐' : '○'}
                  </span>
                  <span className={state === 'pending' ? 'text-slate-600' : 'text-slate-200'}>{s.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Hotovo ── */}
      {phase === 'done' && (
        <div className="bg-[#0d1525]/80 border border-emerald-400/20 rounded-2xl p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-emerald-400/10 flex items-center justify-center text-emerald-400 text-2xl">✓</div>
          <h2 className="text-lg font-bold text-white">Web je připojen</h2>
          <p className="text-sm text-slate-400 mt-1">site_id: <span className="font-mono text-cyan-300">{siteId}</span></p>
          <Link href={`/weby/${websiteId}`} className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] text-sm font-semibold hover:opacity-90">
            Otevřít detail webu
          </Link>
        </div>
      )}

      {/* ── Chyba ── */}
      {phase === 'error' && (
        <div className="bg-[#0d1525]/80 border border-red-400/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h2 className="text-sm font-semibold text-white">Nepodařilo se dokončit propojení</h2>
          </div>
          <pre className="text-xs text-red-300 bg-red-400/5 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{error}</pre>
          <div className="flex gap-2 mt-4">
            <button onClick={install} className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 text-sm font-medium hover:border-white/25">
              Zkusit znovu
            </button>
            <button onClick={() => setPhase('form')} className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 text-sm font-medium hover:border-white/25">
              Zobrazit detail
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
