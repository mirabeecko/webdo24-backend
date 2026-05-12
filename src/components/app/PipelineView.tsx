'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Phone,
  Clock,
  ChevronRight,
  Search,
  Sparkles,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { getLeads, updateLeadStatus } from '@/lib/actions/crm'

type LeadStatus = 'new' | 'contacted' | 'negotiation' | 'done'

interface Lead {
  id: string
  name: string
  phone: string
  email: string
  message: string
  status: LeadStatus
  source: 'web' | 'whatsapp' | 'email' | 'form' | 'phone'
  created_at: string
  messages?: { id: string; sender_type: string; content: string; created_at: string }[]
}

const columns: { key: LeadStatus; label: string; icon: string; color: string; bg: string }[] = [
  { key: 'new', label: 'Nové', icon: '🆕', color: 'border-blue-200', bg: 'bg-blue-50/50' },
  { key: 'contacted', label: 'Kontaktováno', icon: '📞', color: 'border-amber-200', bg: 'bg-amber-50/50' },
  { key: 'negotiation', label: 'Domluveno', icon: '🤝', color: 'border-purple-200', bg: 'bg-purple-50/50' },
  { key: 'done', label: 'Hotové', icon: '✅', color: 'border-emerald-200', bg: 'bg-emerald-50/50' },
]

function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'před chvílí'
  if (diff < 3600) return `před ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} h`
  return `před ${Math.floor(diff / 86400)} d`
}

function SourceBadge({ source }: { source: string }) {
  const labels: Record<string, string> = { web: 'Web', form: 'Formulář', whatsapp: 'WhatsApp', email: 'Email', phone: 'Telefon' }
  const colors: Record<string, string> = { web: 'bg-blue-50 text-blue-600', form: 'bg-purple-50 text-purple-600', whatsapp: 'bg-green-50 text-green-600', email: 'bg-amber-50 text-amber-600', phone: 'bg-gray-50 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${colors[source] || 'bg-gray-50 text-gray-500'}`}>
      {labels[source] || source}
    </span>
  )
}

export default function PipelineView() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [search, setSearch] = useState('')
  const [selectedColumn, setSelectedColumn] = useState<LeadStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedLead, setExpandedLead] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    async function load() {
      const data = await getLeads()
      setLeads(data as Lead[])
      setLoading(false)
    }
    load()
  }, [])

  const moveLead = (id: string, direction: 'forward' | 'back') => {
    const order: LeadStatus[] = ['new', 'contacted', 'negotiation', 'done']
    const lead = leads.find((l) => l.id === id)
    if (!lead) return
    const idx = order.indexOf(lead.status)
    const newIdx = direction === 'forward' ? idx + 1 : idx - 1
    const newStatus = order[newIdx]
    if (!newStatus) return

    startTransition(async () => {
      await updateLeadStatus(id, newStatus)
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)))
    })
  }

  const filteredLeads = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.message.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-96 bg-gray-100 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#0F172A]">Zákazníci</h1>
          <p className="mt-1 text-gray-500">
            {leads.filter((l) => l.status === 'new').length} nových poptávek ke zpracování
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Hledat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-gray-300 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Mobile column selector */}
      <div className="lg:hidden mb-4 flex gap-2 overflow-x-auto pb-2">
        {columns.map((col) => {
          const count = filteredLeads.filter((l) => l.status === col.key).length
          return (
            <button
              key={col.key}
              onClick={() => setSelectedColumn(selectedColumn === col.key ? null : col.key)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                selectedColumn === col.key ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {col.icon} {col.label} ({count})
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
        {columns.map((col) => {
          const colLeads = filteredLeads.filter((l) => l.status === col.key)
          const isVisible = selectedColumn === null || selectedColumn === col.key

          return (
            <div key={col.key} className={`${isVisible ? 'block' : 'hidden lg:block'}`}>
              <div className={`rounded-2xl border-t-4 ${col.color} ${col.bg} p-4 min-h-[200px]`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-sm text-[#0F172A] flex items-center gap-2">
                    <span>{col.icon}</span> {col.label}
                  </h2>
                  <span className="bg-white text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                    {colLeads.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {colLeads.map((lead) => (
                    <div key={lead.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-sm text-[#0F172A]">{lead.name}</h3>
                        <span className="text-[10px] text-gray-400">{timeAgo(lead.created_at)}</span>
                      </div>

                      <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed mb-3">
                        „{lead.message}"
                      </p>

                      <div className="flex items-center gap-2 mb-3">
                        <SourceBadge source={lead.source} />
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${lead.phone?.replace(/\s/g, '') || ''}`}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-700 py-2 text-xs font-medium hover:bg-emerald-100 transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5" /> Zavolat
                        </a>
                        <button
                          onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 text-gray-600 py-2 px-3 text-xs font-medium hover:bg-gray-100 transition-colors"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> ✨
                        </button>
                      </div>

                      {expandedLead === lead.id && (
                        <div className="mt-3 pt-3 border-t border-gray-50 space-y-2">
                          <div className="text-xs text-gray-500"><span className="font-medium">Telefon:</span> {lead.phone || '—'}</div>
                          <div className="text-xs text-gray-500"><span className="font-medium">Email:</span> {lead.email || '—'}</div>
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-xs text-blue-800 mb-2">✨ Návrh odpovědi:</p>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              „Dobrý den, děkuji za zájem. Rád bych se s vámi domluvil na podrobnostech. Mohli bychom si zavolat?"
                            </p>
                            <div className="flex gap-2 mt-2">
                              <button className="flex-1 bg-[#0F172A] text-white text-xs font-medium py-2 rounded-lg hover:bg-gray-800 transition-colors">Použít</button>
                              <button className="flex-1 bg-white border border-gray-200 text-gray-700 text-xs font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors">Upravit</button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                        {lead.status !== 'new' && (
                          <button onClick={() => moveLead(lead.id, 'back')} className="flex-1 text-xs text-gray-500 py-1.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-1">
                            <ArrowLeft className="h-3 w-3" /> Zpět
                          </button>
                        )}
                        {lead.status !== 'done' && (
                          <button onClick={() => moveLead(lead.id, 'forward')} className="flex-1 text-xs text-[#0F172A] font-medium py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-center gap-1">
                            Posunout dál <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {colLeads.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-400">Zatím prázdné</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
