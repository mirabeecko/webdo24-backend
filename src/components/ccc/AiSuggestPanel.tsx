'use client'

// AiSuggestPanel (§13, §14): „✨ AI" návrhy textů a obrázků.
// AI nikdy nepíše do produkce – [Použít návrh] jen přenese hodnotu do
// lokální editace pole, publikování řeší standardní ChangeSet flow.

import { useState, useTransition } from 'react'
import {
  Sparkles, Loader2, AlertCircle, X, Check, Trash2, Wand2,
} from 'lucide-react'
import {
  aiSuggestAction,
  aiGenerateImageAction,
  aiAcceptAction,
} from '@/lib/actions/ccc'
import type { AiTextMode } from '@/lib/ccc/ai'
import type { FieldType, MediaAsset } from '@/types/website-contract'

const TEXT_MODES: Array<{ key: AiTextMode; label: string }> = [
  { key: 'improve', label: 'Vylepšit' },
  { key: 'shorten', label: 'Zkrátit' },
  { key: 'expand', label: 'Rozšířit' },
  { key: 'professional', label: 'Profesionálnější' },
  { key: 'sales', label: 'Prodejní' },
  { key: 'simple', label: 'Jednodušší' },
  { key: 'seo', label: 'SEO' },
  { key: 'custom', label: 'Vlastní instrukce' },
]

export default function AiSuggestPanel({
  fieldKey,
  fieldType,
  fieldLabel,
  currentValue,
  onUse,
  onClose,
}: {
  fieldKey: string
  fieldType: FieldType
  fieldLabel: string
  /** text: aktuální text; image: '' (aktuální obrázek řeší editor) */
  currentValue: string
  /** text: string; image: {asset_id, url, alt} */
  onUse: (value: unknown) => void
  onClose: () => void
}) {
  const isImage = fieldType === 'image' || fieldType === 'logo'
  const [mode, setMode] = useState<AiTextMode>('improve')
  const [customInstruction, setCustomInstruction] = useState('')
  const [prompt, setPrompt] = useState('')
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [asset, setAsset] = useState<MediaAsset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const suggestText = () => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await aiSuggestAction({
          fieldKey,
          fieldType,
          currentValue,
          mode,
          customInstruction: mode === 'custom' ? customInstruction : undefined,
        })
        setSuggestion(result.suggestion)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'AI asistent není momentálně dostupný')
      }
    })
  }

  const generateImage = () => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await aiGenerateImageAction(prompt, fieldKey)
        setAsset(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'AI asistent není momentálně dostupný')
      }
    })
  }

  const useTextSuggestion = () => {
    if (suggestion === null) return
    onUse(suggestion)
    aiAcceptAction(fieldKey, 'text').catch(() => {})
    onClose()
  }

  const useImageAsset = () => {
    if (!asset) return
    onUse({ asset_id: asset.id, url: asset.original_url, alt: asset.alt_text ?? '' })
    aiAcceptAction(fieldKey, 'image').catch(() => {})
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1525] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            AI asistent – {fieldLabel}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!isImage ? (
          <>
            {/* Volba režimu */}
            <div className="flex flex-wrap gap-2">
              {TEXT_MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    mode === m.key
                      ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/20'
                      : 'text-white/40 border border-white/5 hover:bg-white/5'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {mode === 'custom' && (
              <input
                type="text"
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="Např. Přidej zmínku o záruce 5 let"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-cyan-400/50 focus:outline-none transition-all"
              />
            )}

            {!suggestion && (
              <button
                onClick={suggestText}
                disabled={pending || (mode === 'custom' && !customInstruction.trim())}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a0e17] hover:bg-cyan-300 disabled:opacity-40 transition-all"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {pending ? 'AI přemýšlí…' : 'Navrhnout'}
              </button>
            )}

            {/* Diff: Původní | Navrhovaný */}
            {suggestion !== null && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-red-400/5 border border-red-400/10 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-red-400/60 mb-1">Původní</p>
                    <p className="text-white/70 whitespace-pre-wrap">{currentValue || '— prázdné —'}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-400/5 border border-emerald-400/10 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-400/60 mb-1">Navrhovaný</p>
                    <p className="text-white/90 whitespace-pre-wrap">{suggestion}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={useTextSuggestion}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a0e17] hover:bg-cyan-300 transition-all"
                  >
                    <Check className="h-4 w-4" /> Použít návrh
                  </button>
                  <button
                    onClick={() => setSuggestion(null)}
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-40 transition-all"
                  >
                    <Wand2 className="h-4 w-4" /> Zkusit znovu
                  </button>
                  <button
                    onClick={onClose}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-400/10 transition-all"
                  >
                    <Trash2 className="h-4 w-4" /> Zahodit
                  </button>
                </div>
                <p className="text-xs text-white/30">
                  Návrh se použije až po „Uložit jako návrh“ a publikování.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* AI obrázek */}
            {!asset && (
              <div className="space-y-3">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder="Popište obrázek, např.: Moderní kuchyň z dubového masivu, denní světlo, fotorealisticky"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-cyan-400/50 focus:outline-none transition-all"
                />
                <button
                  onClick={generateImage}
                  disabled={pending || !prompt.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a0e17] hover:bg-cyan-300 disabled:opacity-40 transition-all"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {pending ? 'Generuji obrázek…' : 'Vygenerovat obrázek'}
                </button>
              </div>
            )}

            {asset && (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.original_url}
                  alt={asset.alt_text ?? ''}
                  className="w-full max-h-64 rounded-xl border border-white/10 object-contain bg-[#0a0e17]"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={useImageAsset}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a0e17] hover:bg-cyan-300 transition-all"
                  >
                    <Check className="h-4 w-4" /> Použít obrázek
                  </button>
                  <button
                    onClick={() => setAsset(null)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 transition-all"
                  >
                    <Wand2 className="h-4 w-4" /> Vygenerovat jiný
                  </button>
                  <button
                    onClick={onClose}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-400/10 transition-all"
                  >
                    <Trash2 className="h-4 w-4" /> Zahodit
                  </button>
                </div>
                <p className="text-xs text-white/30">
                  Obrázek je uložený v knihovně médií. Na webu se objeví až po publikování návrhu.
                </p>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-400/5 border border-red-400/20 p-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
      </div>
    </div>
  )
}
