'use client'

// PreviewFrame (§6.3): iframe náhledu s přepínačem desktop/tablet/mobile
// (jen viewport šířka, žádná device emulace).

import { useState } from 'react'
import { Monitor, Tablet, Smartphone, ExternalLink } from 'lucide-react'

const VIEWPORTS = [
  { key: 'desktop', label: 'Počítač', width: 1280, icon: Monitor },
  { key: 'tablet', label: 'Tablet', width: 768, icon: Tablet },
  { key: 'mobile', label: 'Mobil', width: 390, icon: Smartphone },
] as const

export default function PreviewFrame({ url }: { url: string }) {
  const [viewport, setViewport] = useState<(typeof VIEWPORTS)[number]['key']>('desktop')
  const active = VIEWPORTS.find((v) => v.key === viewport) ?? VIEWPORTS[0]

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-1">
          {VIEWPORTS.map((v) => {
            const Icon = v.icon
            return (
              <button
                key={v.key}
                onClick={() => setViewport(v.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewport === v.key
                    ? 'bg-cyan-400/10 text-cyan-400'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {v.label}
              </button>
            )
          })}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-cyan-400 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Otevřít v novém panelu
        </a>
      </div>
      <div className="flex justify-center bg-[#0a0e17] p-4">
        <iframe
          src={url}
          style={{ width: active.width, maxWidth: '100%' }}
          className="h-[70vh] rounded-lg border border-white/10 bg-white transition-all"
          title="Náhled webu"
        />
      </div>
    </div>
  )
}
