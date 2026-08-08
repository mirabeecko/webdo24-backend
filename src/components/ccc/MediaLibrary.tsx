'use client'

// MediaLibrary (§9): grid assetů, filtry kategorií, upload, detail
// s alt textem a „Kde je použitý".

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, Loader2, AlertCircle, CheckCircle2, X,
  Image as ImageIcon, FileText, Link2,
} from 'lucide-react'
import {
  uploadMediaAction,
  getMediaUsageAction,
  updateMediaAltAction,
} from '@/lib/actions/ccc'
import type { MediaCategory } from '@/types/website-contract'
import type { MediaUsageEntry } from '@/lib/ccc/media'
import type { AssetWithThumb } from '@/components/ccc/ContentEditor'

const CATEGORY_FILTERS: Array<{ key: MediaCategory | null; label: string }> = [
  { key: null, label: 'Vše' },
  { key: 'photo', label: 'Fotografie' },
  { key: 'logo', label: 'Loga' },
  { key: 'gallery', label: 'Galerie' },
  { key: 'product', label: 'Produkty' },
  { key: 'document', label: 'Dokumenty' },
]

const CATEGORY_BY_MIME = (mime: string): MediaCategory =>
  mime === 'application/pdf' ? 'document' : 'photo'

export default function MediaLibrary({
  assets,
  canEdit,
}: {
  assets: AssetWithThumb[]
  canEdit: boolean
}) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState<MediaCategory | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState(false)
  const [selected, setSelected] = useState<AssetWithThumb | null>(null)
  const [altText, setAltText] = useState('')
  const [altSaved, setAltSaved] = useState(false)
  const [usage, setUsage] = useState<MediaUsageEntry[] | null>(null)

  const filtered = filter ? assets.filter((a) => a.category === filter) : assets

  const handleUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)
    setUploaded(false)
    startTransition(async () => {
      try {
        for (const file of Array.from(files)) {
          const fd = new FormData()
          fd.set('file', file)
          fd.set('category', CATEGORY_BY_MIME(file.type))
          await uploadMediaAction(fd)
        }
        setUploaded(true)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nahrávání selhalo')
      }
    })
  }

  const openDetail = (asset: AssetWithThumb) => {
    setSelected(asset)
    setAltText(asset.alt_text ?? '')
    setAltSaved(false)
    setUsage(null)
    startTransition(async () => {
      try {
        setUsage(await getMediaUsageAction(asset.id))
      } catch {
        setUsage([])
      }
    })
  }

  const saveAlt = () => {
    if (!selected) return
    startTransition(async () => {
      try {
        await updateMediaAltAction(selected.id, altText)
        setAltSaved(true)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Uložení selhalo')
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Filtry + upload */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto">
          {CATEGORY_FILTERS.map((c) => (
            <button
              key={c.label}
              onClick={() => setFilter(c.key)}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                filter === c.key
                  ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/20'
                  : 'text-white/40 border border-white/5 hover:bg-white/5'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {canEdit && (
          <div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a0e17] hover:bg-cyan-300 disabled:opacity-40 transition-all"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Nahrát soubor
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-400/5 border border-red-400/20 p-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {uploaded && !pending && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-400/5 border border-emerald-400/20 p-3 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Soubor byl nahrán.
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <ImageIcon className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Zatím tu nejsou žádná média.</p>
          <p className="text-xs mt-1">Nahrajte fotky nebo logo – použijete je v obsahu webu.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((a) => (
            <button
              key={a.id}
              onClick={() => openDetail(a)}
              className="group rounded-xl border border-white/5 bg-[#0d1525] overflow-hidden text-left hover:border-cyan-400/30 transition-colors"
            >
              {a.mime_type.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.thumb_url}
                  alt={a.alt_text ?? a.filename}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="aspect-square w-full flex items-center justify-center bg-white/[0.02]">
                  <FileText className="h-8 w-8 text-white/20" />
                </div>
              )}
              <div className="p-2.5">
                <p className="text-xs font-medium text-white truncate">{a.filename}</p>
                <p className="text-[10px] text-white/30 mt-0.5">
                  {new Date(a.created_at).toLocaleDateString('cs-CZ')}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1525] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{selected.filename}</h3>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selected.mime_type.startsWith('image/') && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.original_url}
                alt={selected.alt_text ?? ''}
                className="w-full max-h-72 rounded-xl border border-white/10 object-contain bg-[#0a0e17]"
              />
            )}

            <div>
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                Alternativní text (popis obrázku)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Např. Kuchyně na míru z dubového masivu"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-cyan-400/50 focus:outline-none transition-all"
                />
                <button
                  onClick={saveAlt}
                  disabled={pending || !canEdit}
                  className="shrink-0 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a0e17] hover:bg-cyan-300 disabled:opacity-40 transition-all"
                >
                  Uložit
                </button>
              </div>
              {altSaved && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Uloženo
                </p>
              )}
            </div>

            <div>
              <h4 className="flex items-center gap-2 text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                <Link2 className="h-3.5 w-3.5" /> Kde je použitý
              </h4>
              {usage === null ? (
                <p className="text-xs text-white/30">Načítám…</p>
              ) : usage.length === 0 ? (
                <p className="text-xs text-white/30">Zatím není nikde použitý.</p>
              ) : (
                <div className="space-y-1.5">
                  {usage.map((u, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2"
                    >
                      <span className="text-xs text-white/70">{u.label || u.field_key}</span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          u.location === 'published' ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {u.location === 'published' ? 'Na webu' : 'V návrhu'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
