'use client'

// BrandingForm (§10): centrální branding – loga, favicon, barvy.
// Změny NEjdou přímo do DB – „Uložit jako návrh" vytvoří ChangeSet
// s itemy branding.* a dál platí stejný flow náhled → publikování (§22).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Save, Loader2, AlertCircle, Image as ImageIcon, X, Lightbulb,
} from 'lucide-react'
import ChangeSetPanel from '@/components/ccc/ChangeSetPanel'
import { createChangeSetAction, getChangeSetAction } from '@/lib/actions/ccc'
import type { AssetWithThumb } from '@/components/ccc/ContentEditor'
import type { BrandProfile, ChangeSetWithItems } from '@/types/website-contract'

type LogoSlot = {
  key: 'logo_asset_id' | 'logo_light_asset_id' | 'logo_dark_asset_id' | 'favicon_asset_id'
  label: string
  hint: string
}

const LOGO_SLOTS: LogoSlot[] = [
  { key: 'logo_asset_id', label: 'Hlavní logo', hint: 'Zobrazí se v hlavičce webu' },
  { key: 'logo_light_asset_id', label: 'Světlá varianta loga', hint: 'Pro tmavé pozadí' },
  { key: 'logo_dark_asset_id', label: 'Tmavá varianta loga', hint: 'Pro světlé pozadí' },
  { key: 'favicon_asset_id', label: 'Favicon', hint: 'Ikona v záložce prohlížeče' },
]

export default function BrandingForm({
  brandProfile,
  assets,
  canEdit,
  canPublish,
}: {
  brandProfile: BrandProfile | null
  assets: AssetWithThumb[]
  canEdit: boolean
  canPublish: boolean
}) {
  const router = useRouter()
  const [logos, setLogos] = useState<Record<string, string | null>>({
    logo_asset_id: brandProfile?.logo_asset_id ?? null,
    logo_light_asset_id: brandProfile?.logo_light_asset_id ?? null,
    logo_dark_asset_id: brandProfile?.logo_dark_asset_id ?? null,
    favicon_asset_id: brandProfile?.favicon_asset_id ?? null,
  })
  const [primaryColor, setPrimaryColor] = useState(brandProfile?.primary_color ?? '')
  const [secondaryColor, setSecondaryColor] = useState(brandProfile?.secondary_color ?? '')
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [changeset, setChangeset] = useState<ChangeSetWithItems | null>(null)

  const assetUrl = (id: string | null) =>
    id ? (assets.find((a) => a.id === id)?.original_url ?? null) : null

  const changedItems = (): Array<{ fieldKey: string; newValue: unknown }> => {
    const items: Array<{ fieldKey: string; newValue: unknown }> = []
    for (const slot of LOGO_SLOTS) {
      const current = brandProfile?.[slot.key] ?? null
      if (logos[slot.key] !== current && logos[slot.key]) {
        const asset = assets.find((a) => a.id === logos[slot.key])
        items.push({
          fieldKey: `branding.${slot.key}`,
          newValue: {
            asset_id: logos[slot.key],
            url: asset?.original_url ?? '',
            alt: asset?.alt_text ?? slot.label,
          },
        })
      }
    }
    if (primaryColor !== (brandProfile?.primary_color ?? '') && primaryColor) {
      items.push({ fieldKey: 'branding.primary_color', newValue: primaryColor })
    }
    if (secondaryColor !== (brandProfile?.secondary_color ?? '') && secondaryColor) {
      items.push({ fieldKey: 'branding.secondary_color', newValue: secondaryColor })
    }
    return items
  }

  const save = () => {
    setError(null)
    const items = changedItems()
    if (items.length === 0) return
    startTransition(async () => {
      try {
        const created = await createChangeSetAction(
          `Vzhled značky – ${new Date().toLocaleDateString('cs-CZ')}`,
          items,
        )
        setChangeset(await getChangeSetAction(created.id))
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Uložení návrhu selhalo')
      }
    })
  }

  const images = assets.filter((a) => a.mime_type.startsWith('image/'))
  const changes = changedItems()

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
        <Lightbulb className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
        <p className="text-sm text-white/60">
          Změny vzhledu se na webu projeví až po publikování návrhu. Doporučujeme logo
          ve formátu PNG nebo WebP s průhledným pozadím.
        </p>
      </div>

      {changeset ? (
        <ChangeSetPanel
          changeset={changeset}
          canPublish={canPublish}
          onClose={() => setChangeset(null)}
        />
      ) : (
        <>
          {/* Loga */}
          <section className="bg-[#0d1525] rounded-2xl border border-white/5 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Logo</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {LOGO_SLOTS.map((slot) => {
                const url = assetUrl(logos[slot.key])
                return (
                  <div key={slot.key} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => canEdit && setPickerFor(slot.key)}
                      className="w-full aspect-square rounded-xl border border-dashed border-white/10 bg-white/[0.02] flex items-center justify-center overflow-hidden hover:border-cyan-400/40 transition-colors"
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={slot.label} className="max-h-full max-w-full object-contain p-3" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-white/20" />
                      )}
                    </button>
                    <div>
                      <p className="text-xs font-medium text-white">{slot.label}</p>
                      <p className="text-[10px] text-white/30">{slot.hint}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Barvy */}
          <section className="bg-[#0d1525] rounded-2xl border border-white/5 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Barvy značky</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(
                [
                  ['Hlavní barva', primaryColor, setPrimaryColor],
                  ['Doplňková barva', secondaryColor, setSecondaryColor],
                ] as const
              ).map(([label, value, setter]) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                    {label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={value.startsWith('#') ? value : '#0ea5e9'}
                      onChange={(e) => setter(e.target.value)}
                      className="h-10 w-14 rounded-lg border border-white/10 bg-white/5"
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      placeholder="#0ea5e9"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-cyan-400/50 focus:outline-none transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-400/5 border border-red-400/20 p-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {canEdit && (
            <button
              onClick={save}
              disabled={pending || changes.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-[#0a0e17] hover:bg-cyan-300 disabled:opacity-40 transition-all"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Uložit jako návrh ({changes.length})
            </button>
          )}
        </>
      )}

      {/* Media picker modal */}
      {pickerFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1525] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Vyberte obrázek z médií</h3>
              <button
                onClick={() => setPickerFor(null)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {images.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-8">
                Zatím nemáte žádné obrázky. Nahrajte je v sekci Média.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {images.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setLogos((prev) => ({ ...prev, [pickerFor]: a.id }))
                      setPickerFor(null)
                    }}
                    className="rounded-xl border border-white/5 overflow-hidden hover:border-cyan-400/40 transition-colors"
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
