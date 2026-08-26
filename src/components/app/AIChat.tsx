'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { ArrowUp, Sparkles } from 'lucide-react'
import { createChangeRequest } from '@/lib/actions/changes'
import { evaluatePolicy } from '@/lib/ai/policy-engine'
import AIThinking from './AIThinking'
import QuickActions from './QuickActions'
import UpgradeOffer from './UpgradeOffer'
import type { ChangeStatus } from '@/types'

// ── Types ────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  state: 'thinking' | 'done' | 'error'
  changeId?: string
  changeStatus?: ChangeStatus
}

interface RecentChange {
  id: string
  raw_input: string
  status: ChangeStatus
  created_at: string
}

interface Props {
  customerName: string
  planTier: string
  projectId: string
  customerEmail: string
  newLeadsCount: number
  recentChanges: RecentChange[]
}

interface UpgradePayload {
  title: string
  description: string
  product_key: string
  cta: string
}

// ── Helpers ──────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'právě teď'
  if (diff < 3_600_000) return `před ${Math.floor(diff / 60_000)} min`
  if (diff < 86_400_000) return `před ${Math.floor(diff / 3_600_000)} h`
  return `před ${Math.floor(diff / 86_400_000)} d`
}

const STATUS_LABEL: Partial<Record<ChangeStatus, string>> = {
  new: 'Přijato', classifying: 'Analyzujeme', planning: 'Plánujeme',
  executing: 'Pracujeme', preview_ready: 'Ke schválení', approved: 'Schváleno',
  publishing: 'Publikujeme', published: 'Hotovo', rejected: 'Zrušeno',
  failed: 'Chyba', escalated: 'V řešení',
}

const STATUS_COLOR: Partial<Record<ChangeStatus, string>> = {
  preview_ready: 'bg-amber-50 text-amber-700 ring-amber-200',
  published:     'bg-emerald-50 text-emerald-700 ring-emerald-200',
  failed:        'bg-red-50 text-red-600 ring-red-200',
  rejected:      'bg-gray-50 text-gray-500 ring-gray-200',
}

const CATEGORY_REPLY: Record<string, string> = {
  content:     'Perfektní! Textové úpravy jsou v pořadí. AI tým se na to hned podívá.',
  design:      'Designová změna přijata. Připravíme náhled pro vaše schválení.',
  media:       'Rozumím! Fotky aktualizujeme co nejdříve.',
  seo:         'SEO optimalizace zařazena. Brzy ji uvidíte v Google.',
  form:        'Formulář připravíme k nasazení — schválíte ho v náhledu.',
  service:     'Nová služba přijata. Přidáme ji na web a pošleme náhled.',
  booking:     'Rezervační systém zařazen. Napíšeme vám o průběhu.',
  page:        'Nová stránka v přípravě. Náhled dostanete emailem.',
  integration: 'Integrace zařazena. Nakonfigurujeme ji a pošleme potvrzení.',
  heavy:       'Velká změna přijata. Náš tým vás brzy kontaktuje.',
}

// ── Component ─────────────────────────────────────────────────────────

export default function AIChat({
  customerName, planTier, projectId, customerEmail, newLeadsCount, recentChanges,
}: Props) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isPending, startTransition] = useTransition()
  const [upgradeOffer, setUpgradeOffer] = useState<UpgradePayload | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const firstName = customerName?.split(' ')[0] || 'uživateli'
  const hasConversation = messages.length > 0

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  function handleSelect(prompt: string) {
    setInput(prompt)
    setTimeout(() => {
      textareaRef.current?.focus()
      autoResize()
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleSubmit() {
    const text = input.trim()
    if (!text || isPending) return

    const policy = evaluatePolicy(text, planTier)
    if (!policy.allowed && policy.upsell) {
      setUpgradeOffer(policy.upsell)
      return
    }

    const userMsgId = crypto.randomUUID()
    const asMsgId = crypto.randomUUID()

    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', content: text, state: 'done' },
      { id: asMsgId, role: 'assistant', content: '', state: 'thinking' },
    ])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    startTransition(async () => {
      try {
        const result = await createChangeRequest(text)
        setMessages(prev => prev.map(m =>
          m.id === asMsgId
            ? {
                ...m,
                state: 'done',
                content: CATEGORY_REPLY[result.category] ?? 'Požadavek přijat! Brzy se k vám vrátíme.',
                changeId: result.id,
                changeStatus: 'classifying',
              }
            : m
        ))
      } catch {
        setMessages(prev => prev.map(m =>
          m.id === asMsgId
            ? { ...m, state: 'error', content: 'Nepodařilo se odeslat požadavek. Zkuste to prosím znovu.' }
            : m
        ))
      }
    })
  }

  return (
    <>
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-3xl mx-auto px-4 lg:px-8 py-10">

          {/* Header */}
          <div className="mb-8">
            {newLeadsCount > 0 && (
              <Link
                href="/poptavky"
                className="inline-flex items-center gap-2 mb-4 rounded-full bg-blue-50 border border-blue-100 px-4 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                {newLeadsCount === 1
                  ? '1 nová poptávka čeká'
                  : `${newLeadsCount} ${newLeadsCount < 5 ? 'nové poptávky čekají' : 'nových poptávek čeká'}`}
              </Link>
            )}
            <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">
              {hasConversation ? 'Cokoli dalšího?' : `Ahoj, ${firstName}!`}
            </h1>
            <p className="mt-1.5 text-gray-500 text-sm">
              {hasConversation
                ? 'Napište další požadavek nebo sledujte průběh v přehledu.'
                : 'Co dnes zlepšíme na vašem webu?'}
            </p>
          </div>

          {/* Conversation thread */}
          {hasConversation && (
            <div className="mb-8 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-[#0F172A] text-white px-5 py-3.5 text-sm leading-relaxed">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-[82%] space-y-2 w-full">
                      {msg.state === 'thinking' ? (
                        <div className="rounded-2xl rounded-tl-sm bg-white border border-gray-100 shadow-sm px-4 py-3 inline-block">
                          <AIThinking />
                        </div>
                      ) : msg.state === 'error' ? (
                        <div className="rounded-2xl rounded-tl-sm bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                          {msg.content}
                        </div>
                      ) : (
                        <>
                          <div className="rounded-2xl rounded-tl-sm bg-white border border-gray-100 shadow-sm px-5 py-4">
                            <div className="flex items-center gap-2 mb-2.5">
                              <Sparkles className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Webdo24 AI</span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">{msg.content}</p>
                          </div>
                          {msg.changeId && (
                            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-5 py-3 flex items-center justify-between">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${STATUS_COLOR[msg.changeStatus ?? 'new'] ?? 'bg-blue-50 text-blue-600 ring-blue-100'}`}>
                                {STATUS_LABEL[msg.changeStatus ?? 'new'] ?? 'Přijato'}
                              </span>
                              <Link
                                href={`/pozadavky/${msg.changeId}`}
                                className="text-xs text-blue-600 font-medium hover:text-blue-700 transition-colors"
                              >
                                Sledovat průběh →
                              </Link>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Input box */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm focus-within:border-gray-400 focus-within:shadow-md transition-all duration-200 mb-6">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize() }}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder={
                hasConversation
                  ? 'Napište další požadavek...'
                  : 'Napište co chcete změnit — texty, fotky, ceny, nové sekce...'
              }
              className="w-full resize-none bg-transparent px-5 pt-4 pb-2 text-sm text-[#0F172A] placeholder:text-gray-400 focus:outline-none leading-relaxed"
            />
            <div className="flex items-center justify-between px-4 pb-3 pt-1">
              <span className="text-xs text-gray-300 hidden sm:block">Enter · odeslat &nbsp;&nbsp; Shift+Enter · nový řádek</span>
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isPending}
                className="ml-auto h-8 w-8 flex items-center justify-center rounded-xl bg-[#0F172A] text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick actions */}
          {!hasConversation && (
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Rychlé akce</p>
              <QuickActions onSelect={handleSelect} />
            </div>
          )}

          {/* Recent changes from server */}
          {!hasConversation && recentChanges.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Nedávné požadavky</p>
                <Link href="/pozadavky" className="text-xs text-blue-600 font-medium hover:text-blue-700 transition-colors">
                  Všechny →
                </Link>
              </div>
              <div className="space-y-2">
                {recentChanges.map((cr) => (
                  <Link
                    key={cr.id}
                    href={`/pozadavky/${cr.id}`}
                    className="flex items-center gap-3 rounded-xl bg-white border border-gray-100 px-4 py-3.5 hover:border-gray-200 hover:shadow-sm transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#0F172A] line-clamp-1">{cr.raw_input}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(cr.created_at)}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${STATUS_COLOR[cr.status] ?? 'bg-blue-50 text-blue-600 ring-blue-100'}`}>
                      {STATUS_LABEL[cr.status] ?? cr.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {upgradeOffer && (
        <UpgradeOffer
          title={upgradeOffer.title}
          description={upgradeOffer.description}
          productKey={upgradeOffer.product_key}
          cta={upgradeOffer.cta}
          customerEmail={customerEmail}
          projectId={projectId}
          onClose={() => setUpgradeOffer(null)}
        />
      )}
    </>
  )
}
