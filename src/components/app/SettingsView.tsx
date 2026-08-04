'use client'

import { useState, useTransition } from 'react'
import {
  User, Building2, Bell, Sparkles, Mail, Shield,
  CreditCard, CheckCircle2, AlertCircle, Loader2,
  ExternalLink, MessageCircle, Smartphone, Globe,
  Lock, Unlock, Copy, Zap, Lightbulb, ThumbsUp,
  X, ArrowRight, Download, Rocket, Settings2,
} from 'lucide-react'
import {
  updateProfile, toggleAutomation, sendChangeEmailLink, updateEmailPrefs,
} from '@/lib/actions/settings'
import {
  saveTelegramPhone, toggleSandbox, saveCustomDomain,
  acceptSuggestion, dismissSuggestion,
} from '@/lib/actions/mvp'
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

interface TelegramSettings { telegram_phone: string | null; telegram_connected: boolean }
interface SandboxStatus { sandbox_enabled: boolean; sandbox_url: string | null; production_url: string | null; status: string }
interface DomainSettings { custom_domain: string | null; custom_domain_verified: boolean }
interface Suggestion {
  id: string; title: string; description: string | null;
  category: string; priority: string; status: string; created_at: string
}

interface Props {
  profile: Profile | null
  automations: Automation[]
  emailPrefs: EmailPrefs | null
  userEmail: string
  stripeCustomerId: string | null
  telegram: TelegramSettings | null
  sandbox: SandboxStatus | null
  domain: DomainSettings | null
  suggestions: Suggestion[]
}

// ── Static meta ───────────────────────────────────────────────────

const AUTO_META: Record<string, { title: string; desc: string }> = {
  auto_reply:     { title: 'Automatická odpověď', desc: 'Zákazník dostane potvrzení, že poptávka dorazila' },
  notify_owner:   { title: 'Upozornění na poptávku', desc: 'Notifikace při každé nové poptávce' },
  follow_up:      { title: 'Připomínka zákazníkovi', desc: 'Po 24 h bez odpovědi odešle připomínku' },
  review_request: { title: 'Žádost o hodnocení', desc: 'Po dokončení požádá o Google recenzi' },
}

const AI_META: Record<string, { title: string; desc: string }> = {
  ai_reply:    { title: 'AI návrhy odpovědí', desc: 'AI navrhne odpověď na každou poptávku' },
  ai_improve:  { title: 'Vylepšování textů', desc: 'AI upraví texty, aby působily profesionálněji' },
  ai_social:   { title: 'Příspěvky na sítě', desc: 'AI generuje FB a IG příspěvky z referencí' },
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'border-l-red-500 bg-red-500/5', medium: 'border-l-amber-500 bg-amber-500/5', low: 'border-l-emerald-500 bg-emerald-500/5',
}

// ── Components ────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, sub, accent = 'text-cyan-400' }: {
  icon: React.ComponentType<{ className?: string }>; title: string; sub: string; accent?: string
}) {
  return (
    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
      <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
        <Icon className={`h-5 w-5 ${accent}`} />
      </div>
      <div>
        <h2 className="font-semibold text-white">{title}</h2>
        <p className="text-xs text-white/40">{sub}</p>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/10 transition-all"
      />
      {hint && <p className="mt-1 text-xs text-white/30">{hint}</p>}
    </div>
  )
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} onClick={onChange} disabled={disabled}
      className={`relative h-7 w-12 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30 ${
        checked ? 'bg-cyan-400' : 'bg-white/10'
      } disabled:opacity-40`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-[#0a0e17] shadow-sm transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      }`} />
    </button>
  )
}

function SaveButton({ pending, saved, error }: { pending: boolean; saved: boolean; error: string | null }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button type="submit" disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2 text-sm font-semibold text-[#0a0e17] hover:bg-cyan-300 disabled:opacity-40 transition-all"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? 'Ukládám…' : 'Uložit'}
      </button>
      {saved && !pending && (
        <span className="flex items-center gap-1.5 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Uloženo</span>
      )}
      {error && (
        <span className="flex items-center gap-1.5 text-sm text-red-400"><AlertCircle className="h-4 w-4" /> {error}</span>
      )}
    </div>
  )
}

function HintBox({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
      <Icon className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
      <div className="text-sm text-white/60">{children}</div>
    </div>
  )
}

function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0e17] border border-white/10 font-mono text-sm">
      <code className="flex-1 text-cyan-300 text-xs break-all">{text}</code>
      <button
        onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
      >
        {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-white/30" />}
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

export default function SettingsView({
  profile, automations, emailPrefs, userEmail, stripeCustomerId,
  telegram, sandbox, domain, suggestions,
}: Props) {
  // Profile
  const [name, setName] = useState(profile?.name ?? '')
  const [company, setCompany] = useState(profile?.company ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [ico, setIco] = useState(profile?.ico ?? '')
  const [dic, setDic] = useState(profile?.dic ?? '')
  const [address, setAddress] = useState(profile?.address ?? '')
  const [profilePending, startProfileTransition] = useTransition()
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [aresLoading, setAresLoading] = useState(false)

  // Telegram
  const [tgPhone, setTgPhone] = useState(telegram?.telegram_phone ?? '')
  const [tgPending, startTgTransition] = useTransition()
  const [tgSaved, setTgSaved] = useState(false)

  // Sandbox
  const [sandboxOn, setSandboxOn] = useState(sandbox?.sandbox_enabled ?? true)
  const [sandboxPending, startSandboxTransition] = useTransition()

  // Domain
  const [customDomain, setCustomDomain] = useState(domain?.custom_domain ?? '')
  const [domainPending, startDomainTransition] = useTransition()
  const [domainSaved, setDomainSaved] = useState(false)

  // Email change
  const [newEmail, setNewEmail] = useState('')
  const [emailPending, startEmailTransition] = useTransition()
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Automations
  const [autos, setAutos] = useState(automations)
  const [autoPending, startAutoTransition] = useTransition()

  // Email prefs
  const [prefs, setPrefs] = useState<EmailPrefs>({
    notifications_enabled: emailPrefs?.notifications_enabled ?? true,
    marketing_enabled: emailPrefs?.marketing_enabled ?? true,
  })
  const [prefsPending, startPrefsTransition] = useTransition()
  const [billingLoading, setBillingLoading] = useState(false)

  // ── Handlers ────────────────────────────────────────────────────

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault(); setProfileError(null); setProfileSaved(false)
    startProfileTransition(async () => {
      try { await updateProfile({ name, company, phone, ico, dic, address }); setProfileSaved(true); setTimeout(() => setProfileSaved(false), 3000) }
      catch (err) { setProfileError(err instanceof Error ? err.message : 'Chyba při ukládání') }
    })
  }

  const handleAres = async () => {
    const cleanIco = ico.replace(/\s/g, '')
    if (!/^\d{8}$/.test(cleanIco)) { setProfileError('Zadej platné IČO (8 číslic)'); return }
    setAresLoading(true); setProfileError(null)
    try {
      const res = await fetch(`/api/ares?ico=${cleanIco}`); const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Načtení z ARES selhalo')
      if (data.name) setCompany(data.name)
      if (data.vat_id) setDic(data.vat_id)
      if (data.address) setAddress(data.address)
      if (!name && data.name) setName(data.name)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Chyba při načítání z ARES')
    } finally { setAresLoading(false) }
  }

  const handleTelegramSave = (e: React.FormEvent) => {
    e.preventDefault(); setTgSaved(false)
    startTgTransition(async () => {
      try { await saveTelegramPhone(tgPhone); setTgSaved(true); setTimeout(() => setTgSaved(false), 3000) }
      catch {}
    })
  }

  const handleSandboxToggle = () => {
    const next = !sandboxOn; setSandboxOn(next)
    startSandboxTransition(async () => { try { await toggleSandbox(next) } catch { setSandboxOn(!next) } })
  }

  const handleDomainSave = (e: React.FormEvent) => {
    e.preventDefault(); setDomainSaved(false)
    startDomainTransition(async () => {
      try { await saveCustomDomain(customDomain); setDomainSaved(true); setTimeout(() => setDomainSaved(false), 3000) }
      catch {}
    })
  }

  const handleToggle = (id: string, current: boolean) => {
    setAutos((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !current } : a)))
    startAutoTransition(async () => {
      try { await toggleAutomation(id, !current) }
      catch { setAutos((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: current } : a))) }
    })
  }

  const handleEmailChange = (e: React.FormEvent) => {
    e.preventDefault(); setEmailMsg(null)
    startEmailTransition(async () => {
      try { await sendChangeEmailLink(newEmail); setEmailMsg({ ok: true, text: `Potvrzovací email odeslán na ${newEmail}.` }); setNewEmail('') }
      catch (err) { setEmailMsg({ ok: false, text: err instanceof Error ? err.message : 'Chyba' }) }
    })
  }

  const handleBillingPortal = async () => {
    setBillingLoading(true)
    try { const res = await fetch('/api/stripe/customer-portal', { method: 'POST' }); const data = await res.json(); if (data.url) window.location.href = data.url }
    catch {} finally { setBillingLoading(false) }
  }

  const handlePrefToggle = (key: keyof EmailPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] }; setPrefs(next)
    startPrefsTransition(async () => { try { await updateEmailPrefs(next) } catch { setPrefs(prefs) } })
  }

  const handleAccept = (id: string) => { acceptSuggestion(id).catch(() => {}) }
  const handleDismiss = (id: string) => { dismissSuggestion(id).catch(() => {}) }

  const autoItems = autos.filter((a) => AUTO_META[a.automation_key])
  const aiItems = autos.filter((a) => AI_META[a.automation_key])
  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending')

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <div className="max-w-2xl mx-auto px-4 lg:px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Nastavení</h1>
          <p className="mt-1.5 text-white/40">Spravujte svůj web, doménu a automatizace</p>
        </header>

        {/* ═══ TELEGRAM ═══ */}
        <section className="bg-[#0d1525] rounded-2xl border border-white/5 shadow-sm p-6 mb-4">
          <SectionHeader icon={MessageCircle} title="Telegram" sub="Propojte svůj telefon s Telegramem" />
          <form onSubmit={handleTelegramSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Telefonní číslo pro Telegram" value={tgPhone} onChange={setTgPhone} type="tel" placeholder="+420 777 000 000" hint="Stejné číslo, které používáte v Telegramu" />
              <div className="flex items-end pb-0.5">
                <a
                  href="https://telegram.org/dl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/5 px-4 py-2.5 text-sm font-medium text-cyan-400 hover:bg-cyan-400/10 transition-all w-full justify-center"
                >
                  <Download className="h-4 w-4" />
                  Stáhnout Telegram
                </a>
              </div>
            </div>
            <HintBox icon={Lightbulb}>
              <p className="mb-1 font-medium text-white/80">Jak na to:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Stáhněte si Telegram do mobilu nebo počítače</li>
                <li>Zaregistrujte se svým telefonním číslem</li>
                <li>Zadejte stejné číslo sem — budeme vás přes Telegram informovat o změnách</li>
              </ol>
            </HintBox>
            <SaveButton pending={tgPending} saved={tgSaved} error={null} />
          </form>
        </section>

        {/* ═══ SANDBOX ═══ */}
        <section className="bg-[#0d1525] rounded-2xl border border-white/5 shadow-sm p-6 mb-4">
          <SectionHeader icon={sandboxOn ? Unlock : Lock} title="Sandbox" sub={sandboxOn ? 'Testovací režim je aktivní — web není veřejně dostupný' : 'Sandbox je vypnutý — web je online'} accent={sandboxOn ? 'text-amber-400' : 'text-emerald-400'} />
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
              <div>
                <p className="text-sm font-medium text-white">Sandbox režim</p>
                <p className="text-xs text-white/40 mt-0.5">V sandboxu můžete web bezpečně testovat. Veřejnost ho neuvidí.</p>
              </div>
              <Toggle checked={sandboxOn} onChange={handleSandboxToggle} disabled={sandboxPending} />
            </div>
            {sandboxOn && sandbox?.sandbox_url && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-amber-400/5 border border-amber-400/20">
                <div>
                  <p className="text-xs text-amber-400/60 uppercase tracking-wider mb-1">Sandbox URL</p>
                  <a href={sandbox.sandbox_url} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-400 hover:underline font-mono">
                    {sandbox.sandbox_url}
                  </a>
                </div>
                <ExternalLink className="h-4 w-4 text-amber-400/40" />
              </div>
            )}
          </div>
        </section>

        {/* ═══ CUSTOM DOMAIN ═══ */}
        <section className="bg-[#0d1525] rounded-2xl border border-white/5 shadow-sm p-6 mb-4">
          <SectionHeader icon={Globe} title="Vlastní doména" sub="Přiřaďte svou doménu k webu" />
          <form onSubmit={handleDomainSave} className="space-y-4">
            <Field label="Vaše doména" value={customDomain} onChange={setCustomDomain} placeholder="www.mujweb.cz" hint="Např. www.truhlarstvi-novak.cz" />
            {domain?.custom_domain && !domain?.custom_domain_verified && (
              <HintBox icon={Settings2}>
                <div className="space-y-3">
                  <p className="font-medium text-white/80">Pro ověření domény přidejte tento TXT záznam do DNS:</p>
                  <div className="space-y-1 text-xs text-white/50">
                    <p><span className="text-white/30">Typ:</span> TXT</p>
                    <p><span className="text-white/30">Název:</span> @ (nebo ponechte prázdné)</p>
                    <p><span className="text-white/30">Hodnota:</span></p>
                  </div>
                  <CodeBlock text={`webdo24-verify-${domain.custom_domain}`} />
                  <p className="text-xs text-white/30">Po přidání záznamu počkejte až 24 hodin na ověření. Poté nasměrujte DNS A záznam na náš server.</p>
                </div>
              </HintBox>
            )}
            {domain?.custom_domain_verified && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-400/5 border border-emerald-400/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">Doména ověřena</span>
              </div>
            )}
            <SaveButton pending={domainPending} saved={domainSaved} error={null} />
          </form>
        </section>

        {/* ═══ NÁVRHY NA UPDATE ═══ */}
        <section className="bg-[#0d1525] rounded-2xl border border-white/5 shadow-sm p-6 mb-4">
          <SectionHeader icon={Zap} title="Návrhy na vylepšení" sub="AI pravidelně analyzuje váš web a doporučuje změny" />
          {pendingSuggestions.length > 0 ? (
            <div className="space-y-3">
              {pendingSuggestions.map((s) => (
                <div key={s.id} className={`rounded-xl border-l-4 p-4 ${PRIORITY_COLORS[s.priority] || 'border-l-white/10 bg-white/[0.02]'} border border-white/5`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          s.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                          s.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>{s.priority === 'high' ? 'Priorita' : s.priority === 'medium' ? 'Doporučeno' : 'Nápad'}</span>
                        <span className="text-[10px] text-white/30 uppercase">{s.category}</span>
                      </div>
                      <p className="text-sm font-medium text-white">{s.title}</p>
                      {s.description && <p className="text-xs text-white/40 mt-1">{s.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleAccept(s.id)}
                        className="p-1.5 rounded-lg hover:bg-emerald-400/10 text-white/30 hover:text-emerald-400 transition-colors"
                        title="Přijmout"><ThumbsUp className="h-4 w-4" /></button>
                      <button onClick={() => handleDismiss(s.id)}
                        className="p-1.5 rounded-lg hover:bg-red-400/10 text-white/30 hover:text-red-400 transition-colors"
                        title="Zamítnout"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-white/30">
              <Lightbulb className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Zatím žádné návrhy.</p>
              <p className="text-xs mt-1">AI bude váš web pravidelně analyzovat a doporučovat vylepšení.</p>
            </div>
          )}
        </section>

        {/* ═══ PROFIL ═══ */}
        <section className="bg-[#0d1525] rounded-2xl border border-white/5 shadow-sm p-6 mb-4">
          <SectionHeader icon={User} title="Profil" sub="Základní kontaktní údaje" />
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Jméno a příjmení" value={name} onChange={setName} placeholder="Jan Novák" />
              <Field label="Telefon" value={phone} onChange={setPhone} type="tel" placeholder="+420 777 000 000" />
            </div>
            <Field label="Název firmy" value={company} onChange={setCompany} placeholder="Novák & Co s.r.o." />
            <SaveButton pending={profilePending} saved={profileSaved} error={profileError} />
          </form>
        </section>

        {/* ═══ FAKTURAČNÍ ÚDAJE ═══ */}
        <section className="bg-[#0d1525] rounded-2xl border border-white/5 shadow-sm p-6 mb-4">
          <SectionHeader icon={Building2} title="Fakturační údaje" sub="Zobrazí se na fakturách" />
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/60">IČO</label>
                <div className="flex gap-2">
                  <input type="text" value={ico} onChange={(e) => setIco(e.target.value)} placeholder="12345678"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/10 transition-all" />
                  <button type="button" onClick={handleAres} disabled={aresLoading}
                    className="shrink-0 rounded-xl border border-cyan-400/30 bg-cyan-400/5 px-3.5 py-2.5 text-sm font-medium text-cyan-400 hover:bg-cyan-400/10 disabled:opacity-40 transition-all">
                    {aresLoading ? 'Načítám…' : 'ARES'}
                  </button>
                </div>
              </div>
              <Field label="DIČ" value={dic} onChange={setDic} placeholder="CZ12345678" />
            </div>
            <Field label="Fakturační adresa" value={address} onChange={setAddress} placeholder="Ulice 123, 100 00 Praha 1" />
            <SaveButton pending={profilePending} saved={profileSaved} error={profileError} />
          </form>
        </section>

        {/* ═══ AUTOMATIZACE ═══ */}
        {autoItems.length > 0 && (
          <section className="bg-[#0d1525] rounded-2xl border border-white/5 shadow-sm p-6 mb-4">
            <SectionHeader icon={Bell} title="Automatizace" sub="Nastavte jednou, zapomeňte navždy" />
            <div className="space-y-2">
              {autoItems.map((item) => {
                const meta = AUTO_META[item.automation_key]
                return (
                  <div key={item.id} className={`flex items-center justify-between gap-4 rounded-xl p-4 border transition-colors ${
                    item.enabled ? 'border-white/10 bg-white/[0.02]' : 'border-white/5 bg-white/[0.01]'
                  }`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{meta.title}</p>
                      <p className="text-xs text-white/40 mt-0.5">{meta.desc}</p>
                    </div>
                    <Toggle checked={item.enabled} onChange={() => handleToggle(item.id, item.enabled)} disabled={autoPending} />
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ═══ EMAILOVÁ OZNÁMENÍ ═══ */}
        <section className="bg-[#0d1525] rounded-2xl border border-white/5 shadow-sm p-6 mb-4">
          <SectionHeader icon={Mail} title="Emailová oznámení" sub="Jaké zprávy chcete dostávat" />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4 rounded-xl p-4 border border-white/10 bg-white/[0.02]">
              <div>
                <p className="text-sm font-medium text-white">Notifikace o aktivitě</p>
                <p className="text-xs text-white/40 mt-0.5">Nové poptávky, změny na webu, stav požadavků</p>
              </div>
              <Toggle checked={prefs.notifications_enabled} onChange={() => handlePrefToggle('notifications_enabled')} disabled={prefsPending} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl p-4 border border-white/10 bg-white/[0.02]">
              <div>
                <p className="text-sm font-medium text-white">Marketingové nabídky</p>
                <p className="text-xs text-white/40 mt-0.5">Nové služby, tipy a akce pro váš web</p>
              </div>
              <Toggle checked={prefs.marketing_enabled} onChange={() => handlePrefToggle('marketing_enabled')} disabled={prefsPending} />
            </div>
          </div>
        </section>

        {/* ═══ FIREMNÍ EMAIL ═══ */}
        <EmailRoutingView />

        {/* ═══ AI ASISTENT ═══ */}
        {aiItems.length > 0 && (
          <section className="bg-[#0d1525] rounded-2xl border border-white/5 shadow-sm p-6 mb-4">
            <SectionHeader icon={Sparkles} title="AI asistent" sub="Chytrý pomocník, ne robot" />
            <div className="space-y-2">
              {aiItems.map((item) => {
                const meta = AI_META[item.automation_key]
                return (
                  <div key={item.id} className={`flex items-center justify-between gap-4 rounded-xl p-4 border transition-colors ${
                    item.enabled ? 'border-white/10 bg-white/[0.02]' : 'border-white/5 bg-white/[0.01]'
                  }`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{meta.title}</p>
                      <p className="text-xs text-white/40 mt-0.5">{meta.desc}</p>
                    </div>
                    <Toggle checked={item.enabled} onChange={() => handleToggle(item.id, item.enabled)} disabled={autoPending} />
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ═══ PŘEDPLATNÉ ═══ */}
        <section className="bg-[#0d1525] rounded-2xl border border-white/5 shadow-sm p-6 mb-4">
          <SectionHeader icon={CreditCard} title="Předplatné a platby" sub="Faktury, platební metody, zrušení" />
          <p className="text-sm text-white/50 mb-5 leading-relaxed">
            Ve Stripe zákaznickém portálu najdete přehled faktur, stav předplatného a můžete
            kdykoli změnit platební metodu nebo předplatné zrušit.
          </p>
          <button onClick={handleBillingPortal} disabled={billingLoading || !stripeCustomerId}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-40 transition-all">
            {billingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Otevřít zákaznický portál
          </button>
          {!stripeCustomerId && <p className="mt-2 text-xs text-white/30">Portál bude dostupný po první platbě.</p>}
        </section>

        {/* ═══ ZABEZPEČENÍ ═══ */}
        <section className="bg-[#0d1525] rounded-2xl border border-white/5 shadow-sm p-6 mb-4">
          <SectionHeader icon={Shield} title="Zabezpečení" sub="Přihlašovací email" />
          <div className="mb-5 rounded-xl bg-white/[0.02] border border-white/5 px-4 py-3">
            <p className="text-xs text-white/30 mb-0.5">Aktuální přihlašovací email</p>
            <p className="text-sm font-medium text-white">{userEmail}</p>
          </div>
          <form onSubmit={handleEmailChange} className="space-y-4">
            <Field label="Nový email" value={newEmail} onChange={setNewEmail} type="email" placeholder="novy@email.cz" hint="Na novou adresu pošleme potvrzovací odkaz." />
            {emailMsg && (
              <div className={`flex items-start gap-2 text-sm rounded-xl p-3 ${
                emailMsg.ok ? 'bg-emerald-400/5 text-emerald-400 border border-emerald-400/20' : 'bg-red-400/5 text-red-400 border border-red-400/20'
              }`}>
                {emailMsg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                {emailMsg.text}
              </div>
            )}
            <button type="submit" disabled={emailPending || !newEmail.trim()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-40 transition-all">
              {emailPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Změnit přihlašovací email
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
