'use client'

import { useState, useEffect } from 'react'
import {
  Globe,
  Smartphone,
  Monitor,
  CheckCircle2,
  Image,
  Star,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle,
  X,
  Rocket,
  RotateCcw,
  Save,
  ExternalLink,
} from 'lucide-react'
import {
  getWebsiteContent,
  getTestimonials,
  getServices,
  getProjectUrl,
  updateWebsiteContent,
  createTestimonial,
  deleteTestimonial,
  createService,
  deleteService,
} from '@/lib/actions/web'
import {
  publishWebsite,
  getSnapshots,
  restoreSnapshot,
  createSnapshot,
} from '@/lib/actions/web-admin'

interface ContentItem {
  id: string
  section_key: string
  label: string
  content_type: string
  content_value: string
}

const DEFAULT_SECTIONS = [
  {
    id: 'hero',
    label: 'Hlavní strana',
    keys: ['hero_title', 'hero_subtitle', 'hero_image'],
    defaults: [
      { section_key: 'hero_title', content_type: 'text', content_value: '', label: 'Nadpis' },
      { section_key: 'hero_subtitle', content_type: 'textarea', content_value: '', label: 'Podnadpis' },
      { section_key: 'hero_image', content_type: 'image', content_value: '', label: 'Hlavní fotka' },
    ],
  },
  {
    id: 'contact',
    label: 'Kontakty',
    keys: ['phone', 'email', 'address', 'hours'],
    defaults: [
      { section_key: 'phone', content_type: 'phone', content_value: '', label: 'Telefon' },
      { section_key: 'email', content_type: 'text', content_value: '', label: 'Email' },
      { section_key: 'address', content_type: 'text', content_value: '', label: 'Adresa' },
      { section_key: 'hours', content_type: 'text', content_value: '', label: 'Otevírací doba' },
    ],
  },
  {
    id: 'about',
    label: 'O nás',
    keys: ['about_text'],
    defaults: [
      { section_key: 'about_text', content_type: 'textarea', content_value: '', label: 'Text' },
    ],
  },
]

function EditableField({ item, onSave }: { item: ContentItem; onSave: (id: string, val: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [localValue, setLocalValue] = useState(item.content_value)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setLocalValue(item.content_value)
  }, [item.content_value, item.id])

  const handleSave = () => {
    if (localValue !== item.content_value) {
      onSave(item.id, localValue)
    }
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && item.content_type !== 'textarea') {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      setLocalValue(item.content_value)
      setEditing(false)
    }
  }

  return (
    <div className="group">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{item.label}</label>
      {editing ? (
        <div className="relative">
          {item.content_type === 'textarea' ? (
            <textarea value={localValue} onChange={(e) => setLocalValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleSave} autoFocus className="w-full px-3 py-2 rounded-lg border border-blue-300 bg-blue-50/30 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" rows={3} />
          ) : item.content_type === 'image' ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-300 bg-blue-50/30">
              <div className="h-16 w-16 rounded-lg bg-gray-200 flex items-center justify-center"><Image className="h-6 w-6 text-gray-400" /></div>
              <div><button className="text-sm text-blue-600 font-medium hover:text-blue-700">Nahrát novou fotku</button><p className="text-xs text-gray-400 mt-0.5">nebo přetáhněte sem</p></div>
            </div>
          ) : (
            <input type={item.content_type === 'phone' ? 'tel' : 'text'} value={localValue} onChange={(e) => setLocalValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleSave} autoFocus className="w-full px-3 py-2 rounded-lg border border-blue-300 bg-blue-50/30 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-200" />
          )}
          {saved && <span className="absolute right-2 top-2 text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Uloženo</span>}
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="w-full text-left px-3 py-2 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all group-hover:border-gray-100">
          {item.content_type === 'image' ? (
            <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center"><Image className="h-4 w-4 text-gray-400" /></div><span className="text-sm text-gray-500">Klikněte pro změnu fotky</span></div>
          ) : (
            <span className="text-sm text-[#0F172A]">{item.content_value || <span className="text-gray-400 italic">Klikněte a vyplňte...</span>}</span>
          )}
        </button>
      )}
    </div>
  )
}

export default function WebEditorView() {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [expandedSections, setExpandedSections] = useState<string[]>(['hero', 'contact', 'about', 'services', 'testimonials'])
  const [content, setContent] = useState<ContentItem[]>([])
  const [testimonials, setTestimonials] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishUrl, setPublishUrl] = useState('')
  const [projectUrl, setProjectUrl] = useState('')
  const [restoring, setRestoring] = useState(false)

  const [showServiceForm, setShowServiceForm] = useState(false)
  const [showTestimonialForm, setShowTestimonialForm] = useState(false)
  const [newService, setNewService] = useState({ title: '', description: '', price: '' })
  const [newTestimonial, setNewTestimonial] = useState({ customer_name: '', rating: 5, text: '' })

  async function reloadAll() {
    const [c, t, s, sn, url] = await Promise.all([getWebsiteContent(), getTestimonials(), getServices(), getSnapshots(), getProjectUrl()])
    const mapped = (c || []).map((item: any) => ({ ...item, label: getLabelForKey(item.section_key) }))
    setContent(mapped)
    setTestimonials(t || [])
    setServices(s || [])
    setSnapshots(sn || [])
    if (url) setProjectUrl(url)
  }

  useEffect(() => { reloadAll().then(() => setLoading(false)) }, [])

  function getLabelForKey(key: string) {
    const labels: Record<string, string> = { hero_title: 'Nadpis', hero_subtitle: 'Podnadpis', hero_image: 'Hlavní fotka', phone: 'Telefon', email: 'Email', address: 'Adresa', hours: 'Otevírací doba', about_text: 'Text' }
    return labels[key] || key
  }

  const handleSave = async (id: string, val: string) => { await updateWebsiteContent(id, val); await reloadAll() }
  const handleAddService = async () => { if (!newService.title.trim()) return; await createService(newService); setNewService({ title: '', description: '', price: '' }); setShowServiceForm(false); await reloadAll() }
  const handleDeleteService = async (id: string) => { if (!confirm('Opravdu chcete smazat tuto službu?')) return; await deleteService(id); await reloadAll() }
  const handleAddTestimonial = async () => { if (!newTestimonial.customer_name.trim() || !newTestimonial.text.trim()) return; await createTestimonial(newTestimonial); setNewTestimonial({ customer_name: '', rating: 5, text: '' }); setShowTestimonialForm(false); await reloadAll() }
  const handleDeleteTestimonial = async (id: string) => { if (!confirm('Opravdu chcete smazat tuto referenci?')) return; await deleteTestimonial(id); await reloadAll() }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      const result = await publishWebsite()
      if (result.success) setPublishUrl(result.url)
    } catch (e: any) {
      alert('Chyba při publikování: ' + e.message)
    } finally {
      setPublishing(false)
    }
  }

  const handleRestore = async (id: string) => {
    if (!confirm('Opravdu chcete obnovit web ze zálohy? Aktuální změny budou přepsány.')) return
    setRestoring(true)
    try {
      await restoreSnapshot(id)
      await reloadAll()
    } catch (e: any) {
      alert('Chyba při obnově: ' + e.message)
    } finally {
      setRestoring(false)
    }
  }

  const handleManualBackup = async () => {
    const name = prompt('Název zálohy (nepovinné):') || undefined
    await createSnapshot(name)
    await reloadAll()
  }

  function getSectionItems(sectionId: string): ContentItem[] {
    const section = DEFAULT_SECTIONS.find((s) => s.id === sectionId)
    if (!section) return []
    return section.keys.map((key) => {
      const dbItem = content.find((c) => c.section_key === key)
      if (dbItem) return { ...dbItem, label: getLabelForKey(key) }
      const def = section.defaults.find((d) => d.section_key === key)
      return { id: `default-${key}`, section_key: key, label: getLabelForKey(key), content_type: def?.content_type || 'text', content_value: def?.content_value || '' }
    })
  }

  const heroItems = getSectionItems('hero')
  const contactItems = getSectionItems('contact')
  const aboutItems = getSectionItems('about')
  const toggleSection = (id: string) => setExpandedSections((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id])

  if (loading) return <div className="max-w-5xl mx-auto p-4 lg:p-8"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-48" /><div className="h-[600px] bg-gray-100 rounded-2xl" /></div></div>

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div><h1 className="text-2xl lg:text-3xl font-bold text-[#0F172A]">Můj web</h1><p className="mt-1 text-gray-500">Klikněte na jakýkoliv text a upravte ho</p></div>
        <div className="flex items-center gap-3">
          <button onClick={handleManualBackup} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors">
            <Save className="h-4 w-4" /> Zálohovat
          </button>
          <a href={projectUrl} target="_blank" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
            <ExternalLink className="h-4 w-4" /> Zobrazit web
          </a>
          <button onClick={handlePublish} disabled={publishing} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F172A] text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 shadow-sm">
            <Rocket className="h-4 w-4" /> {publishing ? 'Publikuji...' : 'Publikovat změny'}
          </button>
        </div>
      </div>

      {publishUrl && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
          <div><p className="text-sm text-emerald-800 font-medium">✅ Web byl publikován!</p><a href={publishUrl} target="_blank" className="text-sm text-emerald-600 hover:underline">{publishUrl}</a></div>
          <button onClick={() => setPublishUrl('')} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex bg-gray-100 rounded-xl p-1">
          <button onClick={() => setPreviewMode('desktop')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${previewMode === 'desktop' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Monitor className="h-4 w-4" /> Počítač</button>
          <button onClick={() => setPreviewMode('mobile')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${previewMode === 'mobile' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Smartphone className="h-4 w-4" /> Mobil</button>
        </div>
      </div>

      <div className={`mx-auto transition-all duration-300 ${previewMode === 'mobile' ? 'max-w-sm' : 'max-w-4xl'}`}>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className="flex gap-1.5"><div className="h-3 w-3 rounded-full bg-red-400" /><div className="h-3 w-3 rounded-full bg-amber-400" /><div className="h-3 w-3 rounded-full bg-emerald-400" /></div>
            <div className="flex-1 bg-white rounded-lg px-3 py-1.5 text-xs text-gray-400 flex items-center gap-2"><Globe className="h-3 w-3" />login.webdo24.cz/truhlarstvi-drevorez</div>
          </div>

          <div className="p-6 space-y-6">
            {/* Hero */}
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <button onClick={() => toggleSection('hero')} className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"><span className="font-semibold text-sm text-[#0F172A]">Hlavní strana</span>{expandedSections.includes('hero') ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}</button>
              {expandedSections.includes('hero') && <div className="p-4 space-y-4">{heroItems.map((item) => <EditableField key={item.section_key} item={item} onSave={handleSave} />)}</div>}
            </div>
            {/* Contact */}
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <button onClick={() => toggleSection('contact')} className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"><span className="font-semibold text-sm text-[#0F172A]">Kontakty</span>{expandedSections.includes('contact') ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}</button>
              {expandedSections.includes('contact') && <div className="p-4 space-y-4">{contactItems.map((item) => <EditableField key={item.section_key} item={item} onSave={handleSave} />)}</div>}
            </div>
            {/* About */}
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <button onClick={() => toggleSection('about')} className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"><span className="font-semibold text-sm text-[#0F172A]">O nás</span>{expandedSections.includes('about') ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}</button>
              {expandedSections.includes('about') && <div className="p-4 space-y-4">{aboutItems.map((item) => <EditableField key={item.section_key} item={item} onSave={handleSave} />)}</div>}
            </div>
            {/* Services */}
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <button onClick={() => toggleSection('services')} className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"><span className="font-semibold text-sm text-[#0F172A]">Služby ({services.length})</span>{expandedSections.includes('services') ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}</button>
              {expandedSections.includes('services') && (
                <div className="p-4 space-y-3">
                  {services.length > 0 ? services.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-[#0F172A]">{s.title}</p><p className="text-xs text-gray-500">{s.description}</p>{s.price && <p className="text-xs text-emerald-600 mt-0.5 font-medium">{s.price}</p>}</div>
                      <button onClick={() => handleDeleteService(s.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors shrink-0 ml-2"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )) : <div className="text-center py-4 text-gray-400 text-sm"><AlertCircle className="h-5 w-5 mx-auto mb-1" />Zatím žádné služby</div>}
                  {showServiceForm ? (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
                      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-[#0F172A]">Nová služba</h3><button onClick={() => setShowServiceForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button></div>
                      <input type="text" placeholder="Název služby" value={newService.title} onChange={(e) => setNewService({ ...newService, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300" />
                      <input type="text" placeholder="Popis" value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300" />
                      <input type="text" placeholder="Cena (nepovinné)" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300" />
                      <button onClick={handleAddService} disabled={!newService.title.trim()} className="w-full py-2.5 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-40">Uložit službu</button>
                    </div>
                  ) : <button onClick={() => setShowServiceForm(true)} className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"><Plus className="h-4 w-4" /> Přidat službu</button>}
                </div>
              )}
            </div>
            {/* Testimonials */}
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <button onClick={() => toggleSection('testimonials')} className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"><span className="font-semibold text-sm text-[#0F172A]">Reference ({testimonials.length})</span>{expandedSections.includes('testimonials') ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}</button>
              {expandedSections.includes('testimonials') && (
                <div className="p-4 space-y-3">
                  {testimonials.length > 0 ? testimonials.map((t) => (
                    <div key={t.id} className="p-3 rounded-lg border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2"><span className="text-sm font-medium text-[#0F172A]">{t.customer_name}</span><div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3 w-3 ${i < (t.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />)}</div></div>
                        <button onClick={() => handleDeleteTestimonial(t.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      <p className="text-sm text-gray-600">{t.text}</p>
                    </div>
                  )) : <div className="text-center py-4 text-gray-400 text-sm"><AlertCircle className="h-5 w-5 mx-auto mb-1" />Zatím žádné reference</div>}
                  {showTestimonialForm ? (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
                      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-[#0F172A]">Nová reference</h3><button onClick={() => setShowTestimonialForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button></div>
                      <input type="text" placeholder="Jméno zákazníka" value={newTestimonial.customer_name} onChange={(e) => setNewTestimonial({ ...newTestimonial, customer_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300" />
                      <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Hodnocení:</span><div className="flex gap-1">{[1,2,3,4,5].map((star) => <button key={star} onClick={() => setNewTestimonial({ ...newTestimonial, rating: star })} className="p-0.5"><Star className={`h-5 w-5 ${star <= newTestimonial.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} /></button>)}</div></div>
                      <textarea placeholder="Text reference" rows={3} value={newTestimonial.text} onChange={(e) => setNewTestimonial({ ...newTestimonial, text: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 resize-none" />
                      <button onClick={handleAddTestimonial} disabled={!newTestimonial.customer_name.trim() || !newTestimonial.text.trim()} className="w-full py-2.5 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-40">Uložit referenci</button>
                    </div>
                  ) : <button onClick={() => setShowTestimonialForm(true)} className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"><Plus className="h-4 w-4" /> Přidat referenci</button>}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 p-4">
              <div className="flex items-center gap-2 mb-2"><Sparkles className="h-4 w-4 text-blue-600" /><span className="text-sm font-semibold text-blue-900">AI asistent</span></div>
              <p className="text-sm text-blue-700 mb-3">Chcete, aby váš text působil profesionálněji?</p>
              <button className="px-4 py-2 rounded-lg bg-white text-blue-700 text-sm font-medium hover:bg-blue-50 transition-colors shadow-sm border border-blue-100">✨ Vylepši texty na webu</button>
            </div>
          </div>
        </div>
      </div>

      {/* Zálohy */}
      {snapshots.length > 0 && (
        <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-[#0F172A] mb-4 flex items-center gap-2"><Save className="h-5 w-5 text-gray-400" />Zálohy (posledních 4)</h2>
          <div className="space-y-2">
            {snapshots.map((snap: any) => (
              <div key={snap.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">{snap.name}</p>
                  <p className="text-xs text-gray-400">{new Date(snap.created_at).toLocaleString('cs-CZ')}</p>
                </div>
                <button onClick={() => handleRestore(snap.id)} disabled={restoring} className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-xs font-medium hover:bg-gray-100 transition-colors flex items-center gap-1 disabled:opacity-50">
                  <RotateCcw className="h-3 w-3" /> {restoring ? 'Obnovuji...' : 'Obnovit'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
