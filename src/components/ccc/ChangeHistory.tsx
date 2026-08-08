'use client'

// ChangeHistory (§7): seznam publikací, rozbalovací diff, rollback.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronUp, RotateCcw, CheckCircle2,
  AlertCircle, Loader2, Undo2,
} from 'lucide-react'
import { rollbackAction } from '@/lib/actions/ccc'
import type { Publication } from '@/types/website-contract'

const STATUS_META: Record<string, { label: string; className: string }> = {
  published: { label: 'Publikováno', className: 'bg-emerald-400/10 text-emerald-400' },
  failed: { label: 'Selhalo', className: 'bg-red-400/10 text-red-400' },
  rolled_back: { label: 'Vráceno', className: 'bg-amber-400/10 text-amber-400' },
}

function SnapshotValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-white/25 italic">prázdné</span>
  }
  if (typeof value === 'object') {
    if (!Array.isArray(value) && 'url' in value && typeof value.url === 'string') {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value.url} alt="" className="max-h-16 rounded-lg border border-white/10 object-cover" />
      )
    }
    if (Array.isArray(value)) {
      return <span className="text-white/60">{value.length} položek</span>
    }
    return <code className="text-xs text-white/50 break-all">{JSON.stringify(value)}</code>
  }
  return <span className="text-white/80 whitespace-pre-wrap">{String(value)}</span>
}

export default function ChangeHistory({
  publications,
  canPublish,
}: {
  publications: Publication[]
  canPublish: boolean
}) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [doneId, setDoneId] = useState<string | null>(null)

  const rollback = (id: string) => {
    setError(null)
    startTransition(async () => {
      try {
        await rollbackAction(id)
        setDoneId(id)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Vrácení změny selhalo')
      }
    })
  }

  if (publications.length === 0) {
    return (
      <div className="text-center py-12 text-white/30">
        <Undo2 className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Zatím tu nejsou žádné publikované změny.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-400/5 border border-red-400/20 p-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {publications.map((pub) => {
        const meta = STATUS_META[pub.status] ?? STATUS_META.published
        const open = openId === pub.id
        const items = pub.items_snapshot ?? []
        return (
          <div
            key={pub.id}
            className="rounded-xl border border-white/5 bg-[#0d1525] overflow-hidden"
          >
            <button
              onClick={() => setOpenId(open ? null : pub.id)}
              className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${meta.className}`}
                >
                  {meta.label}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    {new Date(pub.created_at).toLocaleString('cs-CZ')}
                  </p>
                  <p className="text-xs text-white/40">
                    {items.length}{' '}
                    {items.length === 1 ? 'změna' : items.length < 5 ? 'změny' : 'změn'}
                    {pub.is_rollback_of ? ' · vrácení předchozí změny' : ''}
                  </p>
                </div>
              </div>
              {open ? (
                <ChevronUp className="h-4 w-4 text-white/30 shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-white/30 shrink-0" />
              )}
            </button>

            {open && (
              <div className="border-t border-white/5 p-4 space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
                    <p className="text-xs font-medium text-white/60 mb-2">{item.field_key}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg bg-red-400/5 p-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-red-400/60 mb-1">Původní</p>
                        <SnapshotValue value={item.old} />
                      </div>
                      <div className="rounded-lg bg-emerald-400/5 p-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-emerald-400/60 mb-1">Nová</p>
                        <SnapshotValue value={item.new} />
                      </div>
                    </div>
                  </div>
                ))}

                {canPublish && pub.status === 'published' && (
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={() => rollback(pub.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-400/10 disabled:opacity-40 transition-all"
                    >
                      {pending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      Vrátit tuto změnu
                    </button>
                    {doneId === pub.id && (
                      <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" /> Změna byla vrácena
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
