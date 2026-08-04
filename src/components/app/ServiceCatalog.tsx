'use client'

import { useState } from 'react'
import { Check, ArrowRight, Loader2 } from 'lucide-react'
import { trackUpsellEvent } from '@/lib/actions/upsell'
import type { Product } from '@/types'

interface Props {
  products: Product[]
  customerEmail?: string
  projectId?: string
}

export default function ServiceCatalog({ products, customerEmail, projectId }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleBuy = async (product: Product) => {
    setLoadingId(product.id)
    await trackUpsellEvent({ productId: product.id, eventType: 'click', context: 'service_catalog' })
    try {
      const res = await fetch('/api/stripe/create-upsell-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_email: customerEmail,
          project_id: projectId,
          product_id: product.id,
        }),
      })
      const data = await res.json()
      if (data.url) {
        await trackUpsellEvent({ productId: product.id, eventType: 'convert', context: 'service_catalog' })
        window.location.assign(data.url)
      } else {
        alert(data.error || 'Chyba při vytváření platby')
      }
    } catch {
      alert('Chyba při komunikaci se serverem')
    } finally {
      setLoadingId(null)
    }
  }

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
        <p className="text-gray-500">Momentálně nemáme žádné aktivní nabídky.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => {
        const benefits = Array.isArray(product.benefits) ? product.benefits : []
        const price = product.billing_type === 'monthly'
          ? `${(product.price_cents / 100).toLocaleString('cs-CZ')} Kč / měs`
          : product.billing_type === 'yearly'
          ? `${(product.price_cents / 100).toLocaleString('cs-CZ')} Kč / rok`
          : `${(product.price_cents / 100).toLocaleString('cs-CZ')} Kč`

        return (
          <div
            key={product.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col hover:shadow-md transition-shadow"
          >
            <div className="mb-4">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold uppercase tracking-wide">
                {product.category || 'Služba'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] mb-2">{product.name}</h3>
            <p className="text-sm text-gray-500 mb-4 flex-1">{product.short_description}</p>

            {benefits.length > 0 && (
              <ul className="space-y-2 mb-6">
                {benefits.slice(0, 4).map((benefit: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-auto">
              <div className="text-2xl font-bold text-[#0F172A] mb-4">{price}</div>
              <button
                onClick={() => handleBuy(product)}
                disabled={loadingId === product.id}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition-all"
              >
                {loadingId === product.id ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Připravuji…</>
                ) : (
                  <>Koupit<ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
