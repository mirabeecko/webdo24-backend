'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface BillingData {
  customerId: string | null
  stripeCustomerId: string | null
  hasActiveHosting: boolean
  hasActiveMaintenance: boolean
  hostingEndDate: string | null
  maintenanceEndDate: string | null
  daysUntilHostingExpiry: number | null
  daysUntilMaintenanceExpiry: number | null
  hostingProduct: string | null
}

export async function getBillingData(): Promise<BillingData> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      customerId: null,
      stripeCustomerId: null,
      hasActiveHosting: false,
      hasActiveMaintenance: false,
      hostingEndDate: null,
      maintenanceEndDate: null,
      daysUntilHostingExpiry: null,
      daysUntilMaintenanceExpiry: null,
      hostingProduct: null,
    }
  }

  const { data: customer } = await supabase
    .from('webdo24_customers')
    .select('id, stripe_customer_id, subscription_status, current_period_end')
    .eq('user_id', user.id)
    .single()

  if (!customer) {
    return {
      customerId: null,
      stripeCustomerId: null,
      hasActiveHosting: false,
      hasActiveMaintenance: false,
      hostingEndDate: null,
      maintenanceEndDate: null,
      daysUntilHostingExpiry: null,
      daysUntilMaintenanceExpiry: null,
      hostingProduct: null,
    }
  }

  const admin = createAdminClient()

  // Get hosting subscription
  const { data: hostingSubs } = await admin
    .from('webdo24_hosting_subscriptions')
    .select('*')
    .eq('stripe_customer_id', customer.stripe_customer_id)
    .order('created_at', { ascending: false })
    .limit(2)

  let hasActiveHosting = false
  let hasActiveMaintenance = false
  let hostingEndDate: string | null = null
  let maintenanceEndDate: string | null = null
  let hostingProduct: string | null = null

  if (hostingSubs && hostingSubs.length > 0) {
    for (const sub of hostingSubs as any[]) {
      if (sub.status === 'active' || sub.status === 'trialing') {
        if (sub.product === 'hosting' || sub.product === 'bundle') {
          hasActiveHosting = true
          if (sub.current_period_end) {
            hostingEndDate = sub.current_period_end
          }
          hostingProduct = sub.product
        }
        if (sub.product === 'maintenance' || sub.product === 'bundle') {
          hasActiveMaintenance = true
          if (sub.current_period_end) {
            maintenanceEndDate = sub.current_period_end
          }
        }
      }
    }
  }

  const now = new Date()
  const daysUntilHostingExpiry = hostingEndDate
    ? Math.ceil((new Date(hostingEndDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    : null

  const daysUntilMaintenanceExpiry = maintenanceEndDate
    ? Math.ceil((new Date(maintenanceEndDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    : null

  return {
    customerId: customer.id,
    stripeCustomerId: customer.stripe_customer_id,
    hasActiveHosting,
    hasActiveMaintenance,
    hostingEndDate,
    maintenanceEndDate,
    daysUntilHostingExpiry,
    daysUntilMaintenanceExpiry,
    hostingProduct,
  }
}
