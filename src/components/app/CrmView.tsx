'use client'

// ============================================
// CRM – Poptávky & návštěvnost (webdo24-backend)
// Sledování návštěvnosti · správa poptávek · automatické odpovědi (AI)
// ============================================

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import {
  Search,
  Sparkles,
  Send,
  Phone,
  Mail,
  RefreshCw,
  MessageSquare,
  Users,
  Eye,
  MousePointerClick,
  TrendingUp,
  Zap,
  Bot,
  StickyNote,
  ArrowLeft,
  Check,
  Loader2,
  MailPlus,
  Filter,
  Globe,
} from 'lucide-react'
import {
  getCrmData,
  getMessages,
  sendMessage,
  updateLeadStatus,
  updateLeadNotes,
  generateLeadReply,
  sendAiReply,
  toggleCrmAutomation,
  sendLeadEmailReply,
} from '@/lib/actions/crm'

// --------------------------------------------------------------
// Typy
// --------------------------------------------------------------

interface Lead {
  id: string
  name: string
  phone: string | null
  email: string | null
  message: string
  source: string
  status: string
  ai_reply: string | null
  ai_reply_used: boolean
  notes: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

interface AnalyticsRow {
  event_date: string
  page_views: number
  unique_visitors: number
  form_submissions: number
}

interface Message {
  id: string
  lead_id: string
  sender_type: 'customer' | 'user' | 'ai'
  content: string
  is_ai_suggestion: boolean
  ai_action: string | null
  created_at: string
}

interface CrmData {
  projectTitle: string
  customerName: string
  companyPhone: string | null
  companyEmail: string | null
  leads: Lead[]
  analytics: AnalyticsRow[]
  kpis: {
    newLeads7: number
    totalLeads: number
    views7: number
    unique7: number
    subs7: number
    conversion7: number
    viewsToday: number
    viewsYesterday: number
    subsToday: number
  }
  automations: Record<string, boolean>
}

// --------------------------------------------------------------
// Konstanty
// --------------------------------------------------------------

const STATUSES: Array<{ key: string; label: string; color: string; dot: string }> = [
  { key: 'new', label: 'Nová', color: 'bg-amber-400/10 text-amber-300 border-amber-400/30', dot: 'bg-amber-400' },
  { key: 'contacted', label: 'Kontaktovaná', color: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30', dot: 'bg-cyan-400' },
  { key: 'negotiation', label: 'V jednání', color: 'bg-violet-400/10 text-violet-300 border-violet-400/30', dot: 'bg-violet-400' },
  { key: 'done', label: 'Dokončená', color: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30', dot: 'bg-emerald-400' },
]

const STATUS_FLOW = ['new', 'contacted', 'negotiation', 'done']

const SOURCES: Record<string, { label: string; icon: string }> = {
  web: { label: 'Web', icon: '🌐' },
  form: { label: 'Formulář', icon: '📝' },
  whatsapp: { label: 'WhatsApp', icon: '💬' },
  email: { label: 'E-mail', icon: '✉️' },
  phone: { label: 'Telefon', icon: '📞' },
}

function sourceLabel(s: string) {
  return SOURCES[s]?.label || s || 'Web'
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return 'před chvílí'
  if (diff < 3600) return `před ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `před ${Math.floor(diff / 86400)} d`
  return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
}

function initials(name: string) {
  return name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'
}

// --------------------------------------------------------------
// KPI karta
// --------------------------------------------------------------

function KpiCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
  accent: string
}) {
  return (
    <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-4 flex items-start gap-3 hover:border-cyan-400/20 transition-colors">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-white leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

// --------------------------------------------------------------
// Graf návštěvnosti (SVG)
// --------------------------------------------------------------

function AnalyticsChart({ rows }: { rows: AnalyticsRow[] }) {
  const W = 560
  const H = 150
  const PAD = 4
  const maxViews = Math.max(...rows.map((r) => r.page_views), 1)
  const barW = (W - PAD * 2) / Math.max(rows.length, 1)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[150px]" preserveAspectRatio="none">
        {/* grid lines */}
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={0} x2={W} y1={H - H * t} y2={H - H * t} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        ))}
        {/* bars */}
        {rows.map((r, i) => {
          const h = Math.max((r.page_views / maxViews) * (H - 26), 2)
          const x = PAD + i * barW + barW * 0.18
          const bw = barW * 0.64
          const hasSub = r.form_submissions > 0
          return (
            <g key={r.event_date}>
              <rect x={x} y={H - h - 8} width={bw} height={h} rx={3} fill="rgba(34,211,238,0.55)" />
              {hasSub && (
                <circle cx={x + bw / 2} cy={H - h - 20} r={2.6} fill="#f59e0b">
                  <title>{`Formulář: ${r.form_submissions}`}</title>
                </circle>
              )}
              <title>{`${r.event_date}: ${r.page_views} návštěv · ${r.unique_visitors} unikátních${hasSub ? ` · ${r.form_submissions} poptávek` : ''}`}</title>
            </g>
          )
        })}
      </svg>
      {/* day labels */}
      <div className="flex justify-between mt-1 px-1">
        {rows.filter((_, i) => i % 2 === 0 || i === rows.length - 1).map((r) => (
          <span key={r.event_date} className="text-[9px] text-slate-500">
            {new Date(r.event_date + 'T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}
          </span>
        ))}
      </div>
    </div>
  )
}

// --------------------------------------------------------------
// Bublina zprávy
// --------------------------------------------------------------

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.sender_type === 'ai' && msg.is_ai_suggestion) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] w-full">
          <div className="bg-gradient-to-br from-cyan-500/10 to-violet-500/10 border border-cyan-400/20 rounded-2xl rounded-tr-sm px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Bot className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wider">Návrh AI odpovědi</span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{msg.content}</p>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 text-right">{timeAgo(msg.created_at)}</p>
        </div>
      </div>
    )
  }

  if (msg.sender_type === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[80%]">
          <div className="bg-[#1e293b] border border-white/10 text-white rounded-2xl rounded-tr-sm px-4 py-3">
            <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 text-right">{timeAgo(msg.created_at)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[80%]">
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{msg.content}</p>
        </div>
        <p className="text-[10px] text-slate-500 mt-1">{timeAgo(msg.created_at)}</p>
      </div>
    </div>
  )
}

// --------------------------------------------------------------
// Hlavní komponenta
// --------------------------------------------------------------

export default function CrmView() {
  const [data, setData] = useState<CrmData | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [replyText, setReplyText] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [aiBusy, setAiBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const notify = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  // ── Načtení ──
  useEffect(() => {
    let alive = true
    async function load() {
      const d = await getCrmData()
      if (!alive) return
      setData(d)
      setLeads(d?.leads || [])
      setLoading(false)
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  const reload = useCallback(async () => {
    const d = await getCrmData()
    if (d) {
      setData(d)
      setLeads(d.leads)
      notify('Data aktualizována')
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    let alive = true
    getMessages(selectedId).then((m) => {
      if (alive) setMessages((m as Message[]) || [])
    })
    const lead = leads.find((l) => l.id === selectedId)
    setNotesDraft(lead?.notes || '')
    return () => {
      alive = false
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = leads.find((l) => l.id === selectedId) || null

  // ── Filtry ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return leads.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      if (sourceFilter !== 'all' && l.source !== sourceFilter) return false
      if (q && !`${l.name} ${l.message} ${l.phone || ''} ${l.email || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [leads, search, statusFilter, sourceFilter])

  const sourceOptions = useMemo(() => {
    const set = new Set(leads.map((l) => l.source))
    return Array.from(set)
  }, [leads])

  // ── Akce ──
  const changeStatus = (status: string) => {
    if (!selectedId) return
    startTransition(async () => {
      await updateLeadStatus(selectedId, status)
      setLeads((prev) => prev.map((l) => (l.id === selectedId ? { ...l, status } : l)))
      notify('Stav poptávky změněn')
    })
  }

  const saveNotes = () => {
    if (!selectedId) return
    startTransition(async () => {
      await updateLeadNotes(selectedId, notesDraft)
      setLeads((prev) => prev.map((l) => (l.id === selectedId ? { ...l, notes: notesDraft } : l)))
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    })
  }

  const handleGenerateAi = async () => {
    if (!selectedId || aiBusy) return
    setAiBusy(true)
    try {
      const res = await generateLeadReply(selectedId)
      setLeads((prev) => prev.map((l) => (l.id === selectedId ? { ...l, ai_reply: res.reply, ai_reply_used: false } : l)))
      const m = await getMessages(selectedId)
      setMessages((m as Message[]) || [])
      notify(res.usedAi ? 'AI odpověď vygenerována (n8n)' : 'Odpověď připravena (šablona — AI nedostupné)')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Chyba generování')
    } finally {
      setAiBusy(false)
    }
  }

  const handleSend = (content?: string) => {
    const text = (content ?? replyText).trim()
    if (!text || !selectedId || isPending) return
    startTransition(async () => {
      await sendMessage(selectedId, text)
      setReplyText('')
      const m = await getMessages(selectedId)
      setMessages((m as Message[]) || [])
      notify('Zpráva odeslána')
    })
  }

  const handleSendAi = async () => {
    if (!selected || !selected.ai_reply || isPending) return
    startTransition(async () => {
      await sendAiReply(selectedId!, selected.ai_reply!)
      setLeads((prev) => prev.map((l) => (l.id === selectedId ? { ...l, ai_reply_used: true } : l)))
      const m = await getMessages(selectedId!)
      setMessages((m as Message[]) || [])
      notify('AI odpověď odeslána jako zpráva')
    })
  }

  const handleEmailReply = async () => {
    if (!selected || !selected.ai_reply || isPending) return
    startTransition(async () => {
      try {
        await sendLeadEmailReply(selectedId!, selected.ai_reply!)
        notify('Odpověď zařazena k odeslání emailem zájemci')
      } catch (e) {
        notify(e instanceof Error ? e.message : 'Chyba emailu')
      }
    })
  }

  const toggleAutomation = (key: string, current: boolean) => {
    startTransition(async () => {
      await toggleCrmAutomation(key, !current)
      setData((prev) => (prev ? { ...prev, automations: { ...prev.automations, [key]: !current } } : prev))
      notify(!current ? 'Automatizace zapnuta' : 'Automatizace vypnuta')
    })
  }

  // ── Loader ──
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-16 bg-white/5 rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-white/5 rounded-2xl" />
            ))}
          </div>
          <div className="h-[480px] bg-white/5 rounded-2xl" />
        </div>
      </div>
    )
  }

  const kpis = data?.kpis
  const autoReplyOn = data?.automations?.auto_reply || false
  const aiReplyOn = data?.automations?.ai_reply || false

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-[#0d1525] border border-cyan-400/30 text-white text-sm px-4 py-3 rounded-xl shadow-2xl shadow-black/40">
          {toast}
        </div>
      )}

      {/* ── Hlavička ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">CRM · Poptávky &amp; návštěvnost</h1>
          <p className="mt-1 text-sm text-slate-400">
            {data?.projectTitle || 'Web'} · poptávky z formuláře, sledování návštěv a automatické odpovědi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleAutomation('ai_reply', aiReplyOn)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors ${
              aiReplyOn
                ? 'bg-cyan-400/10 border-cyan-400/30 text-cyan-300'
                : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20'
            }`}
            title="AI navrhne odpověď na každou novou poptávku"
          >
            <Bot className="h-4 w-4" /> AI návrhy {aiReplyOn ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => toggleAutomation('auto_reply', autoReplyOn)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors ${
              autoReplyOn
                ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-300'
                : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20'
            }`}
            title="Automatická odpověď na nové poptávky"
          >
            <Zap className="h-4 w-4" /> Auto-odpověď {autoReplyOn ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={reload}
            className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-slate-300 hover:border-white/25 transition-colors"
            title="Obnovit"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard icon={Zap} label="Nové poptávky · 7 d" value={kpis?.newLeads7 ?? 0} sub={`${kpis?.totalLeads ?? 0} celkem`} accent="bg-amber-400/15 text-amber-300" />
        <KpiCard icon={MessageSquare} label="Celkem poptávek" value={kpis?.totalLeads ?? 0} sub={`${kpis?.subsToday ?? 0} dnes`} accent="bg-cyan-400/15 text-cyan-300" />
        <KpiCard icon={Eye} label="Návštěvy · 7 d" value={(kpis?.views7 ?? 0).toLocaleString('cs-CZ')} sub={`dnes ${kpis?.viewsToday ?? 0} · včera ${kpis?.viewsYesterday ?? 0}`} accent="bg-blue-400/15 text-blue-300" />
        <KpiCard icon={Users} label="Unikátní · 7 d" value={(kpis?.unique7 ?? 0).toLocaleString('cs-CZ')} sub="přibližně" accent="bg-violet-400/15 text-violet-300" />
        <KpiCard icon={TrendingUp} label="Konverze · 7 d" value={`${kpis?.conversion7 ?? 0} %`} sub={`${kpis?.subs7 ?? 0} poptávek z formuláře`} accent="bg-emerald-400/15 text-emerald-300" />
      </div>

      {/* ── Návštěvnost ── */}
      <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Návštěvnost za posledních 14 dní</h2>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-cyan-400/60 inline-block" /> návštěvy</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> poptávka z formuláře</span>
          </div>
        </div>
        {data?.analytics?.length ? (
          <AnalyticsChart rows={data.analytics} />
        ) : (
          <div className="h-[150px] flex flex-col items-center justify-center text-slate-500 gap-2">
            <Eye className="h-6 w-6" />
            <p className="text-xs">Zatím bez dat — návštěvy se začnou počítat, jakmile se otevře web s embedem.</p>
          </div>
        )}
      </div>

      {/* ── CRM ── */}
      <div className="bg-[#0d1525]/80 border border-white/5 rounded-2xl overflow-hidden grid lg:grid-cols-[360px_1fr] min-h-[560px]">
        {/* Seznam poptávek */}
        <div className={`${selectedId ? 'hidden lg:flex' : 'flex'} flex-col border-r border-white/5`}>
          <div className="p-4 border-b border-white/5 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hledat jméno, telefon, zprávu…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400/40"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                  statusFilter === 'all' ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/10 text-slate-400 hover:border-white/25'
                }`}
              >
                Vše
              </button>
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(s.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                    statusFilter === s.key ? s.color : 'bg-transparent border-white/10 text-slate-400 hover:border-white/25'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {sourceOptions.length > 1 && (
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-slate-500" />
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] text-slate-300 focus:outline-none"
                >
                  <option value="all">Všechny zdroje</option>
                  {sourceOptions.map((s) => (
                    <option key={s} value={s}>{sourceLabel(s)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((lead) => {
                const st = STATUSES.find((s) => s.key === lead.status) || STATUSES[0]
                const isNew = lead.status === 'new'
                return (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedId(lead.id)}
                    className={`w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.03] transition-colors border-b border-white/5 ${
                      selectedId === lead.id ? 'bg-cyan-400/[0.06]' : ''
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                      isNew ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-[#0a0e17]' : 'bg-white/[0.06] text-slate-300 border border-white/10'
                    }`}>
                      {initials(lead.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-semibold text-sm text-white truncate">{lead.name}</span>
                        <span className="text-[10px] text-slate-500 shrink-0">{timeAgo(lead.created_at)}</span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 mb-1.5">{lead.message}</p>
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wide border ${st.color}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                        <span className="text-[9px] text-slate-500">{sourceLabel(lead.source)}</span>
                        {lead.ai_reply && !lead.ai_reply_used && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-cyan-400">
                            <Sparkles className="h-2.5 w-2.5" /> AI
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="p-10 text-center text-slate-500">
                <MessageSquare className="h-8 w-8 mx-auto mb-3 text-slate-700" />
                <p className="text-sm">Žádné poptávky neodpovídají filtru</p>
              </div>
            )}
          </div>
        </div>

        {/* Detail poptávky */}
        <div className={`${selectedId ? 'flex' : 'hidden lg:flex'} flex-col`}>
          {selected ? (
            <>
              {/* Hlavička detailu */}
              <div className="p-4 border-b border-white/5 flex flex-wrap items-center gap-3">
                <button onClick={() => setSelectedId(null)} className="lg:hidden p-1 -ml-1 text-slate-400 hover:text-white">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] flex items-center justify-center text-sm font-bold">
                  {initials(selected.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-white truncate">{selected.name}</h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400 mt-0.5">
                    {selected.phone && (
                      <a href={`tel:${selected.phone.replace(/\s/g, '')}`} className="flex items-center gap-1 hover:text-cyan-300 transition-colors">
                        <Phone className="h-3 w-3" /> {selected.phone}
                      </a>
                    )}
                    {selected.email && (
                      <a href={`mailto:${selected.email}`} className="flex items-center gap-1 hover:text-cyan-300 transition-colors">
                        <Mail className="h-3 w-3" /> {selected.email}
                      </a>
                    )}
                    <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {sourceLabel(selected.source)}</span>
                    <span>{new Date(selected.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                {selected.phone && (
                  <a href={`tel:${selected.phone.replace(/\s/g, '')}`} className="p-2.5 rounded-xl bg-emerald-400/10 text-emerald-300 border border-emerald-400/20 hover:bg-emerald-400/20 transition-colors">
                    <Phone className="h-4 w-4" />
                  </a>
                )}
                {selected.email && (
                  <a href={`mailto:${selected.email}`} className="p-2.5 rounded-xl bg-cyan-400/10 text-cyan-300 border border-cyan-400/20 hover:bg-cyan-400/20 transition-colors">
                    <Mail className="h-4 w-4" />
                  </a>
                )}
              </div>

              {/* Stav — pipeline */}
              <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 overflow-x-auto">
                {STATUS_FLOW.map((key, i) => {
                  const st = STATUSES.find((s) => s.key === key)!
                  const activeIdx = STATUS_FLOW.indexOf(selected.status)
                  const isActive = key === selected.status
                  const isDone = activeIdx >= i
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <button
                        onClick={() => changeStatus(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                          isActive ? `${st.color} shadow-lg` : isDone
                            ? 'bg-white/[0.04] border-white/10 text-slate-400 hover:border-white/25'
                            : 'bg-transparent border-white/5 text-slate-600 hover:border-white/15 hover:text-slate-400'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${isActive || isDone ? st.dot : 'bg-slate-700'}`} />
                        {st.label}
                        {isActive && <Check className="h-3 w-3" />}
                      </button>
                      {i < STATUS_FLOW.length - 1 && <span className="text-slate-700 text-xs">→</span>}
                    </div>
                  )
                })}
              </div>

              {/* Obsah detailu */}
              <div className="flex-1 overflow-y-auto grid lg:grid-cols-[1fr_300px]">
                <div className="flex flex-col min-h-0">
                  {/* Zpráva z formuláře */}
                  <div className="px-4 pt-4 pb-2">
                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Poptávka z webu</span>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{selected.message}</p>
                      {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {Object.entries(selected.metadata).map(([k, v]) => (
                            <span key={k} className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] text-slate-400">
                              {k}: {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Konverzace */}
                  <div className="flex-1 overflow-y-auto px-4 py-3 min-h-[220px] max-h-[360px]">
                    {messages.length > 0 ? (
                      messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-600">
                        <MessageSquare className="h-7 w-7 mb-2" />
                        <p className="text-xs">Zatím žádná konverzace</p>
                      </div>
                    )}
                  </div>

                  {/* Kompozér */}
                  <div className="p-4 border-t border-white/5">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Napište odpověď zájemci…"
                        rows={1}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSend()
                          }
                        }}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400/40 resize-none"
                      />
                      <button
                        onClick={() => handleSend()}
                        disabled={!replyText.trim() || isPending}
                        className="p-3 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pravý sloupec: AI + poznámky */}
                <div className="border-t lg:border-t-0 lg:border-l border-white/5 p-4 space-y-4 bg-white/[0.01]">
                  {/* AI odpověď */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-cyan-400" />
                        <h3 className="text-xs font-semibold text-white">AI odpověď</h3>
                      </div>
                      <button
                        onClick={handleGenerateAi}
                        disabled={aiBusy || isPending}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-400/10 border border-cyan-400/25 text-cyan-300 text-[11px] font-medium hover:bg-cyan-400/20 transition-colors disabled:opacity-40"
                      >
                        {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
                        {selected.ai_reply ? 'Znovu' : 'Vygenerovat'}
                      </button>
                    </div>
                    {selected.ai_reply ? (
                      <div className="space-y-2">
                        <div className="bg-gradient-to-br from-cyan-500/[0.07] to-violet-500/[0.07] border border-cyan-400/20 rounded-xl p-3">
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line max-h-44 overflow-y-auto">{selected.ai_reply}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={handleSendAi}
                            disabled={isPending || selected.ai_reply_used}
                            className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 text-[#0a0e17] text-[11px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-30"
                          >
                            <Send className="h-3 w-3" /> Odeslat
                          </button>
                          <button
                            onClick={() => {
                              setReplyText(selected.ai_reply || '')
                              notify('AI odpověď vložena do pole pro úpravu')
                            }}
                            className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-slate-300 text-[11px] font-medium hover:border-white/25 transition-colors"
                          >
                            Upravit
                          </button>
                          <button
                            onClick={handleEmailReply}
                            disabled={isPending || !selected.email}
                            className="col-span-2 flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-slate-300 text-[11px] font-medium hover:border-white/25 transition-colors disabled:opacity-30"
                            title={selected.email ? 'Zařadit odpověď k odeslání emailem' : 'Poptávka nemá e-mail'}
                          >
                            <MailPlus className="h-3 w-3" /> Odeslat emailem zájemci
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-xl p-3 text-center">
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Vygenerujte návrh odpovědi na míru, nebo použijte automatickou odpověď (nastavení v hlavičce).
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Poznámky */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <StickyNote className="h-4 w-4 text-amber-400" />
                        <h3 className="text-xs font-semibold text-white">Interní poznámky</h3>
                      </div>
                      {notesSaved && <span className="text-[10px] text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> uloženo</span>}
                    </div>
                    <textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Souvislosti, termíny, dohody…"
                      rows={4}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400/40 resize-none"
                    />
                    <button
                      onClick={saveNotes}
                      disabled={isPending}
                      className="mt-1.5 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-slate-300 text-[11px] font-medium hover:border-white/25 transition-colors disabled:opacity-40"
                    >
                      Uložit poznámku
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-10">
              <MessageSquare className="h-12 w-12 mb-4 text-slate-800" />
              <p className="text-sm font-medium text-slate-400">Vyberte poptávku</p>
              <p className="text-xs mt-1">Nová poptávka z webu se objeví v seznamu vlevo</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
