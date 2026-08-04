'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, ExternalLink } from 'lucide-react'
import type { ChangeStatus, ChangeCategory } from '@/types'

const STATUS_OPTIONS: ChangeStatus[] = [
  'new', 'classifying', 'planning', 'executing',
  'preview_ready', 'approved', 'publishing', 'published',
  'rejected', 'failed', 'escalated',
]

const CATEGORY_OPTIONS: ChangeCategory[] = [
  'trivial', 'content', 'media', 'structure', 'design', 'page', 'heavy', 'unknown',
]

interface AuditEntry {
  id: string
  action: string
  diff: Record<string, unknown> | null
  created_at: string
}

interface Props {
  cr: {
    id: string
    raw_input: string
    category: ChangeCategory | null
    confidence: number | null
    status: ChangeStatus
    error_message: string | null
    draft_version_id: string | null
    published_version_id: string | null
    created_at: string
    resolved_at: string | null
    project: {
      id: string
      title: string
      slug: string
      production_url: string | null
      customer: { name: string; id: string } | null
    } | null
  }
  auditLog: AuditEntry[]
}

export default function AdminChangeDetailClient({ cr, auditLog }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<ChangeStatus>(cr.status)
  const [category, setCategory] = useState<ChangeCategory>(cr.category ?? 'unknown')
  const [previewUrl, setPreviewUrl] = useState('')
  const [draftVersionId, setDraftVersionId] = useState(cr.draft_version_id ?? '')
  const [errorMessage, setErrorMessage] = useState(cr.error_message ?? '')
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const handleSave = () => {
    setSavedMsg(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/change-requests/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: cr.id,
            status,
            category,
            preview_url: previewUrl || undefined,
            draft_version_id: draftVersionId || undefined,
            error_message: errorMessage || null,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'update_failed')
        setSavedMsg('Uloženo')
        router.refresh()
      } catch (e) {
        setSavedMsg(e instanceof Error ? `Chyba: ${e.message}` : 'Chyba')
      }
    })
  }

  return (
    <div>
      <Link href="/admin/pozadavky" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Zpět na seznam
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          {/* Request text */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Požadavek zákazníka</h2>
            <p className="text-gray-900 leading-relaxed">{cr.raw_input}</p>
            <div className="mt-3 flex gap-3 text-xs text-gray-400">
              <span>{new Date(cr.created_at).toLocaleString('cs-CZ')}</span>
              {cr.project?.customer?.name && (
                <span>· {cr.project.customer.name}</span>
              )}
              {cr.project?.slug && (
                <span>· {cr.project.slug}</span>
              )}
            </div>
          </div>

          {/* Edit form */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Správa požadavku</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as ChangeStatus)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Kategorie</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as ChangeCategory)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
                >
                  {CATEGORY_OPTIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Preview URL</label>
              <input
                type="url"
                value={previewUrl}
                onChange={e => setPreviewUrl(e.target.value)}
                placeholder="https://preview.webdo24.cz/..."
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-400">Vyplň a nastav status na preview_ready — zákazník dostane tlačítko "Schválit"</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Draft Version ID</label>
              <input
                type="text"
                value={draftVersionId}
                onChange={e => setDraftVersionId(e.target.value)}
                placeholder="UUID verze webu"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 focus:border-gray-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Chybová zpráva</label>
              <input
                type="text"
                value={errorMessage}
                onChange={e => setErrorMessage(e.target.value)}
                placeholder="Popis chyby (volitelné)"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleSave}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-40 transition-all"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Uložit změny
              </button>
              {savedMsg && (
                <span className={`text-sm ${savedMsg.startsWith('Chyba') ? 'text-red-600' : 'text-emerald-600'}`}>
                  {savedMsg}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Info */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Info</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">ID</dt>
                <dd className="font-mono text-xs text-gray-700 truncate max-w-[160px]">{cr.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Confidence</dt>
                <dd className="text-gray-700">{cr.confidence != null ? `${Math.round(cr.confidence * 100)} %` : '—'}</dd>
              </div>
              {cr.project?.production_url && (
                <div className="flex justify-between items-center">
                  <dt className="text-gray-500">Live web</dt>
                  <dd>
                    <a href={cr.project.production_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs">
                      Otevřít <ExternalLink className="h-3 w-3" />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Audit Log */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Audit log</h2>
            {auditLog.length === 0 ? (
              <p className="text-xs text-gray-400">Žádné záznamy</p>
            ) : (
              <ul className="space-y-3">
                {auditLog.map(entry => (
                  <li key={entry.id} className="text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-mono font-medium text-gray-700">{entry.action}</span>
                      <span className="text-gray-400">{new Date(entry.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {entry.diff && (
                      <pre className="text-[10px] text-gray-400 whitespace-pre-wrap break-all bg-gray-50 rounded p-1.5 mt-1">
                        {JSON.stringify(entry.diff, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
