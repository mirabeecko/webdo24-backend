'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

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

export default function CustomerProjectDetailClient({
  project,
  brief,
  files,
  events,
}: {
  project: any
  brief: any
  files: any[]
  events: any[]
}) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [uploading, setUploading] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    const res = await fetch(`/api/customer/projects/${project.id}/approve`, {
      method: 'POST',
    })
    setLoading(false)
    if (res.ok) {
      setMessage('Web byl schválen. Děkujeme!')
      router.refresh()
    } else {
      setMessage('Chyba při schvalování')
    }
  }

  const handleRequestRevision = async () => {
    setLoading(true)
    const res = await fetch(`/api/customer/projects/${project.id}/revision`, {
      method: 'POST',
    })
    setLoading(false)
    if (res.ok) {
      setMessage('Žádost o úpravu byla odeslána.')
      router.refresh()
    } else {
      setMessage('Chyba')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', project.id)

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    setUploading(false)
    if (res.ok) {
      setMessage('Soubor byl nahrán.')
      router.refresh()
    } else {
      setMessage('Chyba při nahrávání souboru')
    }
  }

  const tabs = [
    { id: 'overview', label: 'Přehled' },
    { id: 'brief', label: 'Zadání' },
    { id: 'files', label: 'Soubory' },
    { id: 'history', label: 'Historie' },
  ]

  return (
    <div>
      <div className="mb-6">
        <Link href="/customer/projects" className="text-sm text-blue-600 hover:underline">
          ← Zpět na projekty
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-800">{project.title}</h1>
        <p className="mt-1 text-lg text-gray-500">
          {statusLabels[project.status] || project.status}
        </p>
      </div>

      {message && (
        <div className="mb-4 rounded bg-blue-100 p-3 text-sm text-blue-700">
          {message}
        </div>
      )}

      {(project.status === 'generated' || project.status === 'qa_check') && (
        <div className="mb-6 flex space-x-4">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Schválit web
          </button>
          <button
            onClick={handleRequestRevision}
            disabled={loading}
            className="rounded bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
          >
            Požádat o úpravu
          </button>
        </div>
      )}

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
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Stav projektu</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Aktuální stav</label>
                <div className="mt-1 text-lg font-medium text-gray-900">
                  {statusLabels[project.status] || project.status}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Preview URL</label>
                <div className="mt-1">
                  {project.preview_url ? (
                    <a
                      href={project.preview_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {project.preview_url}
                    </a>
                  ) : (
                    'Zatím není k dispozici'
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Produkční URL</label>
                <div className="mt-1">
                  {project.production_url ? (
                    <a
                      href={project.production_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {project.production_url}
                    </a>
                  ) : (
                    'Zatím není nasazeno'
                  )}
                </div>
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

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700">Nahrát nový soubor</label>
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 disabled:opacity-50"
            />
            {uploading && <p className="mt-2 text-sm text-gray-500">Nahrávání...</p>}
          </div>

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

      {activeTab === 'history' && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Historie</h3>
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
    </div>
  )
}
