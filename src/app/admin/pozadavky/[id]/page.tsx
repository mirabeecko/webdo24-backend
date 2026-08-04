export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import AdminChangeDetailClient from './AdminChangeDetailClient'

export default async function AdminChangeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: cr } = await admin
    .from('webdo24_change_requests')
    .select(`
      *,
      project:webdo24_projects(id, title, slug, production_url, customer:webdo24_customers(name, id))
    `)
    .eq('id', id)
    .single()

  if (!cr) notFound()

  const { data: auditLog } = await admin
    .from('webdo24_audit_log')
    .select('id, action, diff, created_at')
    .eq('entity_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  return <AdminChangeDetailClient cr={cr as any} auditLog={auditLog ?? []} />
}
