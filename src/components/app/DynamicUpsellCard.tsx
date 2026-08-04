'use client'

import { useState } from 'react'
import { Zap, ArrowRight, Loader2, X } from 'lucide-react'
import { trackUpsellEvent } from '@/lib/actions/upsell'
import type { UpsellTip } from '@/lib/actions/upsell'

interface Props {
  tip: UpsellTip
  customerEmail?: string
  projectId?: string
}

export default function DynamicUpsellCard({ tip, customerEmail, projectId }: Props) {
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const handleDismiss = async () => {
    setDismissed(true)
    await trackUpsellEvent({ productId: tip.product.id, eventType: 'dismiss', triggerReason: tip.triggerKey })
  }

  const handleBuy = async () => {
    setLoading(true)
    await trackUpsellEvent({ productId: tip.product.id, eventType: 'click', triggerReason: tip.triggerKey })
    try {
      const res = await fetch('/api/stripe/create-upsell-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_email: customerEmail, project_id: projectId, product_id: tip.product.id }),
      })
      const data = await res.json()
      if (data.url) {
        await trackUpsellEvent({ productId: tip.product.id, eventType: 'convert', triggerReason: tip.triggerKey })
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

  const price = tip.product.billing_type === 'monthly'
    ? `${(tip.product.price_cents / 100).toLocaleString('cs-CZ')} Kč / měs`
    : `${(tip.product.price_cents / 100).toLocaleString('cs-CZ')} Kč`

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 shadow-sm">
      <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-amber-200/40 blur-2xl" />

      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 h-7 w-7 rounded-full bg-amber-100 hover:bg-amber-200 flex items-center justify-center transition-colors"
        aria-label="Zavřít"
      >
        <X className="h-3.5 w-3.5 text-amber-600" />
      </button>

      <div className="relative p-5">
        <div className="flex items-start gap-3 mb-3 pr-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm shrink-0">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-[#0F172A] text-sm">{tip.product.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{tip.reason}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="text-xl font-bold text-[#0F172A]">{price}</div>
        </div>

        <button
          onClick={handleBuy}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition-all shadow-sm"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Připravuji platbu…</>
          ) : (
            <>Chci to<ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </div>
    </div>
  )
}
