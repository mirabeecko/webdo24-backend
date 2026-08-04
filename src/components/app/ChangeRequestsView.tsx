'use client'

import { useState, useTransition } from 'react'
import { createChangeRequest } from '@/lib/actions/changes'
import type { ChangeRequest, ChangeCategory, ChangeStatus } from '@/types'
import { Sparkles, Clock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'

const EXAMPLES = [
  'Změň cenu balíčku Premium na 2 990 Kč.',
  'Přidej referenci od pana Nováka.',
  'Nahraj nové foto interiéru.',
  'Změň otevírací dobu v sobotu na 9–14 h.',
  'Udělej design modernější.',
]

const CATEGORY_LABEL: Record<ChangeCategory, string> = {
  trivial:   'Drobná úprava',
  content:   'Úprava textu',
  media:     'Fotka',
  structure: 'Nová sekce',
  design:    'Design',
  page:      'Nová stránka',
  heavy:     'Velká změna',
  unknown:   'Klasifikujeme…',
}

const STATUS_META: Record<ChangeStatus, { label: string; tone: 'work' | 'ok' | 'wait' | 'bad' }> = {
  new:           { label: 'Přijato',          tone: 'wait' },
  classifying:   { label: 'Analyzujeme',      tone: 'work' },
  planning:      { label: 'Plánujeme',        tone: 'work' },
  executing:     { label: 'Pracujeme',        tone: 'work' },
  preview_ready: { label: 'Návrh připraven',  tone: 'ok'   },
  approved:      { label: 'Schváleno',        tone: 'ok'   },
  publishing:    { label: 'Publikujeme',      tone: 'work' },
  published:     { label: 'Hotovo',           tone: 'ok'   },
  rejected:      { label: 'Zrušeno',          tone: 'wait' },
  failed:        { label: 'Chyba',            tone: 'bad'  },
  escalated:     { label: 'V řešení',         tone: 'work' },
}

export default function ChangeRequestsView({
  initialItems,
}: {
  initialItems: ChangeRequest[]
}) {
  const [items, setItems] = useState<ChangeRequest[]>(initialItems)
  const [input, setInput] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    const text = input.trim()
    if (!text) return
    startTransition(async () => {
      try {
        const res = await createChangeRequest(text)
        // Optimisticky přidej do listu, server pak doplní AI workflow
        const optimistic: ChangeRequest = {
          id: res.id,
          project_id: '',
          user_id: null,
          raw_input: text,
          category: res.category,
          confidence: res.confidence,
          status: 'classifying',
          ai_cost_cents: 0,
          iteration_count: 0,
          is_billable: false,
          draft_version_id: null,
          published_version_id: null,
          error_message: null,
          resolved_at: null,
          created_at: new Date().toISOString(),
        }
        setItems((prev) => [optimistic, ...prev])
        setInput('')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Něco se pokazilo')
      }
    })
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">AI požadavky</h1>
          <p className="mt-2 text-gray-500">
            Napište jednou větou, co chcete změnit. Ostatní necháte na nás.
          </p>
        </header>

        {/* Input card */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Sparkles className="h-4 w-4 text-[#0F172A]" />
            Co byste chtěli změnit?
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Např.: změň cenu balíčku Premium na 2 990 Kč"
            rows={3}
            className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] leading-relaxed text-gray-900 placeholder:text-gray-400 focus:border-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10"
            disabled={pending}
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setInput(ex)}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-white transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-3 flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          )}

          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Návrh připravíme do 2 minut. Nic se nezveřejní bez vašeho schválení.
            </p>
            <button
              onClick={submit}
              disabled={pending || !input.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? 'Odesíláme…' : 'Odeslat'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* History */}
        <section className="mt-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Historie požadavků
          </h2>

          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
              <p className="text-gray-500">Zatím žádné požadavky. Začněte zprávou nahoře.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((cr) => <ChangeRow key={cr.id} cr={cr} />)}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function ChangeRow({ cr }: { cr: ChangeRequest }) {
  const meta = STATUS_META[cr.status]
  return (
    <li className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-gray-200">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-gray-900 line-clamp-2">{cr.raw_input}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
              {CATEGORY_LABEL[cr.category ?? 'unknown']}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(cr.created_at)}
            </span>
          </div>
        </div>
        <StatusBadge tone={meta.tone} label={meta.label} />
      </div>
    </li>
  )
}

function StatusBadge({ tone, label }: { tone: 'work' | 'ok' | 'wait' | 'bad'; label: string }) {
  const palette = {
    work: 'bg-blue-50 text-blue-700 ring-blue-100',
    ok:   'bg-emerald-50 text-emerald-700 ring-emerald-100',
    wait: 'bg-gray-50 text-gray-600 ring-gray-100',
    bad:  'bg-red-50 text-red-700 ring-red-100',
  }[tone]
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'bad' ? AlertCircle : Clock
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${palette}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'právě teď'
  if (diff < 3_600_000) return `před ${Math.floor(diff / 60_000)} min`
  if (diff < 86_400_000) return `před ${Math.floor(diff / 3_600_000)} h`
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
}
