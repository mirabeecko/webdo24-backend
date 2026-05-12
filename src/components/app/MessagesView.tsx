'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Search,
  CheckCheck,
  Sparkles,
  Send,
  Phone,
  ArrowLeft,
  MessageCircle,
} from 'lucide-react'
import { getLeads, getMessages, sendMessage } from '@/lib/actions/crm'

interface Message {
  id: string
  sender_type: 'customer' | 'user' | 'ai'
  content: string
  is_ai_suggestion: boolean
  ai_action: string | null
  created_at: string
}

interface Lead {
  id: string
  name: string
  phone: string
  message: string
  status: string
  source: string
  created_at: string
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'před chvílí'
  if (diff < 3600) return `před ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} h`
  return `před ${Math.floor(diff / 86400)} d`
}

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.sender_type === 'ai' && msg.is_ai_suggestion) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%]">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 rounded-2xl rounded-tr-sm px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Návrh AI</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{msg.content}</p>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 bg-[#0F172A] text-white text-xs font-medium py-2 rounded-lg hover:bg-gray-800 transition-colors">Použít</button>
              <button className="flex-1 bg-white border border-gray-200 text-gray-700 text-xs font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors">Upravit</button>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 text-right">{timeAgo(msg.created_at)}</p>
        </div>
      </div>
    )
  }

  if (msg.sender_type === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%]">
          <div className="bg-[#0F172A] text-white rounded-2xl rounded-tr-sm px-4 py-3">
            <p className="text-sm leading-relaxed">{msg.content}</p>
          </div>
          <div className="flex items-center justify-end gap-1 mt-1">
            <p className="text-[10px] text-gray-400">{timeAgo(msg.created_at)}</p>
            <CheckCheck className="h-3 w-3 text-blue-400" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%]">
        <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          <p className="text-sm text-gray-700 leading-relaxed">{msg.content}</p>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">{timeAgo(msg.created_at)}</p>
      </div>
    </div>
  )
}

export default function MessagesView() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [replyText, setReplyText] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    async function load() {
      const data = await getLeads()
      setLeads(data as Lead[])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedId) return
    async function loadMessages() {
      const data = await getMessages(selectedId!)
      setMessages(data as Message[])
    }
    loadMessages()
  }, [selectedId])

  const selected = leads.find((c) => c.id === selectedId)
  const filtered = leads.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.message.toLowerCase().includes(search.toLowerCase())
  )

  const handleSend = () => {
    if (!replyText.trim() || !selectedId) return
    startTransition(async () => {
      await sendMessage(selectedId, replyText)
      setReplyText('')
      const data = await getMessages(selectedId)
      setMessages(data as Message[])
    })
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 lg:p-8">
        <div className="animate-pulse h-[600px] bg-gray-100 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-80px)] lg:h-auto">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col lg:flex-row">
        {/* List */}
        <div className={`${selectedId ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 flex-col border-r border-gray-100`}>
          <div className="p-4 border-b border-gray-100">
            <h1 className="text-xl font-bold text-[#0F172A] mb-4">Zprávy</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Hledat..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-gray-300"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedId(lead.id)}
                  className={`w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 ${selectedId === lead.id ? 'bg-gray-50' : ''}`}
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${lead.status === 'new' ? 'bg-[#0F172A] text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {lead.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-sm text-[#0F172A]">{lead.name}</span>
                      <span className="text-[10px] text-gray-400">{timeAgo(lead.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-1">{lead.message}</p>
                  </div>
                  {lead.status === 'new' && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-2" />}
                </button>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400">
                <p className="text-sm">Žádné zprávy</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat */}
        <div className={`${selectedId ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
          {selected ? (
            <>
              <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                <button onClick={() => setSelectedId(null)} className="lg:hidden p-1 -ml-1 text-gray-500 hover:text-gray-700">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="h-9 w-9 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-xs font-bold">
                  {selected.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-sm text-[#0F172A]">{selected.name}</h2>
                  <p className="text-[10px] text-gray-400">{selected.phone || 'Žádný telefon'}</p>
                </div>
                <a href={`tel:${selected.phone?.replace(/\s/g, '')}`} className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                  <Phone className="h-4 w-4" />
                </a>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-[#F8FAFC]">
                {messages.length > 0 ? (
                  messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <MessageCircle className="h-8 w-8 mb-2" />
                    <p className="text-sm">Zatím žádné zprávy</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Napište zprávu..."
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-gray-300"
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!replyText.trim() || isPending}
                    className="p-3 rounded-xl bg-[#0F172A] text-white hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
              <MessageCircle className="h-12 w-12 mb-4 text-gray-200" />
              <p className="text-sm font-medium">Vyberte konverzaci</p>
              <p className="text-xs mt-1">Zde se zobrazí vaše zprávy</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
