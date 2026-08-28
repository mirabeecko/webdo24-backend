import { cache } from 'react'
import { getCurrentUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MembershipRole } from '@/types/website-contract'

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

type CustomerRow = {
  id: string
  user_id: string | null
  name: string | null
  email: string | null
  phone: string | null
  company: string | null
  ico: string | null
  dic: string | null
  address: string | null
  telegram_phone: string | null
  telegram_connected: boolean | null
  telegram_chat_id: string | null
  has_pro_pack: boolean | null
  stripe_customer_id: string | null
  subscription_status: string | null
  current_period_end: string | null
  created_at: string
  webdo24_projects?: ProjectRow[] | null
}

type ProjectRow = {
  id: string
  title: string | null
  slug: string | null
  domain: string | null
  production_url: string | null
  status: string | null
  business_type: string | null
  location: string | null
  current_version_id: string | null
  stripe_customer_id: string | null
  sandbox_enabled: boolean | null
  sandbox_url: string | null
  custom_domain: string | null
  custom_domain_verified: boolean | null
  custom_domain_verification_token: string | null
  zone_id: string | null
  connector_version: string | null
  content_connected: boolean | null
  forms_connected: boolean | null
  tracking_connected: boolean | null
  framework: string | null
  site_id: string | null
  last_sync_at: string | null
  created_at: string
}

type MembershipRow = {
  customer_id: string
  role: MembershipRole
}

export interface AppCustomerContext {
  user: CurrentUser
  customer: CustomerRow
  project: ProjectRow | null
  role: MembershipRole
  isOwner: boolean
  canEdit: boolean
  canPublish: boolean
}

const ROLE_WEIGHT: Record<MembershipRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
}

function sortProjects(projects: ProjectRow[] | null | undefined) {
  return [...(projects ?? [])].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

function compareCandidates(a: AppCustomerContext, b: AppCustomerContext) {
  if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1

  const roleDiff = ROLE_WEIGHT[b.role] - ROLE_WEIGHT[a.role]
  if (roleDiff !== 0) return roleDiff

  const aProjectTs = a.project ? new Date(a.project.created_at).getTime() : 0
  const bProjectTs = b.project ? new Date(b.project.created_at).getTime() : 0
  if (aProjectTs !== bProjectTs) return bProjectTs - aProjectTs

  return new Date(b.customer.created_at).getTime() - new Date(a.customer.created_at).getTime()
}

export const getAppCustomerContext = cache(async (): Promise<AppCustomerContext | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  const admin = createAdminClient()
  const [{ data: ownerCustomers }, { data: memberships }] = await Promise.all([
    admin
      .from('webdo24_customers')
      .select(`
        id,
        user_id,
        name,
        email,
        phone,
        company,
        ico,
        dic,
        address,
        telegram_phone,
        telegram_connected,
        telegram_chat_id,
        has_pro_pack,
        stripe_customer_id,
        subscription_status,
        current_period_end,
        created_at,
        webdo24_projects(
          id,
          title,
          slug,
          domain,
          production_url,
          status,
          business_type,
          location,
          current_version_id,
          stripe_customer_id,
          sandbox_enabled,
          sandbox_url,
          custom_domain,
          custom_domain_verified,
          custom_domain_verification_token,
          zone_id,
          connector_version,
          content_connected,
          forms_connected,
          tracking_connected,
          framework,
          site_id,
          last_sync_at,
          created_at
        )
      `)
      .eq('user_id', user.id),
    admin
      .from('webdo24_customer_memberships')
      .select('customer_id, role')
      .eq('user_id', user.id),
  ])

  const ownerCustomerIds = new Set((ownerCustomers ?? []).map((customer) => customer.id as string))
  const membershipRows = ((memberships ?? []) as MembershipRow[])
  const membershipCustomerIds = membershipRows.map((membership) => membership.customer_id)
  const candidateCustomerIds = [...new Set([...ownerCustomerIds, ...membershipCustomerIds])]

  if (candidateCustomerIds.length === 0) return null

  const customerMap = new Map<string, CustomerRow>()
  for (const customer of (ownerCustomers ?? []) as unknown as CustomerRow[]) {
    customerMap.set(customer.id, {
      ...customer,
      webdo24_projects: sortProjects(customer.webdo24_projects),
    })
  }

  const missingCustomerIds = candidateCustomerIds.filter((id) => !customerMap.has(id))
  if (missingCustomerIds.length > 0) {
    const { data: extraCustomers } = await admin
      .from('webdo24_customers')
      .select(`
        id,
        user_id,
        name,
        email,
        phone,
        company,
        ico,
        dic,
        address,
        telegram_phone,
        telegram_connected,
        telegram_chat_id,
        has_pro_pack,
        stripe_customer_id,
        subscription_status,
        current_period_end,
        created_at,
        webdo24_projects(
          id,
          title,
          slug,
          domain,
          production_url,
          status,
          business_type,
          location,
          current_version_id,
          stripe_customer_id,
          sandbox_enabled,
          sandbox_url,
          custom_domain,
          custom_domain_verified,
          custom_domain_verification_token,
          zone_id,
          connector_version,
          content_connected,
          forms_connected,
          tracking_connected,
          framework,
          site_id,
          last_sync_at,
          created_at
        )
      `)
      .in('id', missingCustomerIds)

    for (const customer of (extraCustomers ?? []) as unknown as CustomerRow[]) {
      customerMap.set(customer.id, {
        ...customer,
        webdo24_projects: sortProjects(customer.webdo24_projects),
      })
    }
  }

  const membershipMap = new Map(membershipRows.map((membership) => [membership.customer_id, membership.role]))

  const candidates: AppCustomerContext[] = candidateCustomerIds
    .map((customerId) => {
      const customer = customerMap.get(customerId)
      if (!customer) return null

      const isOwner = ownerCustomerIds.has(customerId)
      const role = membershipMap.get(customerId) ?? (isOwner ? 'owner' : null)
      if (!role) return null

      return {
        user,
        customer,
        project: customer.webdo24_projects?.[0] ?? null,
        role,
        isOwner,
        canEdit: role === 'owner' || role === 'admin' || role === 'editor',
        canPublish: role === 'owner' || role === 'admin',
      } satisfies AppCustomerContext
    })
    .filter((candidate): candidate is AppCustomerContext => candidate !== null)
    .sort(compareCandidates)

  return candidates[0] ?? null
})

export async function requireAppCustomerContext(): Promise<AppCustomerContext> {
  const context = await getAppCustomerContext()
  if (!context) {
    throw new Error('Nepřihlášený uživatel nebo chybějící zákaznický účet')
  }

  return context
}
