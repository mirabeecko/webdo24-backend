'use client'

// ContentEditor (§29): výběr stránky → sekce → pole Registry.
// Editace sbírá změny do lokálního stavu, „Uložit jako návrh" vytvoří
// ChangeSet (source 'gui') – žádný přímý zápis do produkce (§22).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Save, Loader2, AlertCircle, CheckCircle2, Image as ImageIcon,
  Plus, Trash2, X, FileText,
} from 'lucide-react'
import ChangeSetPanel from '@/components/ccc/ChangeSetPanel'
import {
  getPageContentAction,
  createChangeSetAction,
  getChangeSetAction,
} from '@/lib/actions/ccc'
import type {
  ChangeSet,
  ChangeSetWithItems,
  ContentFieldWithValue,
  Page,
} from '@/types/website-contract'
import type { MediaAsset } from '@/types/website-contract'

export type AssetWithThumb = MediaAsset & { thumb_url: string }

const OPEN_STATUSES = ['draft', 'validated', 'preview_ready', 'approved', 'publish_failed']

const STATUS_LABELS: Record<string, string> = {
  draft: 'Návrh',
  validated: 'Zkontrolováno',
  preview_ready: 'Náhled připraven',
  approved: 'Schváleno',
  publish_failed: 'Selhalo',
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// ── Vstupy dle field_type ─────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
  onPickMedia,
}: {
  field: ContentFieldWithValue
  value: unknown
  onChange: (v: unknown) => void
  onPickMedia: (fieldKey: string) => void
}) {
  const inputClass =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/10 transition-all'

  switch (field.field_type) {
    case 'textarea':
    case 'rich_text':
      return (
        <textarea
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={inputClass}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          className={inputClass}
        />
      )
    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 accent-cyan-400"
        />
      )
    case 'color':
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={typeof value === 'string' && value.startsWith('#') ? value : '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-14 rounded-lg border border-white/10 bg-white/5"
          />
          <input
            type="text"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className={inputClass}
          />
        </div>
      )
    case 'select': {
      const options = field.validation.options ?? []
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">— vyberte —</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    }
    case 'image':
    case 'logo': {
      const url = isRecord(value) && typeof value.url === 'string' ? value.url : null
      return (
        <div className="flex items-center gap-3">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              className="h-16 w-16 rounded-lg border border-white/10 object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-lg border border-dashed border-white/10 flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-white/20" />
            </div>
          )}
          <button
            type="button"
            onClick={() => onPickMedia(field.field_key)}
            className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 px-3.5 py-2 text-sm font-medium text-cyan-400 hover:bg-cyan-400/10 transition-all"
          >
            Vybrat z médií
          </button>
        </div>
      )
    }
    case 'repeater': {
      const items = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
      const keys = items.length > 0 ? Object.keys(items[0]) : ['title', 'description']
      return (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/30">Položka {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, i) => i !== idx))}
                  className="p-1 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {keys.map((key) => (
                <input
                  key={key}
                  type="text"
                  value={typeof item[key] === 'string' ? (item[key] as string) : ''}
                  placeholder={key}
                  onChange={(e) =>
                    onChange(
                      items.map((it, i) =>
                        i === idx ? { ...it, [key]: e.target.value } : it,
                      ),
                    )
                  }
                  className={inputClass}
                />
              ))}
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange([...items, Object.fromEntries(keys.map((k) => [k, '']))])}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/10 transition-all"
          >
            <Plus className="h-3.5 w-3.5" /> Přidat položku
          </button>
        </div>
      )
    }
    default:
      return (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )
  }
}

// ── Hlavní komponenta ─────────────────────────────────────────────

export default function ContentEditor({
  pages,
  initialPageSlug,
  initialFields,
  openChangesets,
  assets,
  canEdit,
  canPublish,
}: {
  pages: Page[]
  initialPageSlug: string | null
  initialFields: ContentFieldWithValue[]
  openChangesets: ChangeSet[]
  assets: AssetWithThumb[]
  canEdit: boolean
  canPublish: boolean
}) {
  const router = useRouter()
  const [selectedPage, setSelectedPage] = useState(initialPageSlug)
  const [fields, setFields] = useState(initialFields)
  const [edits, setEdits] = useState<Record<string, unknown>>({})
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [activeChangeset, setActiveChangeset] = useState<ChangeSetWithItems | null>(null)
  const [mediaPickerFor, setMediaPickerFor] = useState<string | null>(null)

  const selectPage = (slug: string) => {
    setSelectedPage(slug)
    setEdits({})
    setSaved(false)
    startTransition(async () => {
      const result = await getPageContentAction(slug)
      setFields(result.fields)
    })
  }

  const fieldValue = (f: ContentFieldWithValue) =>
    f.field_key in edits ? edits[f.field_key] : f.published_value

  const changedKeys = Object.keys(edits).filter((key) => {
    const field = fields.find((f) => f.field_key === key)
    return field && JSON.stringify(edits[key]) !== JSON.stringify(field.published_value)
  })

  const saveDraft = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        const items = changedKeys.map((key) => ({ fieldKey: key, newValue: edits[key] }))
        const created = await createChangeSetAction(
          `Úprava obsahu – ${new Date().toLocaleDateString('cs-CZ')}`,
          items,
        )
        setEdits({})
        setSaved(true)
        const full = await getChangeSetAction(created.id)
        setActiveChangeset(full)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Uložení návrhu selhalo')
      }
    })
  }

  const openChangeset = (id: string) => {
    startTransition(async () => {
      const full = await getChangeSetAction(id)
      setActiveChangeset(full)
    })
  }

  const pickMedia = (asset: AssetWithThumb) => {
    if (!mediaPickerFor) return
    setEdits((prev) => ({
      ...prev,
      [mediaPickerFor]: {
        asset_id: asset.id,
        url: asset.original_url,
        alt: asset.alt_text ?? '',
      },
    }))
    setMediaPickerFor(null)
  }

  // seskupení polí dle section_key
  const sections = new Map<string, ContentFieldWithValue[]>()
  for (const f of fields) {
    const key = f.section_key ?? 'ostatní'
    if (!sections.has(key)) sections.set(key, [])
    sections.get(key)!.push(f)
  }

  const open = openChangesets.filter((c) => OPEN_STATUSES.includes(c.status))

  return (
    <div className="space-y-6">
      {/* Otevřené návrhy změn */}
      {open.length > 0 && (
        <section className="bg-[#0d1525] rounded-2xl border border-white/5 p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Rozpracované změny</h2>
          <div className="space-y-2">
            {open.map((c) => (
              <button
                key={c.id}
                onClick={() => openChangeset(c.id)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-left hover:bg-white/[0.04] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.title}</p>
                  <p className="text-xs text-white/40">
                    {new Date(c.created_at).toLocaleString('cs-CZ')}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-cyan-400/10 text-cyan-400 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {activeChangeset && (
        <ChangeSetPanel
          changeset={activeChangeset}
          canPublish={canPublish}
          onClose={() => setActiveChangeset(null)}
        />
      )}

      {/* Výběr stránky */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {pages.map((p) => (
          <button
            key={p.id}
            onClick={() => selectPage(p.slug)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              selectedPage === p.slug
                ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/20'
                : 'text-white/40 border border-white/5 hover:bg-white/5 hover:text-white/70'
            }`}
          >
            {p.title}
          </button>
        ))}
      </div>

      {/* Pole dle sekcí */}
      {fields.length === 0 && !pending ? (
        <div className="text-center py-12 text-white/30">
          <FileText className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Tato stránka zatím nemá žádná editovatelná pole.</p>
        </div>
      ) : (
        [...sections.entries()].map(([sectionKey, sectionFields]) => (
          <section
            key={sectionKey}
            className="bg-[#0d1525] rounded-2xl border border-white/5 p-5"
          >
            <h2 className="text-sm font-semibold text-white mb-4 capitalize">{sectionKey}</h2>
            <div className="space-y-4">
              {sectionFields.map((f) => (
                <div key={f.id}>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                    {f.label}
                  </label>
                  <FieldInput
                    field={f}
                    value={fieldValue(f)}
                    onChange={(v) => setEdits((prev) => ({ ...prev, [f.field_key]: v }))}
                    onPickMedia={setMediaPickerFor}
                  />
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {/* Uložit jako návrh */}
      {canEdit && fields.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={saveDraft}
            disabled={pending || changedKeys.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-[#0a0e17] hover:bg-cyan-300 disabled:opacity-40 transition-all"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Uložit jako návrh ({changedKeys.length})
          </button>
          {saved && !pending && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Návrh uložen
            </span>
          )}
          {error && (
            <span className="flex items-center gap-1.5 text-sm text-red-400">
              <AlertCircle className="h-4 w-4" /> {error}
            </span>
          )}
        </div>
      )}

      {/* Media picker modal */}
      {mediaPickerFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1525] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Vyberte obrázek z médií</h3>
              <button
                onClick={() => setMediaPickerFor(null)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {assets.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-8">
                Zatím nemáte žádná média. Nahrajte je v sekci Média.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {assets
                  .filter((a) => a.mime_type.startsWith('image/'))
                  .map((a) => (
                    <button
                      key={a.id}
                      onClick={() => pickMedia(a)}
                      className="group rounded-xl border border-white/5 overflow-hidden hover:border-cyan-400/40 transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.thumb_url}
                        alt={a.alt_text ?? a.filename}
                        className="aspect-square w-full object-cover"
                      />
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
