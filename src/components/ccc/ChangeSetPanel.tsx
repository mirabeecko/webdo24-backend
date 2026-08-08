'use client'

// ChangeSetPanel: diff + akce nad jedním ChangeSetem (§16, §5, §6).
// Sdílený pro ContentEditor, BrandingForm i CompanyForm – všude stejná
// cesta draft → náhled → schválení → publikování.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Eye, CheckCircle2, Rocket, Trash2, Loader2, AlertCircle,
} from 'lucide-react'
import DiffView from '@/components/ccc/DiffView'
import PreviewFrame from '@/components/ccc/PreviewFrame'
import {
  requestPreviewAction,
  approveAction,
  publishAction,
  cancelChangeSetAction,
} from '@/lib/actions/ccc'
import type { ChangeSetWithItems } from '@/types/website-contract'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Návrh',
  validated: 'Zkontrolováno',
  preview_ready: 'Náhled připraven',
  approved: 'Schváleno',
  publishing: 'Publikuji…',
  published: 'Publikováno',
  publish_failed: 'Publikování selhalo',
  cancelled: 'Zahozeno',
}

export default function ChangeSetPanel({
  changeset,
  canPublish,
  onClose,
}: {
  changeset: ChangeSetWithItems
  canPublish: boolean
  onClose?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const run = (fn: () => Promise<unknown>) => {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Akce selhala')
      }
    })
  }

  const handlePreview = () =>
    run(async () => {
      const result = await requestPreviewAction(changeset.id)
      setPreviewUrl(result.previewUrl)
    })

  const status = changeset.status
  const canPreview = status === 'draft' || status === 'validated'
  const canApprove = canPublish && status === 'preview_ready'
  const canPublishNow = canPublish && status === 'approved'
  const canCancel = ['draft', 'validated', 'preview_ready'].includes(status)

  return (
    <div className="rounded-xl border border-cyan-400/20 bg-[#0d1525] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{changeset.title}</p>
          <p className="text-xs text-white/40 mt-0.5">
            Stav: {STATUS_LABELS[status] ?? status} ·{' '}
            {new Date(changeset.created_at).toLocaleString('cs-CZ')}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Zavřít
          </button>
        )}
      </div>

      <DiffView items={changeset.items} />

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-400/5 border border-red-400/20 p-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canPreview && (
          <button
            onClick={handlePreview}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/5 px-4 py-2 text-sm font-medium text-cyan-400 hover:bg-cyan-400/10 disabled:opacity-40 transition-all"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Zobrazit náhled
          </button>
        )}
        {(status === 'preview_ready' || status === 'approved') && !previewUrl && (
          <button
            onClick={handlePreview}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-40 transition-all"
          >
            <Eye className="h-4 w-4" />
            Znovu zobrazit náhled
          </button>
        )}
        {canApprove && (
          <button
            onClick={() => run(() => approveAction(changeset.id))}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a0e17] hover:bg-cyan-300 disabled:opacity-40 transition-all"
          >
            <CheckCircle2 className="h-4 w-4" />
            Schválit
          </button>
        )}
        {canPublishNow && (
          <button
            onClick={() => run(() => publishAction(changeset.id))}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#0a0e17] hover:bg-emerald-300 disabled:opacity-40 transition-all"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Publikovat
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => run(() => cancelChangeSetAction(changeset.id))}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-400/10 disabled:opacity-40 transition-all"
          >
            <Trash2 className="h-4 w-4" />
            Zahodit
          </button>
        )}
      </div>

      {previewUrl && <PreviewFrame url={previewUrl} />}
    </div>
  )
}
