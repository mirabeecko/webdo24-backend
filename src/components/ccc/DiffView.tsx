'use client'

// DiffView (§16): pole, původní → nová hodnota; u obrázků OLD→NEW náhledy.

import type { ChangeSetItemWithField } from '@/types/website-contract'

function isImageValue(v: unknown): v is { url?: string; asset_id?: string; alt?: string } {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && 'url' in v
}

function ValuePreview({ value, isImage }: { value: unknown; isImage: boolean }) {
  if (value === null || value === undefined) {
    return <span className="text-white/25 italic">prázdné</span>
  }
  if (isImage && isImageValue(value) && typeof value.url === 'string' && value.url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={value.url}
        alt={value.alt ?? ''}
        className="max-h-24 rounded-lg border border-white/10 object-cover"
      />
    )
  }
  if (Array.isArray(value)) {
    return (
      <span className="text-white/70">
        {value.length} {value.length === 1 ? 'položka' : value.length < 5 ? 'položky' : 'položek'}
      </span>
    )
  }
  if (typeof value === 'object') {
    return <code className="text-xs text-white/50 break-all">{JSON.stringify(value)}</code>
  }
  return <span className="text-white/80 whitespace-pre-wrap">{String(value)}</span>
}

export default function DiffView({ items }: { items: ChangeSetItemWithField[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-white/40">ChangeSet neobsahuje žádné změny.</p>
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isImage = ['image', 'logo', 'gallery'].includes(item.field_type)
        return (
          <div
            key={item.id}
            className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
          >
            <p className="text-sm font-medium text-white mb-2">{item.field_label}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-red-400/5 border border-red-400/10 p-3">
                <p className="text-[10px] uppercase tracking-wider text-red-400/60 mb-1">
                  Původní
                </p>
                <ValuePreview value={item.old_value} isImage={isImage} />
              </div>
              <div className="rounded-lg bg-emerald-400/5 border border-emerald-400/10 p-3">
                <p className="text-[10px] uppercase tracking-wider text-emerald-400/60 mb-1">
                  Nová
                </p>
                <ValuePreview value={item.new_value} isImage={isImage} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
