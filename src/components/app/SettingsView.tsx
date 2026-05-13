'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Bell,
  Sparkles,
  User,
  Smartphone,
  Clock,
  Star,
  CheckCircle2,
} from 'lucide-react'
import { getProfile, updateProfile, getAutomations, toggleAutomation } from '@/lib/actions/settings'
import EmailRoutingView from './EmailRoutingView'

interface Automation {
  id: string
  automation_key: string
  title: string
  description: string
  enabled: boolean
  template: string | null
  icon: string
  iconColor: string
}

const AUTOMATION_META: Record<string, { title: string; description: string; icon: string; iconColor: string }> = {
  auto_reply: { title: 'Automatická odpověď', description: 'Zákazník dostane potvrzení, že poptávka dorazila', icon: 'mail', iconColor: 'text-blue-600 bg-blue-50' },
  notify_owner: { title: 'Upozornění na poptávku', description: 'SMS + push notifikace při nové poptávce', icon: 'bell', iconColor: 'text-amber-600 bg-amber-50' },
  follow_up: { title: 'Připomínka zákazníkovi', description: 'Po 24 hodinách bez odpovědi odešle připomínku', icon: 'clock', iconColor: 'text-purple-600 bg-purple-50' },
  review_request: { title: 'Žádost o hodnocení', description: 'Po dokončení zakázky požádá zákazníka o recenzi', icon: 'star', iconColor: 'text-emerald-600 bg-emerald-50' },
}

const AI_META: Record<string, { title: string; description: string; icon: string; iconColor: string }> = {
  ai_reply: { title: 'AI odpovědi na zprávy', description: 'Asistent navrhne odpověď na každou poptávku', icon: 'sparkles', iconColor: 'text-violet-600 bg-violet-50' },
  ai_improve: { title: 'Vylepšování textů', description: 'AI upraví texty na webu, aby působily profesionálněji', icon: 'sparkles', iconColor: 'text-violet-600 bg-violet-50' },
  ai_social: { title: 'Příspěvky na sociální sítě', description: 'Generování FB příspěvků z referencí', icon: 'message', iconColor: 'text-pink-600 bg-pink-50' },
}

function IconByName({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    mail: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>,
    bell: <Bell className={className} />,
    clock: <Clock className={className} />,
    star: <Star className={className} />,
    sparkles: <Sparkles className={className} />,
    message: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>,
  }
  return <>{icons[name] || <Sparkles className={className} />}</>
}

export default function SettingsView() {
  const [profile, setProfile] = useState<any>(null)
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    async function load() {
      const [p, a] = await Promise.all([getProfile(), getAutomations()])
      setProfile(p)
      // Merge with meta
      const merged = a.map((item: any) => {
        const meta = AUTOMATION_META[item.automation_key] || AI_META[item.automation_key] || { title: item.automation_key, description: '', icon: 'sparkles', iconColor: 'text-gray-600 bg-gray-50' }
        return { ...item, ...meta }
      })
      setAutomations(merged)
      setLoading(false)
    }
    load()
  }, [])

  const showSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleProfileUpdate = (field: string, value: string) => {
    setProfile((prev: any) => ({ ...prev, [field]: value }))
    startTransition(async () => {
      await updateProfile({ [field]: value })
      showSaved()
    })
  }

  const handleToggle = (id: string, current: boolean) => {
    startTransition(async () => {
      await toggleAutomation(id, !current)
      setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !current } : a)))
    })
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  const autoItems = automations.filter((a) => AUTOMATION_META[a.automation_key])
  const aiItems = automations.filter((a) => AI_META[a.automation_key])

  return (
    <div className="max-w-2xl mx-auto p-4 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-[#0F172A]">Nastavení</h1>
        <p className="mt-1 text-gray-500">Spravujte svůj profil a automatizace</p>
      </div>

      {saved && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4" /> Uloženo
        </div>
      )}

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center">
            <User className="h-5 w-5 text-gray-500" />
          </div>
          <h2 className="font-semibold text-[#0F172A]">Můj profil</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">Jméno a příjmení</label>
            <input type="text" value={profile?.name || ''} onChange={(e) => handleProfileUpdate('name', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-gray-300" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">Název firmy</label>
            <input type="text" value={profile?.company || ''} onChange={(e) => handleProfileUpdate('company', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-gray-300" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">Telefon</label>
              <input type="tel" value={profile?.phone || ''} onChange={(e) => handleProfileUpdate('phone', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-gray-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">Email</label>
              <input type="email" value={profile?.email || ''} onChange={(e) => handleProfileUpdate('email', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-gray-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Automations */}
      {autoItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-[#0F172A]">Automatizace</h2>
              <p className="text-xs text-gray-400">Nastavte jednou, zapomeňte navždy</p>
            </div>
          </div>
          <div className="space-y-4">
            {autoItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${item.iconColor}`}>
                      <IconByName name={item.icon} className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm text-[#0F172A]">{item.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                      {item.enabled && item.template && (
                        <div className="mt-2 p-2.5 rounded-lg bg-gray-50 text-xs text-gray-600 italic border border-gray-100">„{item.template}"</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(item.id, item.enabled)}
                    disabled={isPending}
                    className={`relative h-7 w-12 rounded-full transition-colors shrink-0 ${item.enabled ? 'bg-emerald-500' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${item.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Routing */}
      <EmailRoutingView />

      {/* AI */}
      {aiItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h2 className="font-semibold text-[#0F172A]">AI Asistent</h2>
              <p className="text-xs text-gray-400">Chytrý pomocník, ne robot</p>
            </div>
          </div>
          <div className="space-y-4">
            {aiItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${item.iconColor}`}>
                      <IconByName name={item.icon} className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm text-[#0F172A]">{item.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(item.id, item.enabled)}
                    disabled={isPending}
                    className={`relative h-7 w-12 rounded-full transition-colors shrink-0 ${item.enabled ? 'bg-emerald-500' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${item.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
