'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import Dialog from '@/components/ui/Dialog'

const statusOptions = [
  'draft',
  'submitted',
  'waiting_for_materials',
  'ready_for_generation',
  'generating',
  'generated',
  'qa_check',
  'needs_revision',
  'approved',
  'deployed',
  'archived',
]

const statusLabels: Record<string, string> = {
  draft: 'Koncept',
  submitted: 'Odesláno',
  waiting_for_materials: 'Čeká na materiály',
  ready_for_generation: 'Připraveno k generaci',
  generating: 'Generování',
  generated: 'Vygenerováno',
  qa_check: 'QA kontrola',
  needs_revision: 'Potřebuje úpravy',
  approved: 'Schváleno',
  deployed: 'Nasazeno',
  archived: 'Archivováno',
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-600',
  waiting_for_materials: 'bg-yellow-100 text-yellow-600',
  ready_for_generation: 'bg-purple-100 text-purple-600',
  generating: 'bg-orange-100 text-orange-600',
  generated: 'bg-green-100 text-green-600',
  qa_check: 'bg-indigo-100 text-indigo-600',
  needs_revision: 'bg-red-100 text-red-600',
  approved: 'bg-teal-100 text-teal-600',
  deployed: 'bg-emerald-100 text-emerald-600',
  archived: 'bg-gray-100 text-gray-500',
}

export default function ProjectDetailClient({
  project,
  brief,
  files,
  pipelineRuns,
  events,
  invoices,
}: {
  project: any
  brief: any
  files: any[]
  pipelineRuns: any[]
  events: any[]
  invoices: any[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [status, setStatus] = useState(project.status)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedPipelineRun, setSelectedPipelineRun] = useState<any>(null)

  const handleSave = async () => {
    setLoading(true)
    const res = await fetch(`/api/projects/${project.id}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setLoading(false)
    if (res.ok) {
      toast.addToast('Uloženo', 'success')
      router.refresh()
    } else {
      toast.addToast('Chyba při ukládání', 'error')
    }
  }

  const handleRunPipeline = async (type: string) => {
    setLoading(true)
    const res = await fetch('/api/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: project.id, pipeline_type: type }),
    })
    setLoading(false)
    if (res.ok) {
      toast.addToast(`Pipeline ${type} spuštěn`, 'success')
      router.refresh()
    } else {
      const data = await res.json()
      toast.addToast(data.error || 'Chyba', 'error')
    }
  }

  const handleRunQA = async () => {
    setLoading(true)
    const res = await fetch('/api/qa/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: project.id }),
    })
    setLoading(false)
    if (res.ok) {
      toast.addToast('QA kontrola spuštěna', 'success')
      router.refresh()
    } else {
      const data = await res.json()
      toast.addToast(data.error || 'Chyba', 'error')
    }
  }

  const handleApprove = async () => {
    setLoading(true)
    const res = await fetch(`/api/projects/${project.id}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    setLoading(false)
    if (res.ok) {
      setStatus('approved')
      toast.addToast('Schváleno', 'success')
      router.refresh()
    } else {
      toast.addToast('Chyba', 'error')
    }
  }

  const handleDeploy = async () => {
    setLoading(true)
    const res = await fetch('/api/deploy/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: project.id, production_url: project.production_url }),
    })
    setLoading(false)
    if (res.ok) {
      setStatus('deployed')
      toast.addToast('Nasazeno', 'success')
      router.refresh()
    } else {
      const data = await res.json()
      toast.addToast(data.error || 'Chyba', 'error')
    }
  }

  const handleArchive = async () => {
    setLoading(true)
    const res = await fetch(`/api/projects/${project.id}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    })
    setLoading(false)
    if (res.ok) {
      setStatus('archived')
      toast.addToast('Archivováno', 'success')
      router.refresh()
    } else {
      toast.addToast('Chyba', 'error')
    }
  }

  const tabs = [
    { id: 'overview', label: 'Přehled' },
    { id: 'brief', label: 'Zadání' },
    { id: 'files', label: 'Soubory' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'events', label: 'Historie' },
    { id: 'invoices', label: 'Fakturace' },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin/projects" className="text-sm text-blue-600 hover:underline">
            ← Zpět na projekty
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-800">{project.title}</h1>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            statusColors[status] || 'bg-gray-100 text-gray-600'
          }`}
        >
          {statusLabels[status] || status}
        </span>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="rounded bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
        >
          Uložit změny
        </button>
        <button
          onClick={() => handleRunPipeline('A')}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Spustit pipeline A
        </button>
        <button
          onClick={() => handleRunPipeline('B')}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Spustit pipeline B
        </button>
        <button
          onClick={() => handleRunPipeline('C')}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Spustit pipeline C
        </button>
        <button
          onClick={handleRunQA}
          disabled={loading}
          className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          Spustit QA
        </button>
        <button
          onClick={handleApprove}
          disabled={loading}
          className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          Označit jako schválené
        </button>
        <button
          onClick={handleDeploy}
          disabled={loading}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Nasadit na produkci
        </button>
        <button
          onClick={handleArchive}
          disabled={loading}
          className="rounded bg-gray-500 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-50"
        >
          Archivovat
        </button>
      </div>

      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-1 pb-4 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Základní informace</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-500">Stav</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {statusLabels[s] || s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Typ ceny</label>
                <div className="mt-1 text-gray-900">{project.price_type === 'monthly' ? 'Měsíčně' : 'Jednorázově'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Doména</label>
                <div className="mt-1 text-gray-900">{project.domain || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Jazyk</label>
                <div className="mt-1 text-gray-900">{project.language || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Obor podnikání</label>
                <div className="mt-1 text-gray-900">{project.business_type || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Lokalita</label>
                <div className="mt-1 text-gray-900">{project.location || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Preview URL</label>
                <div className="mt-1 text-gray-900">
                  {project.preview_url ? (
                    <a href={project.preview_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {project.preview_url}
                    </a>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Produkční URL</label>
                <div className="mt-1 text-gray-900">
                  {project.production_url ? (
                    <a href={project.production_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {project.production_url}
                    </a>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Zákazník</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-500">Jméno</label>
                <div className="mt-1 text-gray-900">{project.customer?.name || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Email</label>
                <div className="mt-1 text-gray-900">{project.customer?.email || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Telefon</label>
                <div className="mt-1 text-gray-900">{project.customer?.phone || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Firma</label>
                <div className="mt-1 text-gray-900">{project.customer?.company || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">IČO</label>
                <div className="mt-1 text-gray-900">{project.customer?.ico || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">DIČ</label>
                <div className="mt-1 text-gray-900">{project.customer?.dic || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Adresa</label>
                <div className="mt-1 text-gray-900">{project.customer?.address || '-'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'brief' && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Zadání projektu</h3>
          {brief ? (
            <div className="space-y-4">
              {[
                { label: 'Popis firmy', key: 'business_description' },
                { label: 'Služby', key: 'services' },
                { label: 'Ceny', key: 'prices' },
                { label: 'Kontakty', key: 'contacts' },
                { label: 'Tón komunikace', key: 'tone' },
                { label: 'Barevnost', key: 'colors' },
                { label: 'Konkurence', key: 'competitors' },
                { label: 'SEO klíčová slova', key: 'seo_keywords' },
                { label: 'Požadované sekce', key: 'required_sections' },
                { label: 'Speciální požadavky', key: 'special_requirements' },
                { label: 'Raw input', key: 'raw_input' },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-500">{field.label}</label>
                  <div className="mt-1 whitespace-pre-wrap text-gray-900">{brief[field.key] || '-'}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Žádné zadání</p>
          )}
        </div>
      )}

      {activeTab === 'files' && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Soubory</h3>
          {files.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {files.map((file: any) => (
                <div key={file.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-gray-900">{file.file_name}</p>
                    <p className="text-sm text-gray-500">{file.file_type || 'Neznámý typ'}</p>
                  </div>
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Stáhnout
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Žádné soubory</p>
          )}
        </div>
      )}

      {activeTab === 'pipeline' && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Pipeline běhy</h3>
          {pipelineRuns.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {pipelineRuns.map((run: any) => (
                <div key={run.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <button
                        onClick={() => setSelectedPipelineRun(run)}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        Pipeline {run.pipeline_type}
                      </button>
                      <p className="text-sm text-gray-500">
                        {run.status} | {formatDate(run.started_at)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        run.status === 'success'
                          ? 'bg-green-100 text-green-600'
                          : run.status === 'failed'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {run.status}
                    </span>
                  </div>
                  {run.error_message && (
                    <p className="mt-1 text-sm text-red-600">{run.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Žádné pipeline běhy</p>
          )}
        </div>
      )}

      <Dialog
        open={!!selectedPipelineRun}
        onClose={() => setSelectedPipelineRun(null)}
        title={`Pipeline ${selectedPipelineRun?.pipeline_type} – detail`}
      >
        {selectedPipelineRun && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-500">Status:</span>{' '}
                <span className="font-medium">{selectedPipelineRun.status}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Spuštěno:</span>{' '}
                {formatDate(selectedPipelineRun.started_at)}
              </div>
              <div>
                <span className="font-medium text-gray-500">Dokončeno:</span>{' '}
                {selectedPipelineRun.finished_at ? formatDate(selectedPipelineRun.finished_at) : '—'}
              </div>
            </div>

            {selectedPipelineRun.error_message && (
              <div className="rounded bg-red-50 p-3 text-sm text-red-700">
                <span className="font-medium">Chyba:</span> {selectedPipelineRun.error_message}
              </div>
            )}

            {selectedPipelineRun.input_json && (
              <div>
                <h4 className="mb-1 text-sm font-medium text-gray-700">Input JSON</h4>
                <pre className="max-h-64 overflow-auto rounded bg-gray-100 p-3 text-xs">
                  {JSON.stringify(selectedPipelineRun.input_json, null, 2)}
                </pre>
              </div>
            )}

            {selectedPipelineRun.output_json && (
              <div>
                <h4 className="mb-1 text-sm font-medium text-gray-700">Output JSON</h4>
                <pre className="max-h-64 overflow-auto rounded bg-gray-100 p-3 text-xs">
                  {JSON.stringify(selectedPipelineRun.output_json, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {activeTab === 'events' && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Historie událostí</h3>
          {events.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {events.map((event: any) => (
                <div key={event.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{event.event_type}</p>
                      <p className="text-sm text-gray-500">{event.message}</p>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(event.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Žádné události</p>
          )}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Nová faktura</h3>
            <InvoiceForm
              customerId={project.customer_id}
              projectId={project.id}
              onCreated={() => {
                toast.addToast('Faktura vytvořena', 'success')
                router.refresh()
              }}
            />
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Fakturace</h3>
            {invoices.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {invoices.map((invoice: any) => (
                  <div key={invoice.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {invoice.amount} {invoice.currency}
                        </p>
                        <p className="text-sm text-gray-500">{invoice.status}</p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {invoice.due_date || formatDate(invoice.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Žádné faktury</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InvoiceForm({
  customerId,
  projectId,
  onCreated,
}: {
  customerId: string
  projectId: string
  onCreated: () => void
}) {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('CZK')
  const [paymentType, setPaymentType] = useState('one_time')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        project_id: projectId,
        amount: parseFloat(amount),
        currency,
        payment_type: paymentType,
        due_date: dueDate || null,
      }),
    })

    setSubmitting(false)
    if (res.ok) {
      setAmount('')
      setDueDate('')
      onCreated()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Částka</label>
        <input
          type="number"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Měna</label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
        >
          <option value="CZK">CZK</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Typ platby</label>
        <select
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
        >
          <option value="one_time">Jednorázově</option>
          <option value="monthly">Měsíčně</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Splatnost</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div className="md:col-span-4">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Vytváření...' : 'Vytvořit fakturu'}
        </button>
      </div>
    </form>
  )
}
