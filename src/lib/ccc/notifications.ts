// ============================================
// CCC – Notifications  (architektura §3.6, §37)
//
// Čtení notifikací zákazníka + označení přečteného. Tvorba notifikací
// je interní (publish.ts, service role) – zákazník je jen čte a označuje.
// ============================================

import { createAdminClient } from '@/lib/supabase/admin'
import { GuardError, requireCapability } from '@/lib/ccc/guard'
import type { Notification } from '@/types/website-contract'

export async function listNotifications(
  customerId: string,
  limit = 20,
): Promise<Notification[]> {
  await requireCapability(customerId, 'view')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('webdo24_notifications')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data as Notification[]
}

export async function markNotificationRead(
  notificationId: string,
): Promise<{ ok: true }> {
  const admin = createAdminClient()
  const { data: notification, error } = await admin
    .from('webdo24_notifications')
    .select('id, customer_id, read_at')
    .eq('id', notificationId)
    .maybeSingle()

  if (error || !notification) throw new GuardError('not_found', 'Notifikace nenalezena')
  await requireCapability(notification.customer_id as string, 'view')

  if (!notification.read_at) {
    const { error: updateError } = await admin
      .from('webdo24_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
    if (updateError) throw new Error(`mark_read_failed: ${updateError.message}`)
  }

  return { ok: true }
}
