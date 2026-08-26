'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Plus, Trash2, Save, Copy, ArrowLeft, Eye, Loader2, Send, Receipt, User, Mail, CalendarClock, StickyNote,
} from 'lucide-react'
import { getQuote, updateQuote, duplicateQuote, deleteQuote, sendQuoteEmail, type Quote, type QuoteItem } from '@/lib/actions/sales'
import { quoteToHtml, quoteTotals } from '@/lib/email/quote-html'

const fmt = (n: number) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(n)

function newItem(): QuoteItem {
  return { id: crypto.randomUUID(), name: '', qty: 1, unit_price: 0 }
}

export default function QuoteBuilder({ quoteId }: { quoteId: string }) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getQuote(quoteId).then((q) => {
      setQuote(q)
      setLoading(false)
    })
  }, [quoteId])

  const notify = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 2600)
  }

  const set = (k: keyof Quote, v: unknown) => setQuote((p) => (p ? { ...p, [k]: v } : p))

  const updateItem = (id: string, patch: Partial<QuoteItem>) =>
    setQuote((p) => (p ? { ...p, items: p.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) } : p))

  const addItem = () => setQuote((p) => (p ? { ...p, items: [...p.items, newItem()] } : p))
  const removeItem = (id: string) => setQuote((p) => (p ? { ...p, items: p.items.filter((it) => it.id !== id) } : p))

  const save = () => {
    if (!quote) return
    startTransition(async () => {
      await updateQuote(quote.id, quote)
      notify('Nabídka uložena')
    })
  }

  const send = async () => {
    if (!quote) return
    setSending(true)
    try {
      const r = await sendQuoteEmail(quote.id)
      notify(r.message)
      if (r.ok) setQuote((p) => (p ? { ...p, status: 'sent' } : p))
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Chyba')
    } finally {
      setSending(false)
    }
  }

  const duplicate = () =>
    startTransition(async () => {
      const { id } = await duplicateQuote(quoteId)
      window.location.href = `/nabidky/${id}`
    })

  const remove = () =>
    startTransition(async () => {
      if (!confirm('Opravdu smazat nabídku?')) return
      await deleteQuote(quoteId)
      window.location.href = '/nabidky'
    })

  if (loading) return <div className="max-w-6xl mx-auto p-8"><div className="animate-pulse h-96 bg-white/5 rounded-2xl" /></div>
  if (!quote) return <div className="max-w-3xl mx-auto p-8 text-slate-400">Nabídka nenalezena.</div>

  const totals = quoteTotals(quote)
  const inputCls =
    'w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400/40'

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-5">
      {toast && <div className="fixed top-5 right-5 z-50 bg-[#0d1525] border border-cyan-400/30 text-white text-sm px-4 py-3 rounded-xl shadow-2xl">{toast}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/nabidky" className="p-2 rounded-lg bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">Nabídka</h1>
            <p className="text-xs text-slate-500 mt-0.5">{quote.number || ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPreview((v) => !v)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${showPreview ? 'bg-cyan-400/10 border-cyan-400/30 text-cyan-300' : 'bg-white/[0.04] border-white/10 text-slate-300 hover:border-white/25'}`}>
            <Eye className="h-3.5 w-3.5" /> Náhled
          </button>
          <button onClick={duplicate} disabled={isPending} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 text-xs font-medium hover:border-white/25 transition-colors">
            <Copy className="h-3.5 w-3.5" /> Kopie
          </button>
          <button onClick={remove} disabled={isPending} className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-500 hover:text-red-400 hover:border-red-400/30 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={save} disabled={isPending} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs font-semibold hover:border-white/25 transition-colors disabled:opacity-50">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Uložit
          </button>
          <button onClick={send} disabled={sending} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Odeslat mailem
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        {/* Editor */}
        <div className="space-y-4">
          <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5 space-y-3">
            <input className={inputCls + ' !text-lg !font-semibold'} value={quote.title} onChange={(e) => set('title', e.target.value)} placeholder="Název nabídky" />
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-500 uppercase tracking-wider mb-1"><User className="h-3 w-3" /> Klient</label>
                <input className={inputCls} value={quote.client_name || ''} onChange={(e) => set('client_name', e.target.value)} placeholder="Jméno klienta" />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-500 uppercase tracking-wider mb-1"><Mail className="h-3 w-3" /> E-mail klienta</label>
                <input className={inputCls} value={quote.client_email || ''} onChange={(e) => set('client_email', e.target.value)} placeholder="klient@email.cz" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-500 uppercase tracking-wider mb-1"><CalendarClock className="h-3 w-3" /> Platnost do</label>
                <input className={inputCls} value={quote.valid_until || ''} onChange={(e) => set('valid_until', e.target.value)} placeholder="např. 30. 9. 2026" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">DPH %</label>
                <input className={inputCls} type="number" value={quote.vat_rate} onChange={(e) => set('vat_rate', Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Položky */}
          <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Položky</h2>
            </div>
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-[1fr_80px_130px_110px_32px] gap-2 px-1 text-[10px] text-slate-500 uppercase tracking-wider">
                <span>Položka</span><span className="text-right">Množství</span><span className="text-right">Cena/ks</span><span className="text-right">Celkem</span><span />
              </div>
              {quote.items.map((it) => (
                <div key={it.id} className="grid grid-cols-2 sm:grid-cols-[1fr_80px_130px_110px_32px] gap-2 items-center">
                  <input className={inputCls + ' col-span-2 sm:col-span-1'} value={it.name} onChange={(e) => updateItem(it.id, { name: e.target.value })} placeholder="Název položky" />
                  <input className={inputCls + ' text-right'} type="number" value={it.qty} onChange={(e) => updateItem(it.id, { qty: Number(e.target.value) })} />
                  <input className={inputCls + ' text-right'} type="number" value={it.unit_price} onChange={(e) => updateItem(it.id, { unit_price: Number(e.target.value) })} />
                  <div className="text-right text-sm text-white font-semibold">{fmt(Number(it.qty) * Number(it.unit_price))}</div>
                  <button onClick={() => removeItem(it.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 transition-colors justify-self-end">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-3 w-full py-2.5 rounded-xl border border-dashed border-white/15 text-slate-400 text-sm hover:border-cyan-400/40 hover:text-cyan-300 transition-colors flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" /> Přidat položku
            </button>
          </div>

          <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500 uppercase tracking-wider mb-1"><StickyNote className="h-3 w-3" /> Poznámka</label>
            <textarea className={inputCls} rows={3} value={quote.note || ''} onChange={(e) => set('note', e.target.value)} placeholder="Podmínky, poznámky k nabídce…" />
          </div>
        </div>

        {/* Souhrn + náhled */}
        <div className="space-y-4">
          <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Souhrn</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-300"><span>Mezisoučet</span><span>{fmt(totals.subtotal)}</span></div>
              <div className="flex justify-between text-slate-400"><span>DPH {totals.vatRate} %</span><span>{fmt(totals.vat)}</span></div>
              <div className="flex justify-between text-lg font-bold text-white pt-3 border-t border-white/10">
                <span>Celkem</span><span className="text-cyan-400">{fmt(totals.total)}</span>
              </div>
            </div>
          </div>

          {showPreview && (
            <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Náhled e-mailu</h3>
              <div
                className="bg-white rounded-lg overflow-hidden max-h-[520px] overflow-y-auto [&_*]:!max-w-none"
                dangerouslySetInnerHTML={{ __html: quoteToHtml({ quote, companyName: 'WebDo24' }) }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
