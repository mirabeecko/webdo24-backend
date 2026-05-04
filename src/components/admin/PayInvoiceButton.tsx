'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PayInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handlePay = async () => {
    setLoading(true)
    const res = await fetch(`/api/invoices/${invoiceId}/pay`, {
      method: 'POST',
    })
    setLoading(false)

    if (res.ok) {
      router.refresh()
    } else {
      alert('Chyba při označování faktury')
    }
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
    >
      {loading ? '...' : 'Zaplatit'}
    </button>
  )
}
