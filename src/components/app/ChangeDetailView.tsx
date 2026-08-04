'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { approveChangeRequest, rejectChangeRequest } from '@/lib/actions/changes'
import type { ChangeRequest, ChangeCategory, ChangeStatus } from '@/types'

const CATEGORY_LABEL: Record<ChangeCategory, string> = {
  trivial: 'Drobná úprava',
  content: 'Úprava textu',
  media: 'Fotka / média',
  structure: 'Nová sekce',
  design: 'Design',
  page: 'Nová stránka',
  heavy: 'Velká změna',
  unknown: 'Klasifikujeme…',
}

// Status timeline — ordered list of states
const TIMELINE: ChangeStatus[] = [
  'new', 'classifying', 'planning', 'executing', 'preview_ready', 'approved', 'publishing', 'published',
]

const STATUS_LABEL: Record<ChangeStatus, string> = {
  new: 'Přijato',
  classifying: 'Analyzujeme',
  planning: 'Plánujeme',
  executing: 'Pracujeme na tom',
  preview_ready: 'Návrh připraven',
  approved: 'Schváleno',
  publishing: 'Publikujeme',
  published: 'Hotovo ✓',
  rejected: 'Zrušeno',
  failed: 'Chyba',
  escalated: 'V řešení',
}

function currentTimelineIndex(status: ChangeStatus): number {
  const idx = TIMELINE.indexOf(status)
  return idx === -1 ? 0 : idx
}

interface Props {
  cr: ChangeRequest
}

export default function ChangeDetailView({ cr }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  const isTerminal = ['published', 'rejected', 'failed'].includes(cr.status)
  const canApprove = cr.status === 'preview_ready'
  const timelineIdx = currentTimelineIndex(cr.status)

  const handleApprove = () => {
    setAction('approve')
    setError(null)
    startTransition(async () => {
      try {
        await approveChangeRequest(cr.id)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Nepodařilo se schválit')
        setAction(null)
      }
    })
  }

  const handleReject = () => {
    setAction('reject')
    setError(null)
    startTransition(async () => {
      try {
        await rejectChangeRequest(cr.id, rejectReason || undefined)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Nepodařilo se zrušit')
        setAction(null)
      }
    })
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Back */}
        <Link href="/pozadavky" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Zpět na požadavky
        </Link>

        {/* Header card */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-[#0F172A]/5 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-[#0F172A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-[#0F172A] leading-snug">{cr.raw_input}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {CATEGORY_LABEL[cr.category ?? 'unknown']}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(cr.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        {!isTerminal && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm mb-6">
            <h2 className="text-sm font-semibold text-gray-500 mb-5">Průběh zpracování</h2>
            <div className="relative">
              {/* Track */}
              <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
              <ul className="space-y-5">
                {TIMELINE.map((s, i) => {
                  const done = i < timelineIdx
                  const active = i === timelineIdx
                  return (
                    <li key={s} className="relative flex items-start gap-4 pl-10">
                      <div className={`absolute left-0 h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                        done
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : active
                          ? 'bg-[#0F172A] border-[#0F172A] text-white'
                          : 'bg-white border-gray-200 text-gray-400'
                      }`}>
                        {done ? '✓' : i + 1}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${active ? 'text-[#0F172A]' : done ? 'text-gray-400' : 'text-gray-400'}`}>
                          {STATUS_LABEL[s]}
                        </p>
                        {active && (
                          <p className="text-xs text-gray-400 mt-0.5">Probíhá…</p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Terminal states */}
        {cr.status === 'published' && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 mb-6 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-800">Změna je online</p>
              <p className="text-sm text-emerald-600">Váš web byl aktualizován.</p>
            </div>
          </div>
        )}
        {cr.status === 'rejected' && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 mb-6 flex items-center gap-3">
            <XCircle className="h-6 w-6 text-gray-400 shrink-0" />
            <div>
              <p className="font-semibold text-gray-700">Požadavek zrušen</p>
              {cr.error_message && <p className="text-sm text-gray-500">{cr.error_message}</p>}
            </div>
          </div>
        )}
        {cr.status === 'failed' && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 mb-6 flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-500 shrink-0" />
            <div>
              <p className="font-semibold text-red-800">Zpracování selhalo</p>
              {cr.error_message && <p className="text-sm text-red-600">{cr.error_message}</p>}
              <p className="text-sm text-red-500 mt-1">Náš tým byl upozorněn a brzy vás kontaktuje.</p>
            </div>
          </div>
        )}

        {/* Preview + Approve */}
        {canApprove && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 mb-6">
            <h2 className="font-bold text-[#0F172A] mb-1">Návrh je připraven ke schválení</h2>
            <p className="text-sm text-gray-600 mb-5">
              Zkontrolujte návrh a schvalte ho pro zveřejnění. Nic se nepublikuje bez vašeho souhlasu.
            </p>

            {cr.draft_version_id && (
              <a
                href={`/preview/${cr.draft_version_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F172A] underline underline-offset-2 mb-5 hover:text-gray-600 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Zobrazit náhled webu
              </a>
            )}

            {error && (
              <p className="flex items-center gap-2 text-sm text-red-600 mb-4">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            {showRejectForm ? (
              <div className="space-y-3">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Proč chcete požadavek zrušit? (volitelné)"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:border-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleReject}
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    {pending && action === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Potvrdit zrušení
                  </button>
                  <button
                    onClick={() => setShowRejectForm(false)}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Zpět
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-40 transition-all shadow-sm"
                >
                  {pending && action === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Schválit a publikovat
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Zrušit
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
