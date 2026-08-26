'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus, Copy, Trash2, Pencil, Receipt, FileText } from 'lucide-react'
import { listQuotes, createQuote, duplicateQuote, deleteQuote, type Quote } from '@/lib/actions/sales'
import { quoteTotals } from '@/lib/email/quote-html'

const fmt = (n: number) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(n)

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Koncept', cls: 'bg-slate-400/10 text-slate-300 border-slate-400/30' },
  sent: { label: 'Odeslána', cls: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30' },
  accepted: { label: 'Přijata', cls: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30' },
  declined: { label: 'Odmítnuta', cls: 'bg-red-400/10 text-red-300 border-red-400/30' },
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} h`
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
}

export default function QuotesView() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = () => listQuotes().then((q) => setQuotes(q))

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  const notify = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 2200)
  }

  const handleCreate = () =>
    startTransition(async () => {
      const { id } = await createQuote()
      window.location.href = `/nabidky/${id}`
    })

  const handleDuplicate = (id: string) =>
    startTransition(async () => {
      await duplicateQuote(id)
      await load()
      notify('Nabídka zkopírována')
    })

  const handleDelete = (id: string) =>
    startTransition(async () => {
      if (!confirm('Opravdu smazat nabídku?')) return
      await deleteQuote(id)
      await load()
      notify('Nabídka smazána')
    })

  if (loading) return <div className="max-w-5xl mx-auto p-8"><div className="animate-pulse h-64 bg-white/5 rounded-2xl" /></div>

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-8 space-y-5">
      {toast && <div className="fixed top-5 right-5 z-50 bg-[#0d1525] border border-cyan-400/30 text-white text-sm px-4 py-3 rounded-xl shadow-2xl">{toast}</div>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Nabídky</h1>
          <p className="mt-1 text-sm text-slate-400">Tvořte nabídky s položkami — součet se počítá okamžitě, odešlete je mailem.</p>
        </div>
        <button onClick={handleCreate} disabled={isPending} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" /> Nová nabídka
        </button>
      </div>

      {quotes.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {quotes.map((q) => {
            const st = STATUS[q.status] || STATUS.draft
            const totals = quoteTotals(q)
            return (
              <div key={q.id} className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5 flex flex-col hover:border-cyan-400/20 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                      <Receipt className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white truncate">{q.title}</h3>
                      <p className="text-[11px] text-slate-500">{q.number || ''}{q.client_name ? ` · ${q.client_name}` : ''}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wide border ${st.cls} shrink-0`}>{st.label}</span>
                </div>

                <div className="flex items-end justify-between mt-3">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Celkem</p>
                    <p className="text-lg font-bold text-white">{fmt(totals.total)}</p>
                  </div>
                  <p className="text-[11px] text-slate-600">{timeAgo(q.updated_at)}</p>
                </div>

                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/5">
                  <Link href={`/nabidky/${q.id}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-slate-300 text-[11px] font-medium hover:border-white/25 transition-colors">
                    <Pencil className="h-3 w-3" /> Upravit
                  </Link>
                  <button onClick={() => handleDuplicate(q.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-slate-300 text-[11px] font-medium hover:border-white/25 transition-colors">
                    <Copy className="h-3 w-3" /> Kopie
                  </button>
                  <button onClick={() => handleDelete(q.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors ml-auto">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-[#0d1525]/80 border border-dashed border-white/10 rounded-2xl p-12 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-slate-700" />
          <p className="text-slate-400 text-sm mb-1">Zatím žádné nabídky</p>
          <p className="text-slate-600 text-xs mb-4">Vytvořte první nabídku a pošlete ji klientovi</p>
          <button onClick={handleCreate} disabled={isPending} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] text-sm font-semibold hover:opacity-90">
            <Plus className="h-4 w-4" /> Nová nabídka
          </button>
        </div>
      )}
    </div>
  )
}
