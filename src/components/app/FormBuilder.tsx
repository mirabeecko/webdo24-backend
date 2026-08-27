'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Plus, Trash2, GripVertical, Save, Copy, ArrowLeft, Eye,
  Loader2, Check, LinkIcon, ExternalLink, Settings2, Send,
} from 'lucide-react'
import { getForm, updateForm, duplicateForm, deleteForm, type CrmForm, type FormField } from '@/lib/actions/sales'

function formPublicUrl(id: string) {
  return `${window.location.origin}/f/${id}`
}

const FIELD_TYPES: Array<{ key: FormField['type']; label: string }> = [
  { key: 'text', label: 'Text' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefon' },
  { key: 'textarea', label: 'Dlouhý text' },
  { key: 'select', label: 'Výběr (select)' },
  { key: 'date', label: 'Datum' },
  { key: 'number', label: 'Číslo' },
]

function newField(): FormField {
  return { id: crypto.randomUUID(), label: 'Nové pole', type: 'text', required: false, placeholder: '' }
}

export default function FormBuilder({ formId }: { formId: string }) {
  const [form, setForm] = useState<CrmForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getForm(formId).then((f) => {
      setForm(f)
      setLoading(false)
    })
  }, [formId])

  const notify = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 2200)
  }

  const set = (k: keyof CrmForm, v: unknown) => setForm((p) => (p ? { ...p, [k]: v } : p))

  const updateField = (id: string, patch: Partial<FormField>) =>
    setForm((p) => (p ? { ...p, fields: p.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) } : p))

  const addField = () => setForm((p) => (p ? { ...p, fields: [...p.fields, newField()] } : p))
  const removeField = (id: string) => setForm((p) => (p ? { ...p, fields: p.fields.filter((f) => f.id !== id) } : p))

  const save = () => {
    if (!form) return
    startTransition(async () => {
      await updateForm(form.id, form)
      notify('Formulář uložen')
    })
  }

  const duplicate = () =>
    startTransition(async () => {
      const { id } = await duplicateForm(formId)
      window.location.href = `/formulare/${id}`
    })

  const remove = () =>
    startTransition(async () => {
      if (!confirm('Opravdu smazat formulář?')) return
      await deleteForm(formId)
      window.location.href = '/formulare'
    })

  const copyLink = () => {
    const url = formPublicUrl(formId)
    navigator.clipboard?.writeText(url).catch(() => {})
    notify('Odkaz zkopírován: ' + url)
  }

  if (loading) return <div className="max-w-6xl mx-auto p-8"><div className="animate-pulse h-96 bg-white/5 rounded-2xl" /></div>
  if (!form) return <div className="max-w-3xl mx-auto p-8 text-slate-400">Formulář nenalezen.</div>

  const inputCls =
    'w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400/40'

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-5">
      {toast && <div className="fixed top-5 right-5 z-50 bg-[#0d1525] border border-cyan-400/30 text-white text-sm px-4 py-3 rounded-xl shadow-2xl">{toast}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/formulare" className="p-2 rounded-lg bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">Formulář</h1>
            <p className="text-xs text-slate-500 mt-0.5">Postavte pole a odešlete odkaz klientovi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => copyLink()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 text-xs font-medium hover:border-white/25 transition-colors">
            <LinkIcon className="h-3.5 w-3.5" /> Zkopírovat odkaz
          </button>
          <a href={formPublicUrl(formId)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-cyan-300 text-xs font-medium hover:border-cyan-400/30 transition-colors">
            <ExternalLink className="h-3.5 w-3.5" /> Náhled
          </a>
          <button onClick={duplicate} disabled={isPending} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 text-xs font-medium hover:border-white/25 transition-colors">
            <Copy className="h-3.5 w-3.5" /> Kopie
          </button>
          <button onClick={remove} disabled={isPending} className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-500 hover:text-red-400 hover:border-red-400/30 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={save} disabled={isPending} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Uložit
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Editor */}
        <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Nastavení a pole</h2>
          </div>

          <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Název formuláře" />
          <input className={inputCls} value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Popis (nepovinné)" />

          <div className="space-y-2.5">
            {form.fields.map((f, i) => (
              <div key={f.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <GripVertical className="h-4 w-4 text-slate-600 shrink-0" />
                  <span className="text-[10px] text-slate-600 w-5 shrink-0">#{i + 1}</span>
                  <input
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-white focus:outline-none"
                    value={f.label}
                    onChange={(e) => updateField(f.id, { label: e.target.value })}
                  />
                  <select
                    className="px-2 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-xs text-slate-300 focus:outline-none"
                    value={f.type}
                    onChange={(e) => updateField(f.id, { type: e.target.value as FormField['type'] })}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                  <button onClick={() => removeField(f.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-3 pl-6">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <input type="checkbox" checked={f.required} onChange={(e) => updateField(f.id, { required: e.target.checked })} className="accent-cyan-400" />
                    povinné
                  </label>
                  <input
                    className="flex-1 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
                    value={f.placeholder || ''}
                    onChange={(e) => updateField(f.id, { placeholder: e.target.value })}
                    placeholder="placeholder…"
                  />
                  {f.type === 'select' && (
                    <input
                      className="flex-1 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
                      value={(f.options || []).join(', ')}
                      onChange={(e) => updateField(f.id, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                      placeholder="možnosti oddělené čárkou"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <button onClick={addField} className="w-full py-2.5 rounded-xl border border-dashed border-white/15 text-slate-400 text-sm hover:border-cyan-400/40 hover:text-cyan-300 transition-colors flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" /> Přidat pole
          </button>

          <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider">Text tlačítka</label>
              <input className={inputCls + ' mt-1'} value={form.submit_button || ''} onChange={(e) => set('submit_button', e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider">Zpráva po odeslání</label>
              <input className={inputCls + ' mt-1'} value={form.success_message || ''} onChange={(e) => set('success_message', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Náhled */}
        <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Živý náhled</h2>
          </div>
          <div className="form-light bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900 mb-1">{form.name || 'Formulář'}</h3>
            {form.description && <p className="text-sm text-slate-500 mb-5">{form.description}</p>}
            <div className="space-y-3">
              {form.fields.map((f) => (
                <div key={f.id}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {f.label || 'Pole'} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea readOnly placeholder={f.placeholder} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 bg-white" />
                  ) : f.type === 'select' ? (
                    <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-900">
                      <option>Vyberte…</option>
                    </select>
                  ) : (
                    <input readOnly placeholder={f.placeholder} type={f.type === 'date' ? 'date' : 'text'} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 bg-white" />
                  )}
                </div>
              ))}
              <button className="w-full py-2.5 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 text-white font-semibold text-sm flex items-center justify-center gap-1.5">
                <Send className="h-3.5 w-3.5" /> {form.submit_button || 'Odeslat'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
