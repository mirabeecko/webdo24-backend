'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, CheckCircle2, ExternalLink } from 'lucide-react'
import { approveChangeRequest } from '@/lib/actions/changes'

interface Props {
  id: string
  rawInput: string
  previewUrl?: string | null
  onApprove?: () => void
}

export default function PreviewCard({ id, rawInput, previewUrl, onApprove }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleApprove() {
    startTransition(async () => {
      await approveChangeRequest(id)
      onApprove?.()
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-semibold text-amber-700">Náhled připraven ke schválení</span>
      </div>
      <p className="text-sm text-gray-700 line-clamp-2">{rawInput}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Zobrazit náhled
          </a>
        )}
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {isPending ? 'Schvaluji...' : 'Schválit a publikovat'}
        </button>
      </div>
    </div>
  )
}
