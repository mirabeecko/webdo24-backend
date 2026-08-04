'use client'

import { useState, useTransition } from 'react'
import {
  User, Building2, Bell, Sparkles, Mail, Shield,
  CreditCard, CheckCircle2, AlertCircle, Loader2,
  ExternalLink,
} from 'lucide-react'
import { updateProfile, toggleAutomation, sendChangeEmailLink, updateEmailPrefs } from '@/lib/actions/settings'
import EmailRoutingView from './EmailRoutingView'

// ── Types ─────────────────────────────────────────────────────────

interface Profile {
  id: string
  name: string | null
  company: string | null
  phone: string | null
  ico: string | null
  dic: string | null
  address: string | null
}

interface Automation {
  id: string
  automation_key: string
  enabled: boolean
  template: string | null
}

interface EmailPrefs {
  notifications_enabled: boolean
  marketing_enabled: boolean
}

interface Props {
  profile: Profile | null
  automations: Automation[]
  emailPrefs: EmailPrefs | null
  userEmail: string
  stripeCustomerId: string | null
}

// ── Static meta ───────────────────────────────────────────────────

const AUTO_META: Record<string, { title: string; desc: string; iconColor: string }> = {
  auto_reply:     { title: 'Automatická odpověď zákazníkovi', desc: 'Zákazník dostane potvrzení, že poptávka dorazila',      iconColor: 'bg-blue-50 text-blue-600' },
  notify_owner:  { title: 'Upozornění na novou poptávku',    desc: 'SMS + push notifikace při každé nové poptávce',          iconColor: 'bg-amber-50 text-amber-600' },
  follow_up:     { title: 'Připomínka zákazníkovi',          desc: 'Po 24 h bez odpovědi odešle zákazníkovi připomínku',     iconColor: 'bg-purple-50 text-purple-600' },
  review_request:{ title: 'Žádost o hodnocení',              desc: 'Po dokončení zakázky požádá zákazníka o Google recenzi', iconColor: 'bg-emerald-50 text-emerald-600' },
}

const AI_META: Record<string, { title: string; desc: string }> = {
  ai_reply:   { title: 'AI návrhy odpovědí',       desc: 'AI navrhne odpověď na každou poptávku' },
  ai_improve: { title: 'Vylepšování textů na webu', desc: 'AI upraví texty, aby působily profesionálněji' },
  ai_social:  { title: 'Příspěvky na sociální sítě', desc: 'AI generuje FB a IG příspěvky z referencí' },
}

// ── Helpers ───────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = 'text', placeholder, hint, required,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; hint?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-gray-400 focus:border-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/8 transition-colors"
      />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function SectionHeader({ icon: Icon, title, sub, iconBg }: { icon: React.ComponentType<{ className?: string }>; title: string; sub: string; iconBg: string }) {
  return (
    <div className="flex items-center gap-3 mb-5 pb-5 border-b border-gray-50">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="font-semibold text-[#0F172A]">{title}</h2>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </div>
  )
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-7 w-12 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A]/30 ${checked ? 'bg-[#0F172A]' : 'bg-gray-200'} disabled:opacity-40`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function SaveButton({ pending, saved, error }: { pending: boolean; saved: boolean; error: string | null }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-40 transition-all shadow-sm"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? 'Ukládám…' : 'Uložit změny'}
      </button>
      {saved && !pending && (
        <span className="flex items-center gap-1.5 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" /> Uloženo
        </span>
      )}
      {error && (
        <span className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" /> {error}
        </span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

export default function SettingsView({ profile, automations, emailPrefs, userEmail, stripeCustomerId }: Props) {
  // Profile state
  const [name, setName]       = useState(profile?.name    ?? '')
  const [company, setCompany] = useState(profile?.company ?? '')
  const [phone, setPhone]     = useState(profile?.phone   ?? '')
  const [ico, setIco]         = useState(profile?.ico     ?? '')
  const [dic, setDic]         = useState(profile?.dic     ?? '')
  const [address, setAddress] = useState(profile?.address ?? '')

  const [profilePending, startProfileTransition] = useTransition()
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [aresLoading, setAresLoading] = useState(false)

  // Email change state
  const [newEmail, setNewEmail]   = useState('')
  const [emailPending, startEmailTransition] = useTransition()
  const [emailMsg, setEmailMsg]   = useState<{ ok: boolean; text: string } | null>(null)

  // Automations state
  const [autos, setAutos] = useState(automations)
  const [autoPending, startAutoTransition] = useTransition()

  // Email preferences state
  const [prefs, setPrefs] = useState<EmailPrefs>({
    notifications_enabled: emailPrefs?.notifications_enabled ?? true,
    marketing_enabled: emailPrefs?.marketing_enabled ?? true,
  })
  const [prefsPending, startPrefsTransition] = useTransition()

  // Billing portal
  const [billingLoading, setBillingLoading] = useState(false)

  // ── Handlers ────────────────────────────────────────────────────

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError(null)
    setProfileSaved(false)
    startProfileTransition(async () => {
      try {
        await updateProfile({ name, company, phone, ico, dic, address })
        setProfileSaved(true)
        setTimeout(() => setProfileSaved(false), 3000)
      } catch (err) {
        setProfileError(err instanceof Error ? err.message : 'Chyba při ukládání')
      }
    })
  }

  const handleLoadFromAres = async () => {
    const cleanIco = ico.replace(/\s/g, '')
    if (!/^\d{8}$/.test(cleanIco)) {
      setProfileError('Zadej platné IČO (8 číslic)')
      return
    }
    setAresLoading(true)
    setProfileError(null)
    try {
      const res = await fetch(`/api/ares?ico=${cleanIco}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Načtení z ARES selhalo')

      if (data.name) setCompany(data.name)
      if (data.vat_id) setDic(data.vat_id)
      if (data.address) setAddress(data.address)
      if (!name && data.name) setName(data.name)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Chyba při načítání z ARES')
    } finally {
      setAresLoading(false)
    }
  }

  const handleToggle = (id: string, current: boolean) => {
    setAutos((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !current } : a)))
    startAutoTransition(async () => {
      try {
        await toggleAutomation(id, !current)
      } catch {
        // revert on failure
        setAutos((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: current } : a)))
      }
    })
  }

  const handleEmailChange = (e: React.FormEvent) => {
    e.preventDefault()
    setEmailMsg(null)
    startEmailTransition(async () => {
      try {
        await sendChangeEmailLink(newEmail)
        setEmailMsg({ ok: true, text: `Potvrzovací email odeslán na ${newEmail}. Na novou adresu jsme poslali potvrzovací odkaz.` })
        setNewEmail('')
      } catch (err) {
        setEmailMsg({ ok: false, text: err instanceof Error ? err.message : 'Chyba' })
      }
    })
  }

  const handleBillingPortal = async () => {
    setBillingLoading(true)
    try {
      const res = await fetch('/api/stripe/customer-portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      // ignore
    } finally {
      setBillingLoading(false)
    }
  }

  const handlePrefToggle = (key: keyof EmailPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    startPrefsTransition(async () => {
      try {
        await updateEmailPrefs(next)
      } catch {
        setPrefs(prefs)
      }
    })
  }

  const autoItems = autos.filter((a) => AUTO_META[a.automation_key])
  const aiItems   = autos.filter((a) => AI_META[a.automation_key])

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-2xl mx-auto px-4 lg:px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">Nastavení</h1>
          <p className="mt-1.5 text-gray-500">Spravujte svůj profil, fakturaci a automatizace</p>
        </header>

        {/* ── PROFIL ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <SectionHeader icon={User} title="Profil" sub="Základní kontaktní údaje" iconBg="bg-gray-100 text-gray-600" />
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Jméno a příjmení" value={name} onChange={setName} placeholder="Jan Novák" required />
              <Field label="Telefon" value={phone} onChange={setPhone} type="tel" placeholder="+420 777 000 000" />
            </div>
            <Field label="Název firmy" value={company} onChange={setCompany} placeholder="Novák & Co s.r.o." />
            <SaveButton pending={profilePending} saved={profileSaved} error={profileError} />
          </form>
        </section>

        {/* ── FAKTURAČNÍ ÚDAJE ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <SectionHeader icon={Building2} title="Fakturační údaje" sub="Zobrazí se na fakturách" iconBg="bg-blue-50 text-blue-600" />
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">
                  IČO
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ico}
                    onChange={(e) => setIco(e.target.value)}
                    placeholder="12345678"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-gray-400 focus:border-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/8 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleLoadFromAres}
                    disabled={aresLoading}
                    className="shrink-0 rounded-xl border border-[#0F172A] px-3.5 py-2.5 text-sm font-semibold text-[#0F172A] hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    {aresLoading ? 'Načítám…' : 'ARES'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-400">Identifikační číslo firmy</p>
              </div>
              <Field label="DIČ" value={dic} onChange={setDic} placeholder="CZ12345678" hint="Jen pokud jste plátce DPH" />
            </div>
            <Field
              label="Fakturační adresa"
              value={address}
              onChange={setAddress}
              placeholder="Ulice 123, 100 00 Praha 1"
            />
            <SaveButton pending={profilePending} saved={profileSaved} error={profileError} />
          </form>
        </section>

        {/* ── AUTOMATIZACE ── */}
        {autoItems.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
            <SectionHeader icon={Bell} title="Automatizace" sub="Nastavte jednou, zapomeňte navždy" iconBg="bg-amber-50 text-amber-600" />
            <div className="space-y-3">
              {autoItems.map((item) => {
                const meta = AUTO_META[item.automation_key]
                return (
                  <div key={item.id} className={`flex items-center justify-between gap-4 rounded-xl p-4 border transition-colors ${item.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0F172A]">{meta.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{meta.desc}</p>
                      {item.enabled && item.template && (
                        <p className="mt-2 text-xs text-gray-500 italic bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">&ldquo;{item.template}&rdquo;</p>
                      )}
                    </div>
                    <Toggle checked={item.enabled} onChange={() => handleToggle(item.id, item.enabled)} disabled={autoPending} />
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── EMAILOVÁ OZNÁMENÍ ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <SectionHeader icon={Mail} title="Emailová oznámení" sub="Vyberte, jaké zprávy chcete dostávat" iconBg="bg-blue-50 text-blue-600" />
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-xl p-4 border border-gray-200">
              <div>
                <p className="text-sm font-medium text-[#0F172A]">Notifikace o aktivitě</p>
                <p className="text-xs text-gray-500 mt-0.5">Nové poptávky, změny na webu, stav požadavků</p>
              </div>
              <Toggle checked={prefs.notifications_enabled} onChange={() => handlePrefToggle('notifications_enabled')} disabled={prefsPending} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl p-4 border border-gray-200">
              <div>
                <p className="text-sm font-medium text-[#0F172A]">Marketingové nabídky</p>
                <p className="text-xs text-gray-500 mt-0.5">Nové služby, tipy a akce pro váš web</p>
              </div>
              <Toggle checked={prefs.marketing_enabled} onChange={() => handlePrefToggle('marketing_enabled')} disabled={prefsPending} />
            </div>
          </div>
        </section>

        {/* ── FIREMNÍ EMAIL ── */}
        <EmailRoutingView />

        {/* ── AI ASISTENT ── */}
        {aiItems.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
            <SectionHeader icon={Sparkles} title="AI asistent" sub="Chytrý pomocník, ne robot" iconBg="bg-violet-50 text-violet-600" />
            <div className="space-y-3">
              {aiItems.map((item) => {
                const meta = AI_META[item.automation_key]
                return (
                  <div key={item.id} className={`flex items-center justify-between gap-4 rounded-xl p-4 border transition-colors ${item.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0F172A]">{meta.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{meta.desc}</p>
                    </div>
                    <Toggle checked={item.enabled} onChange={() => handleToggle(item.id, item.enabled)} disabled={autoPending} />
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── PŘEDPLATNÉ ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <SectionHeader icon={CreditCard} title="Předplatné a platby" sub="Faktury, platební metody, zrušení" iconBg="bg-emerald-50 text-emerald-600" />
          <p className="text-sm text-gray-600 mb-5 leading-relaxed">
            Ve Stripe zákaznickém portálu najdete přehled faktur, stav předplatného a můžete
            kdykoli změnit platební metodu nebo předplatné zrušit.
          </p>
          <button
            onClick={handleBillingPortal}
            disabled={billingLoading || !stripeCustomerId}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition-colors"
          >
            {billingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Otevřít zákaznický portál
          </button>
          {!stripeCustomerId && (
            <p className="mt-2 text-xs text-gray-400">Portál bude dostupný po první platbě.</p>
          )}
        </section>

        {/* ── ZABEZPEČENÍ ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <SectionHeader icon={Shield} title="Zabezpečení" sub="Přihlašovací email" iconBg="bg-red-50 text-red-500" />

          <div className="mb-5 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">Aktuální přihlašovací email</p>
            <p className="text-sm font-medium text-[#0F172A]">{userEmail}</p>
          </div>

          <form onSubmit={handleEmailChange} className="space-y-4">
            <Field
              label="Nový email"
              value={newEmail}
              onChange={setNewEmail}
              type="email"
              placeholder="novy@email.cz"
              hint="Na novou adresu pošleme potvrzovací odkaz."
            />

            {emailMsg && (
              <div className={`flex items-start gap-2 text-sm rounded-xl p-3 ${emailMsg.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                {emailMsg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                {emailMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={emailPending || !newEmail.trim()}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              {emailPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Změnit přihlašovací email
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
