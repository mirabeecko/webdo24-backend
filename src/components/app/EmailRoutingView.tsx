'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Mail,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe,
  Loader2,
} from 'lucide-react'
import {
  getEmailRoutingRequests,
  createEmailRoutingRequest,
  resendEmailRoutingRequest,
} from '@/lib/actions/email-routing'

interface RequestItem {
  id: string
  domain: string
  email_prefix: string
  custom_email: string
  destination_email: string
  status: string
  error_message: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Připraveno',
    color: 'text-blue-600 bg-blue-50 border-blue-100',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  waiting_verification: {
    label: 'Čeká na potvrzení cílové schránky',
    color: 'text-amber-600 bg-amber-50 border-amber-100',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  active: {
    label: 'Aktivní',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  error: {
    label: 'Chyba',
    color: 'text-red-600 bg-red-50 border-red-100',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
}

export default function EmailRoutingView() {
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [projectDomain, setProjectDomain] = useState<string | null>(null)
  const [projectZoneId, setProjectZoneId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [domain, setDomain] = useState('')
  const [prefix, setPrefix] = useState('')
  const [destinationEmail, setDestinationEmail] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const data = await getEmailRoutingRequests()
      setRequests(data.requests)
      setProjectDomain(data.projectDomain)
      setProjectZoneId(data.projectZoneId)
      if (data.projectDomain && !domain) {
        setDomain(data.projectDomain)
      }
    } catch (e: any) {
      setError(e.message || 'Chyba při načítání')
    } finally {
      setLoading(false)
    }
  }

  const latestRequest = requests[0] || null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    try {
      const result = await createEmailRoutingRequest({
        domain,
        email_prefix: prefix,
        destination_email: destinationEmail,
        zone_id: projectZoneId || undefined,
      })

      if (result.success) {
        setSuccess(
          'Email byl nastaven. Pokud vám do cílové schránky přišel ověřovací email od Cloudflare, potvrďte ho. Poté bude přeposílání aktivní.'
        )
        await loadData()
      }
    } catch (e: any) {
      setError(e.message || 'Nastala chyba')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async (id: string) => {
    setError(null)
    setSuccess(null)
    setResendingId(id)

    try {
      const result = await resendEmailRoutingRequest(id)
      if (result.success) {
        setSuccess('Nastavení bylo znovu odesláno.')
        await loadData()
      }
    } catch (e: any) {
      setError(e.message || 'Nastala chyba při opakovaném odesílání')
    } finally {
      setResendingId(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-32 bg-gray-100 rounded-xl" />
        </div>
      </div>
    )
  }

  const statusInfo = latestRequest ? STATUS_LABELS[latestRequest.status] : null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center">
          <Mail className="h-5 w-5 text-sky-600" />
        </div>
        <div>
          <h2 className="font-semibold text-[#0F172A]">Firemní email</h2>
          <p className="text-xs text-gray-400">Profesionální email na vlastní doméně</p>
        </div>
      </div>

      {/* Status badge */}
      {latestRequest && statusInfo && (
        <div className={`mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${statusInfo.color}`}>
          {statusInfo.icon}
          {statusInfo.label}
        </div>
      )}

      {/* Explanation */}
      <p className="text-sm text-gray-600 mb-5 leading-relaxed">
        Vytvořte si profesionální email na vlastní doméně, například{' '}
        <span className="font-medium text-[#0F172A]">info@vasedomena.cz</span>. Zprávy vám budou
        chodit do vašeho běžného Gmailu nebo jiné schránky.
      </p>

      {/* Error / Success messages */}
      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          {success}
        </div>
      )}

      {/* Existing request details */}
      {latestRequest && latestRequest.status !== 'error' && (
        <div className="mb-5 p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-[#0F172A]">{latestRequest.custom_email}</span>
            <span className="text-gray-400">→</span>
            <span className="text-gray-600">{latestRequest.destination_email}</span>
          </div>
          <div className="text-xs text-gray-400">
            Nastaveno {new Date(latestRequest.created_at).toLocaleDateString('cs-CZ')}
          </div>
        </div>
      )}

      {/* Error state with resend */}
      {latestRequest && latestRequest.status === 'error' && (
        <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-100 space-y-2">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">Nastavení se nepodařilo dokončit</span>
          </div>
          {latestRequest.error_message && (
            <p className="text-xs text-red-600">{latestRequest.error_message}</p>
          )}
          <button
            onClick={() => handleResend(latestRequest.id)}
            disabled={resendingId === latestRequest.id}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
          >
            {resendingId === latestRequest.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Znovu odeslat nastavení
          </button>
        </div>
      )}

      {/* Form */}
      {(!latestRequest || latestRequest.status === 'error') && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">
              Doména
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="vasestranka.cz"
                required
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-gray-300"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">
              Prefix emailu
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="info, rezervace, faktury..."
                required
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-gray-300"
              />
            </div>
            {domain && prefix && (
              <p className="mt-1.5 text-xs text-gray-500">
                Výsledný email:{' '}
                <span className="font-medium text-[#0F172A]">
                  {prefix}@{domain}
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">
              Cílový email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                value={destinationEmail}
                onChange={(e) => setDestinationEmail(e.target.value)}
                placeholder="vas.email@gmail.com"
                required
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-gray-300"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              Sem budou přeposílány všechny zprávy z firemního emailu.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1e293b] transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitting ? 'Odesílání...' : 'Začít používat firemní email'}
          </button>
        </form>
      )}
    </div>
  )
}
