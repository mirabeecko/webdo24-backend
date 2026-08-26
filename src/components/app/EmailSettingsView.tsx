'use client'

import { useEffect, useState, useTransition } from 'react'
import { Mail, Save, Send, Loader2, Check, ShieldCheck } from 'lucide-react'
import { getEmailSettings, saveEmailSettings, testEmail, type EmailSettings } from '@/lib/actions/sales'

export default function EmailSettingsView() {
  const [settings, setSettings] = useState<EmailSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [testTo, setTestTo] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getEmailSettings().then((s) => {
      setSettings(s)
      setTestTo(s?.from_email || '')
      setLoading(false)
    })
  }, [])

  const set = (k: keyof EmailSettings, v: unknown) =>
    setSettings((prev) => ({ ...(prev || {}), [k]: v } as EmailSettings))

  const save = () => {
    if (!settings) return
    startTransition(async () => {
      try {
        await saveEmailSettings(settings)
        setMsg({ ok: true, text: 'Nastavení uloženo' })
      } catch (e) {
        setMsg({ ok: false, text: e instanceof Error ? e.message : 'Chyba' })
      }
    })
  }

  const test = () => {
    if (!testTo.trim()) return
    startTransition(async () => {
      const r = await testEmail(testTo.trim())
      setMsg({ ok: r.ok, text: r.message })
    })
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto p-8"><div className="animate-pulse h-72 bg-white/5 rounded-2xl" /></div>
  }

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400/40'

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-8 space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">E-mail</h1>
        <p className="mt-1 text-sm text-slate-400">Odesílání e-mailů z vaší vlastní adresy (SMTP). Nabídky, formuláře a odpovědi na poptávky půjdou vaším mailem.</p>
      </div>

      <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">SMTP server</h2>
        </div>

        <div className="grid sm:grid-cols-[1fr_140px_120px] gap-3">
          <div>
            <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Host (SMTP)</label>
            <input className={inputCls + ' mt-1'} value={settings?.smtp_host || ''} onChange={(e) => set('smtp_host', e.target.value)} placeholder="smtp.seznam.cz" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Port</label>
            <input className={inputCls + ' mt-1'} type="number" value={settings?.smtp_port || 587} onChange={(e) => set('smtp_port', Number(e.target.value))} />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Zabezpečení</label>
            <select className={inputCls + ' mt-1'} value={settings?.smtp_secure || 'tls'} onChange={(e) => set('smtp_secure', e.target.value as 'tls' | 'ssl' | 'none')}>
              <option value="tls">TLS (STARTTLS)</option>
              <option value="ssl">SSL</option>
              <option value="none">Žádné</option>
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Uživatel</label>
            <input className={inputCls + ' mt-1'} value={settings?.smtp_user || ''} onChange={(e) => set('smtp_user', e.target.value)} placeholder="dousa.elektro@seznam.cz" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Heslo</label>
            <input className={inputCls + ' mt-1'} type="password" value={settings?.smtp_pass || ''} onChange={(e) => set('smtp_pass', e.target.value)} placeholder="••••••••" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Jméno odesílatele</label>
            <input className={inputCls + ' mt-1'} value={settings?.from_name || ''} onChange={(e) => set('from_name', e.target.value)} placeholder="Pavel Douša" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">E-mail odesílatele</label>
            <input className={inputCls + ' mt-1'} type="email" value={settings?.from_email || ''} onChange={(e) => set('from_email', e.target.value)} placeholder="dousa.elektro@seznam.cz" />
          </div>
        </div>

        <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-2">
          <button
            onClick={save}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Uložit
          </button>
          {msg && (
            <span className={`text-xs flex items-center gap-1 ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {msg.ok ? <Check className="h-3 w-3" /> : null} {msg.text}
            </span>
          )}
        </div>
      </div>

      {/* Test odeslání */}
      <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Otestovat odeslání</h2>
        </div>
        <p className="text-xs text-slate-500 mb-3">Pošleme testovací e-mail na zadanou adresu, abyste ověřili nastavení SMTP.</p>
        <div className="flex gap-2">
          <input className={inputCls} type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="kam poslat test" />
          <button
            onClick={test}
            disabled={isPending || !testTo.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm font-medium hover:border-white/25 transition-colors disabled:opacity-40 shrink-0"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Odeslat test
          </button>
        </div>
      </div>
    </div>
  )
}
