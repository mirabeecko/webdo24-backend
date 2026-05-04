'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateSlug } from '@/lib/utils'

export default function NewProjectPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)

  const [form, setForm] = useState({
    title: '',
    business_type: '',
    location: '',
    target_audience: '',
    business_description: '',
    services: '',
    prices: '',
    contacts: '',
    required_sections: '',
    tone: '',
    colors: '',
    competitors: '',
    seo_keywords: '',
    special_requirements: '',
    domain: '',
    language: 'cs',
    price_type: 'one_time',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Musíte být přihlášeni')
        setLoading(false)
        return
      }

      const { data: customer } = await supabase
        .from('webdo24_customers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!customer) {
        setError('Zákazník nenalezen')
        setLoading(false)
        return
      }

      const slug = generateSlug(form.title)

      // Create project
      const { data: project, error: projectError } = await supabase
        .from('webdo24_projects')
        .insert({
          customer_id: customer.id,
          title: form.title,
          slug,
          business_type: form.business_type,
          target_audience: form.target_audience,
          location: form.location,
          language: form.language,
          status: 'submitted',
          price_type: form.price_type,
          domain: form.domain,
        })
        .select()
        .single()

      if (projectError || !project) {
        setError(projectError?.message || 'Chyba při vytváření projektu')
        setLoading(false)
        return
      }

      // Create brief
      const { error: briefError } = await supabase
        .from('webdo24_project_briefs')
        .insert({
          project_id: project.id,
          raw_input: JSON.stringify(form),
          business_description: form.business_description,
          services: form.services,
          prices: form.prices,
          contacts: form.contacts,
          tone: form.tone,
          colors: form.colors,
          competitors: form.competitors,
          seo_keywords: form.seo_keywords,
          required_sections: form.required_sections,
          special_requirements: form.special_requirements,
        })

      if (briefError) {
        console.error('Brief error:', briefError)
      }

      // Upload files
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const formData = new FormData()
          formData.append('file', file)
          formData.append('project_id', project.id)

          await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          })
        }
      }

      // Create event
      await supabase.from('webdo24_project_events').insert({
        project_id: project.id,
        user_id: user.id,
        event_type: 'project_created',
        message: 'Project created by customer',
      })

      router.push(`/customer/projects/${project.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-gray-800">Nový projekt</h1>

      {error && (
        <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Základní informace</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Název firmy/projektu *
              </label>
              <input
                name="title"
                required
                value={form.title}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Obor podnikání
              </label>
              <input
                name="business_type"
                value={form.business_type}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Lokalita
              </label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Cílová skupina
              </label>
              <input
                name="target_audience"
                value={form.target_audience}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Doména
              </label>
              <input
                name="domain"
                value={form.domain}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Jazyk webu
              </label>
              <select
                name="language"
                value={form.language}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="cs">Čeština</option>
                <option value="sk">Slovenčina</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Typ ceny
              </label>
              <select
                name="price_type"
                value={form.price_type}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="one_time">Jednorázově</option>
                <option value="monthly">Měsíčně</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Obsah webu</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Popis firmy
              </label>
              <textarea
                name="business_description"
                rows={4}
                value={form.business_description}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Služby
              </label>
              <textarea
                name="services"
                rows={3}
                value={form.services}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Ceny
              </label>
              <textarea
                name="prices"
                rows={3}
                value={form.prices}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Kontakty
              </label>
              <textarea
                name="contacts"
                rows={3}
                value={form.contacts}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Požadované sekce webu
              </label>
              <textarea
                name="required_sections"
                rows={3}
                value={form.required_sections}
                onChange={handleChange}
                placeholder="např. Úvod, O nás, Služby, Kontakt, Blog..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Design a styl</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Styl komunikace
              </label>
              <input
                name="tone"
                value={form.tone}
                onChange={handleChange}
                placeholder="např. profesionální, přátelský, hravý..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Barevnost
              </label>
              <input
                name="colors"
                value={form.colors}
                onChange={handleChange}
                placeholder="např. modrá, bílá, šedá..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Konkurenční weby
              </label>
              <input
                name="competitors"
                value={form.competitors}
                onChange={handleChange}
                placeholder="URL konkurenčních webů"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                SEO klíčová slova
              </label>
              <input
                name="seo_keywords"
                value={form.seo_keywords}
                onChange={handleChange}
                placeholder="např. webdesign, tvorba webu..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Další požadavky</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Speciální požadavky
            </label>
            <textarea
              name="special_requirements"
              rows={4}
              value={form.special_requirements}
              onChange={handleChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Soubory</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Logo, fotky, dokumenty
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              className="w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
            />
            {files && files.length > 0 && (
              <p className="mt-2 text-sm text-gray-500">
                Vybráno {files.length} souborů
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.push('/customer/projects')}
            className="rounded-md border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Odesílání...' : 'Odeslat zadání'}
          </button>
        </div>
      </form>
    </div>
  )
}
