'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus, Copy, Trash2, Pencil, ExternalLink, Inbox, FileText, LinkIcon } from 'lucide-react'
import { listForms, createForm, createFormFromTemplate, duplicateForm, deleteForm, type CrmForm } from '@/lib/actions/sales'
import { FORM_TEMPLATES } from '@/lib/form-templates'

function formPublicUrl(id: string) {
  return `${window.location.origin}/f/${id}`
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} h`
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
}

export default function FormsView() {
  const [forms, setForms] = useState<CrmForm[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = () => listForms().then((f) => setForms(f))

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  const notify = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 2200)
  }

  const handleCreate = () =>
    startTransition(async () => {
      const { id } = await createForm('Nový formulář')
      window.location.href = `/formulare/${id}`
    })

  const handleLoadTemplate = (key: string) =>
    startTransition(async () => {
      const { id } = await createFormFromTemplate(key)
      window.location.href = `/formulare/${id}`
    })

  const handleDuplicate = (id: string) =>
    startTransition(async () => {
      await duplicateForm(id)
      await load()
      notify('Formulář zkopírován')
    })

  const handleDelete = (id: string) =>
    startTransition(async () => {
      if (!confirm('Opravdu smazat formulář?')) return
      await deleteForm(id)
      await load()
      notify('Formulář smazán')
    })

  const copyLink = (id: string) => {
    const url = formPublicUrl(id)
    navigator.clipboard?.writeText(url).catch(() => {})
    notify('Odkaz zkopírován: ' + url)
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto p-8"><div className="animate-pulse h-64 bg-white/5 rounded-2xl" /></div>
  }

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-8 space-y-5">
      {toast && <div className="fixed top-5 right-5 z-50 bg-[#0d1525] border border-cyan-400/30 text-white text-sm px-4 py-3 rounded-xl shadow-2xl">{toast}</div>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Formuláře</h1>
          <p className="mt-1 text-sm text-slate-400">Postavte si vlastní formulář, pošlete klientovi odkaz a poptávky dorazí rovnou do CRM.</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Nový formulář
        </button>
      </div>

      {/* Předpřipravené oborové šablony */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Předpřipravené šablony</h2>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-300 border border-cyan-400/20 uppercase">v ceně</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FORM_TEMPLATES.map((t) => (
            <div key={t.key} className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-4 flex flex-col hover:border-cyan-400/20 transition-colors">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg leading-none">{t.icon}</span>
                <h3 className="font-semibold text-white text-sm leading-tight">{t.name}</h3>
              </div>
              <p className="text-xs text-slate-500 mb-3 flex-1">{t.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-600">{t.fields.length} polí</span>
                <button
                  onClick={() => handleLoadTemplate(t.key)}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 text-xs font-medium hover:bg-cyan-400/20 transition-colors disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" /> Načíst šablonu
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {forms.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {forms.map((f) => (
            <div key={f.id} className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5 flex flex-col hover:border-cyan-400/20 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white truncate">{f.name}</h3>
                    <p className="text-[11px] text-slate-500">{f.fields?.length || 0} polí · {timeAgo(f.updated_at)}</p>
                  </div>
                </div>
                {f.status === 'archived' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500 uppercase">archiv</span>}
              </div>

              <div className="flex items-center gap-1.5 mt-auto pt-3 border-t border-white/5">
                <Link href={`/formulare/${f.id}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-slate-300 text-[11px] font-medium hover:border-white/25 transition-colors">
                  <Pencil className="h-3 w-3" /> Upravit
                </Link>
                <button onClick={() => handleDuplicate(f.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-slate-300 text-[11px] font-medium hover:border-white/25 transition-colors">
                  <Copy className="h-3 w-3" /> Kopie
                </button>
                <button onClick={() => copyLink(f.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-slate-300 text-[11px] font-medium hover:border-white/25 transition-colors">
                  <LinkIcon className="h-3 w-3" /> Odkaz
                </button>
                <a href={formPublicUrl(f.id)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-cyan-400 text-[11px] font-medium hover:text-cyan-300 transition-colors ml-auto">
                  <ExternalLink className="h-3 w-3" /> Náhled
                </a>
                <button onClick={() => handleDelete(f.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#0d1525]/80 border border-dashed border-white/10 rounded-2xl p-12 text-center">
          <Inbox className="h-10 w-10 mx-auto mb-3 text-slate-700" />
          <p className="text-slate-400 text-sm mb-1">Zatím žádné formuláře</p>
          <p className="text-slate-600 text-xs mb-4">Vytvořte první formulář a pošlete ho klientovi</p>
          <button onClick={handleCreate} disabled={isPending} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] text-sm font-semibold hover:opacity-90">
            <Plus className="h-4 w-4" /> Nový formulář
          </button>
        </div>
      )}
    </div>
  )
}
