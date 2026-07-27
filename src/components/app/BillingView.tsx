'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { BillingData } from '@/lib/actions/billing'

interface Props {
  billing: BillingData
  stripeCustomerId: string | null
  userEmail: string
}

const PRICES = {
  hosting: { amount: '2 490 Kč', label: 'Hosting — roční' },
  maintenance: { amount: '4 900 Kč', label: 'Maintenance — roční' },
  bundle: { amount: '7 390 Kč', label: 'Hosting + Maintenance — roční' },
}

function StatusBadge({ active, daysLeft }: { active: boolean; daysLeft: number | null }) {
  if (!active && daysLeft !== null && daysLeft <= 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
        Vypršel
      </span>
    )
  }
  if (!active) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
        Neaktivní
      </span>
    )
  }
  if (daysLeft !== null && daysLeft <= 30) {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
        Končí za {daysLeft} dní
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
      Aktivní
    </span>
  )
}

export default function BillingView({ billing, stripeCustomerId, userEmail }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleBuy(product: 'hosting' | 'maintenance' | 'bundle') {
    setLoading(product)
    setError(null)

    try {
      const res = await fetch('/api/stripe/create-hosting-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product,
          customer_email: userEmail,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se vytvořit platební session')
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('Chybí URL platební brány')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nastala neočekávaná chyba')
      setLoading(null)
    }
  }

  async function handlePortal() {
    if (!stripeCustomerId) return

    setLoading('portal')
    setError(null)

    try {
      const res = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripe_customer_id: stripeCustomerId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se otevřít zákaznický portál')
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nastala neočekávaná chyba')
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Hosting Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#0F172A]">Hosting</h2>
            <p className="mt-1 text-sm text-gray-500">
              Garance 99.9% dostupnosti, SSL certifikát, denní zálohy, technická podpora.
            </p>
          </div>
          <StatusBadge
            active={billing.hasActiveHosting}
            daysLeft={billing.daysUntilHostingExpiry}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-2xl font-bold text-[#0F172A]">2 490 Kč</span>
          <span className="text-sm text-gray-500">/ rok</span>
        </div>

        {billing.hasActiveHosting && billing.hostingEndDate && (
          <p className="mt-2 text-sm text-gray-500">
            Platnost do:{' '}
            <strong>{new Date(billing.hostingEndDate).toLocaleDateString('cs-CZ')}</strong>
            {billing.daysUntilHostingExpiry !== null && billing.daysUntilHostingExpiry > 0 && (
              <span className="ml-1">({billing.daysUntilHostingExpiry} dní)</span>
            )}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {!billing.hasActiveHosting ? (
            <button
              onClick={() => handleBuy('hosting')}
              disabled={loading === 'hosting'}
              className="inline-flex items-center rounded-lg bg-[#0F172A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1E293B] disabled:opacity-50 transition-colors"
            >
              {loading === 'hosting' ? 'Přesměrovávám...' : 'Objednat hosting'}
            </button>
          ) : (
            <button
              onClick={() => handleBuy('hosting')}
              disabled={loading === 'hosting'}
              className="inline-flex items-center rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loading === 'hosting' ? 'Přesměrovávám...' : 'Prodloužit hosting'}
            </button>
          )}

          {stripeCustomerId && (
            <button
              onClick={handlePortal}
              disabled={loading === 'portal'}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {loading === 'portal' ? 'Otevírám...' : 'Spravovat platby'}
            </button>
          )}
        </div>
      </div>

      {/* Maintenance Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#0F172A]">Maintenance</h2>
            <p className="mt-1 text-sm text-gray-500">
              Průběžné úpravy textů, aktualizace systému, technická podpora — balíček na celý rok.
            </p>
          </div>
          <StatusBadge
            active={billing.hasActiveMaintenance}
            daysLeft={billing.daysUntilMaintenanceExpiry}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-2xl font-bold text-[#0F172A]">4 900 Kč</span>
          <span className="text-sm text-gray-500">/ rok</span>
          {billing.daysUntilMaintenanceExpiry !== null && billing.daysUntilMaintenanceExpiry > 0 && (
            <span className="text-xs text-gray-400 ml-2">
              Platnost do{' '}
              {billing.maintenanceEndDate
                ? new Date(billing.maintenanceEndDate).toLocaleDateString('cs-CZ')
                : '—'}
              {' '}({billing.daysUntilMaintenanceExpiry} dní)
            </span>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {!billing.hasActiveMaintenance ? (
            <button
              onClick={() => handleBuy('maintenance')}
              disabled={loading === 'maintenance'}
              className="inline-flex items-center rounded-lg bg-[#0F172A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1E293B] disabled:opacity-50 transition-colors"
            >
              {loading === 'maintenance' ? 'Přesměrovávám...' : 'Objednat maintenance'}
            </button>
          ) : (
            <button
              onClick={() => handleBuy('maintenance')}
              disabled={loading === 'maintenance'}
              className="inline-flex items-center rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loading === 'maintenance' ? 'Přesměrovávám...' : 'Prodloužit maintenance'}
            </button>
          )}
        </div>
      </div>

      {/* Bundle Card */}
      <div className="rounded-xl border-2 border-[#0F172A] bg-gradient-to-br from-[#0F172A]/5 to-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center rounded-full bg-[#0F172A] px-2.5 py-0.5 text-xs font-semibold text-white">
            DOPORUČUJEME
          </span>
        </div>
        <h2 className="text-lg font-semibold text-[#0F172A]">Hosting + Maintenance</h2>
        <p className="mt-1 text-sm text-gray-500">
          Kompletní balíček — hosting i průběžná podpora v jednom. Ušetříte oproti samostatné koupi.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-2xl font-bold text-[#0F172A]">7 390 Kč</span>
          <span className="text-sm text-gray-500">/ rok</span>
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            Ušetříte 0 Kč
          </span>
        </div>

        <div className="mt-5">
          <button
            onClick={() => handleBuy('bundle')}
            disabled={loading === 'bundle'}
            className="inline-flex items-center rounded-lg bg-[#0F172A] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#1E293B] disabled:opacity-50 transition-colors"
          >
            {loading === 'bundle' ? 'Přesměrovávám...' : 'Objednat kompletní balíček'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700 border border-blue-200">
        <strong>ℹ️ Informace o platbách:</strong> Platby zpracovává Stripe. Po zaplacení se
        služba automaticky aktivuje. Fakturu obdržíte emailem. Správu předplatného najdete v{' '}
        <button onClick={handlePortal} className="underline font-medium hover:text-blue-800">
          zákaznickém portálu Stripe
        </button>
        .
      </div>
    </div>
  )
}
