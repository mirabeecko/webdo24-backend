'use client'

import { useState } from 'react'
import {
  Zap,
  Check,
  ArrowRight,
  Loader2,
  Flame,
  Shield,
  MessageCircle,
  Download,
  Sparkles,
} from 'lucide-react'

const features = [
  'Pokročilé sekce webu (FAQ, Tým, Portfolio)',
  'A/B testování nadpisů a CTA tlačítek',
  'Automatické email odpovědi na leady',
  'WhatsApp notifikace o nových poptávkách',
  'Export leadů do CSV / Excel',
  '30 dní prioritní podpory',
]

interface UpsellCardProps {
  customerEmail?: string
  projectId?: string
}

export default function UpsellCard({ customerEmail, projectId }: UpsellCardProps) {
  const [loading, setLoading] = useState(false)

  const handleBuy = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/create-upsell-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_email: customerEmail,
          project_id: projectId,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'Chyba při vytváření platby')
        setLoading(false)
      }
    } catch {
      alert('Chyba při komunikaci se serverem')
      setLoading(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 shadow-sm">
      {/* Decorative spark */}
      <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-amber-200/40 blur-2xl" />
      <div className="absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-orange-200/40 blur-2xl" />

      <div className="relative p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm shrink-0">
            <Flame className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-[#0F172A]">Conversion Pro Pack</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Jednorázový upgrade pro víc leadů
            </p>
          </div>
        </div>

        <ul className="space-y-2 mb-5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-xs text-gray-400 line-through">1 490 Kč</div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[#0F172A]">900 Kč</span>
              <span className="text-sm text-gray-500">jednorázově</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
            <Sparkles className="h-3 w-3" />
            Ušetříte 590 Kč
          </div>
        </div>

        <button
          onClick={handleBuy}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0F172A] px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition-all shadow-sm"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Připravuji platbu...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Chci víc leadů
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
