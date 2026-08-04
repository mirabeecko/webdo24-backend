'use client'

import { useState } from 'react'
import { startGoogleAudit, getGoogleAuditRun } from '@/lib/googleAuditApi'
import type { GoogleAuditDetailResponse } from '@/types'

export const dynamic = 'force-dynamic'

const severityConfig = {
  red: {
    label: 'Kritická',
    border: 'border-red-200',
    bg: 'bg-red-50',
    text: 'text-red-800',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
  },
  yellow: {
    label: 'Varování',
    border: 'border-yellow-200',
    bg: 'bg-yellow-50',
    text: 'text-yellow-800',
    badgeBg: 'bg-yellow-100',
    badgeText: 'text-yellow-700',
  },
  green: {
    label: 'OK',
    border: 'border-green-200',
    bg: 'bg-green-50',
    text: 'text-green-800',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
  },
}

export default function GoogleAuditPage() {
  const [form, setForm] = useState({
    domain: '',
    client_name: '',
    ga4_property_id: '',
    gtm_account_id: '',
    gtm_container_id: '',
    search_console_site_url: '',
  })

  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GoogleAuditDetailResponse | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const { run_id } = await startGoogleAudit({
        domain: form.domain,
        client_name: form.client_name || undefined,
        ga4_property_id: form.ga4_property_id || undefined,
        gtm_account_id: form.gtm_account_id || undefined,
        gtm_container_id: form.gtm_container_id || undefined,
        search_console_site_url: form.search_console_site_url || undefined,
      })

      // Poll for results
      setPolling(true)
      const maxAttempts = 60
      let attempts = 0

      const poll = async () => {
        attempts++
        try {
          const data = await getGoogleAuditRun(run_id)
          if (data.run?.status === 'completed' || data.run?.status === 'failed') {
            setResult(data)
            setPolling(false)
            setLoading(false)
            return
          }
        } catch {
          // ignore poll errors
        }

        if (attempts >= maxAttempts) {
          setError('Audit se nepodařilo dokončit včas. Zkuste obnovit stránku.')
          setPolling(false)
          setLoading(false)
          return
        }

        setTimeout(poll, 2000)
      }

      poll()
    } catch (err) {
      setLoading(false)
      setPolling(false)
      setError(err instanceof Error ? err.message : 'Neznámá chyba')
    }
  }

  const scoreColor =
    result?.run?.score === null || result?.run?.score === undefined
      ? 'text-gray-400'
      : result.run.score >= 80
        ? 'text-green-600'
        : result.run.score >= 50
          ? 'text-yellow-600'
          : 'text-red-600'

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-gray-800">Google Audit</h1>

      <div className="mb-8 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          Spustit nový audit
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Domain <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="domain"
                required
                value={form.domain}
                onChange={handleChange}
                placeholder="např. webdo24.cz"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Název klienta
              </label>
              <input
                type="text"
                name="client_name"
                value={form.client_name}
                onChange={handleChange}
                placeholder="Webdo24"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                GA4 Property ID
              </label>
              <input
                type="text"
                name="ga4_property_id"
                value={form.ga4_property_id}
                onChange={handleChange}
                placeholder=""
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                GTM Account ID
              </label>
              <input
                type="text"
                name="gtm_account_id"
                value={form.gtm_account_id}
                onChange={handleChange}
                placeholder=""
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                GTM Container ID
              </label>
              <input
                type="text"
                name="gtm_container_id"
                value={form.gtm_container_id}
                onChange={handleChange}
                placeholder=""
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Search Console URL
              </label>
              <input
                type="url"
                name="search_console_site_url"
                value={form.search_console_site_url}
                onChange={handleChange}
                placeholder="https://webdo24.cz/"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {polling ? 'Zpracovávám výsledky...' : 'Spouštím audit...'}
                </>
              ) : (
                'Spustit audit'
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-6">
          {/* Score */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              Výsledek auditu
            </h2>
            <div className="flex items-center space-x-4">
              <div className={`text-5xl font-bold ${scoreColor}`}>
                {result.run?.score !== null && result.run?.score !== undefined
                  ? `${result.run.score}/100`
                  : '—'}
              </div>
              <div className="space-y-1">
                <div className="text-sm text-gray-500">
                  Status:{' '}
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      result.run?.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : result.run?.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {result.run?.status === 'completed'
                      ? 'Dokončeno'
                      : result.run?.status === 'failed'
                        ? 'Chyba'
                        : result.run?.status}
                  </span>
                </div>
                {result.project && (
                  <div className="text-sm text-gray-500">
                    Doména:{' '}
                    <span className="font-medium text-gray-700">
                      {result.project.domain}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary */}
          {result.run?.summary && (
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-base font-semibold text-gray-800">
                Souhrn
              </h3>
              <pre className="max-h-64 overflow-auto rounded-md bg-gray-50 p-4 text-xs text-gray-700">
                {JSON.stringify(result.run.summary, null, 2)}
              </pre>
            </div>
          )}

          {/* Findings */}
          {result.findings && result.findings.length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-gray-800">
                Nalezené problémy ({result.findings.length})
              </h3>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {result.findings.map((finding) => {
                  const cfg =
                    severityConfig[finding.severity] || severityConfig.green
                  return (
                    <div
                      key={finding.id}
                      className={`rounded-lg border p-4 ${cfg.border} ${cfg.bg}`}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.badgeBg} ${cfg.badgeText}`}
                        >
                          {finding.area}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.badgeBg} ${cfg.badgeText}`}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <h4 className={`mb-1 text-sm font-semibold ${cfg.text}`}>
                        {finding.title}
                      </h4>
                      {finding.problem && (
                        <p className="mb-1 text-sm text-gray-700">
                          <span className="font-medium">Problém:</span>{' '}
                          {finding.problem}
                        </p>
                      )}
                      {finding.impact && (
                        <p className="mb-1 text-sm text-gray-700">
                          <span className="font-medium">Dopad:</span>{' '}
                          {finding.impact}
                        </p>
                      )}
                      {finding.recommendation && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Doporučení:</span>{' '}
                          {finding.recommendation}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(!result.findings || result.findings.length === 0) &&
            result.run?.status === 'completed' && (
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">
                  Žádné findings nebyly nalezeny. Vše vypadá dobře!
                </p>
              </div>
            )}
        </div>
      )}
    </div>
  )
}
