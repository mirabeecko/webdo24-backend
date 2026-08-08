'use client'

// NotificationsList: poslední notifikace + označení přečteného (§37).

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, CheckCircle2 } from 'lucide-react'
import { markNotificationReadAction } from '@/lib/actions/ccc'
import type { Notification } from '@/types/website-contract'

export default function NotificationsList({
  notifications,
}: {
  notifications: Notification[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const markRead = (id: string, link: string | null) => {
    startTransition(async () => {
      try {
        await markNotificationReadAction(id)
        router.refresh()
        if (link) router.push(link)
      } catch {
        // notifikaci nepodařilo označit – nic se neděje
      }
    })
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-6 text-white/30">
        <Bell className="h-6 w-6 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Zatím žádné notifikace.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {notifications.map((n) => (
        <button
          key={n.id}
          onClick={() => markRead(n.id, n.link)}
          disabled={pending}
          className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
            n.read_at
              ? 'border-white/5 bg-white/[0.01] opacity-60'
              : 'border-cyan-400/20 bg-cyan-400/5 hover:bg-cyan-400/10'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-white">{n.title}</p>
            {n.read_at && <CheckCircle2 className="h-4 w-4 text-white/20 shrink-0" />}
          </div>
          {n.body && <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{n.body}</p>}
          <p className="text-[10px] text-white/25 mt-1">
            {new Date(n.created_at).toLocaleString('cs-CZ')}
          </p>
        </button>
      ))}
      <div className="text-center pt-1">
        <Link href="/historie" className="text-xs text-cyan-400 hover:underline">
          Zobrazit historii změn
        </Link>
      </div>
    </div>
  )
}
