'use client'

// Veřejná stránka formuláře (zákazník pošle odkaz svému klientovi)
// /f/[formId] — bez přihlášení

import { useEffect, useState } from 'react'
import type { FormField } from '@/lib/actions/sales'

interface PublicForm {
  name: string
  description: string | null
  fields: FormField[]
  submit_button: string
  success_message: string
}

export default function PublicFormPage({ formId }: { formId: string }) {
  const [form, setForm] = useState<PublicForm | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [state, setState] = useState<'loading' | 'ready' | 'sending' | 'done' | 'error' | 'missing'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await fetch(`/api/forms/${formId}`)
        if (!res.ok) {
          if (alive) setState('missing')
          return
        }
        const json = await res.json()
        if (alive) {
          setForm(json.form)
          setState('ready')
        }
      } catch {
        if (alive) setState('missing')
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [formId])

  const submit = async () => {
    if (!form) return
    setState('sending')
    setError('')
    try {
      const res = await fetch(`/api/forms/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chyba odeslání')
      setState('done')
    } catch (e) {
      setState('error')
      setError(e instanceof Error ? e.message : 'Chyba odeslání')
    }
  }

  if (state === 'loading') {
    return <Shell><p className="text-slate-500 text-sm">Načítám formulář…</p></Shell>
  }
  if (state === 'missing') {
    return <Shell><p className="text-slate-500 text-sm">Formulář neexistuje nebo není aktivní.</p></Shell>
  }
  if (state === 'done' && form) {
    return (
      <Shell>
        <div className="text-center py-6">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl">✓</div>
          <p className="text-slate-700 font-medium">{form.success_message}</p>
        </div>
      </Shell>
    )
  }
  if (!form) return null

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400'

  return (
    <Shell>
      <h1 className="text-xl font-bold text-slate-900 mb-1">{form.name}</h1>
      {form.description && <p className="text-sm text-slate-500 mb-6">{form.description}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="space-y-4"
      >
        {form.fields.map((f) => (
          <div key={f.id}>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {f.label} {f.required && <span className="text-red-500">*</span>}
            </label>
            {f.type === 'textarea' ? (
              <textarea
                required={f.required}
                value={values[f.id] || ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                placeholder={f.placeholder}
                rows={4}
                className={inputCls}
              />
            ) : f.type === 'select' ? (
              <select
                required={f.required}
                value={values[f.id] || ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                className={inputCls}
              >
                <option value="">Vyberte…</option>
                {(f.options || []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                type={f.type === 'phone' ? 'tel' : f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : 'text'}
                required={f.required}
                value={values[f.id] || ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                placeholder={f.placeholder}
                className={inputCls}
              />
            )}
          </div>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={state === 'sending'}
          className="w-full py-3.5 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {state === 'sending' ? 'Odesílám…' : form.submit_button || 'Odeslat'}
        </button>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center p-4">
      <div className="form-light w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
        {children}
      </div>
    </div>
  )
}
