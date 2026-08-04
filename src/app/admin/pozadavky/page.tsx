export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import type { ChangeStatus, ChangeCategory } from '@/types'

const STATUS_LABEL: Record<ChangeStatus, string> = {
  new: 'Přijato',
  classifying: 'Klasifikujeme',
  planning: 'Plánujeme',
  executing: 'Pracujeme',
  preview_ready: 'Ke schválení',
  approved: 'Schváleno',
  publishing: 'Publikujeme',
  published: 'Hotovo',
  rejected: 'Zrušeno',
  failed: 'Chyba',
  escalated: 'V řešení',
}

const STATUS_COLOR: Record<ChangeStatus, string> = {
  new: 'bg-gray-100 text-gray-600',
  classifying: 'bg-blue-100 text-blue-700',
  planning: 'bg-blue-100 text-blue-700',
  executing: 'bg-indigo-100 text-indigo-700',
  preview_ready: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  publishing: 'bg-emerald-100 text-emerald-700',
  published: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-gray-100 text-gray-500',
  failed: 'bg-red-100 text-red-700',
  escalated: 'bg-orange-100 text-orange-700',
}

const CATEGORY_LABEL: Record<ChangeCategory, string> = {
  trivial: 'Drobná',
  content: 'Text',
  media: 'Media',
  structure: 'Sekce',
  design: 'Design',
  page: 'Stránka',
  heavy: 'Velká',
  unknown: '?',
}

export default async function AdminPozadavkyPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: filterStatus } = await searchParams
  const admin = createAdminClient()

  let query = admin
    .from('webdo24_change_requests')
    .select(`
      id, raw_input, category, confidence, status, created_at, error_message,
      project:webdo24_projects(id, title, slug, customer:webdo24_customers(name))
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (filterStatus && filterStatus !== 'all') {
    query = query.eq('status', filterStatus)
  }

  const { data: items } = await query

  const pendingCount = items?.filter(i => ['new', 'classifying', 'planning', 'executing'].includes(i.status)).length ?? 0
  const needsAttention = items?.filter(i => ['failed', 'escalated', 'preview_ready'].includes(i.status)).length ?? 0

  const FILTER_TABS = [
    { label: 'Vše', value: 'all' },
    { label: 'Aktivní', value: 'executing' },
    { label: 'Ke schválení', value: 'preview_ready' },
    { label: 'Chyby', value: 'failed' },
    { label: 'Hotové', value: 'published' },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Požadavky</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pendingCount > 0 && <span className="text-blue-600 font-medium">{pendingCount} zpracovává se · </span>}
            {needsAttention > 0 && <span className="text-amber-600 font-medium">{needsAttention} vyžaduje pozornost</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex gap-2 flex-wrap">
        {FILTER_TABS.map(tab => {
          const active = (filterStatus ?? 'all') === tab.value
          return (
            <Link
              key={tab.value}
              href={tab.value === 'all' ? '/admin/pozadavky' : `/admin/pozadavky?status=${tab.value}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {!items || items.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">Žádné požadavky.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Požadavek</th>
                <th className="px-4 py-3">Zákazník</th>
                <th className="px-4 py-3">Kategorie</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Vytvořeno</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(items as any[]).map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-gray-900 line-clamp-2 text-sm">{item.raw_input}</p>
                    {item.error_message && (
                      <p className="text-xs text-red-500 mt-0.5 line-clamp-1">{item.error_message}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-gray-700">{item.project?.customer?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{item.project?.slug ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {item.category ? CATEGORY_LABEL[item.category as ChangeCategory] : '?'}
                    </span>
                    {item.confidence != null && (
                      <span className="ml-1.5 text-xs text-gray-400">{Math.round(item.confidence * 100)}%</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[item.status as ChangeStatus]}`}>
                      {STATUS_LABEL[item.status as ChangeStatus] ?? item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/admin/pozadavky/${item.id}`}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Detail →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
