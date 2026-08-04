'use client'

import { useTransition } from 'react'
import { X, Sparkles, ArrowRight } from 'lucide-react'

interface Props {
  title: string
  description: string
  productKey: string
  cta: string
  customerEmail?: string
  projectId?: string
  onClose: () => void
}

export default function UpgradeOffer({ title, description, cta, customerEmail, projectId, onClose }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleUpgrade() {
    startTransition(async () => {
      const res = await fetch('/api/stripe/create-upsell-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_email: customerEmail,
          project_id: projectId,
        }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="h-12 w-12 rounded-2xl bg-[#0F172A] flex items-center justify-center mb-5">
          <Sparkles className="h-6 w-6 text-white" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Dostupné v PRO</p>
        <h2 className="text-xl font-bold text-[#0F172A] mb-3">{title}</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-7">{description}</p>

        <button
          onClick={handleUpgrade}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#0F172A] text-white px-6 py-3.5 text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 mb-3 shadow-sm"
        >
          {isPending ? 'Připravuji...' : cta}
          {!isPending && <ArrowRight className="h-4 w-4" />}
        </button>

        <button
          onClick={onClose}
          className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
        >
          Možná příště
        </button>
      </div>
    </div>
  )
}
