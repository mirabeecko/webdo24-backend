// ============================================
// CCC – Tenant guard + RBAC  (architektura §3.7, §8.3)
//
// Plain async funkce (NE 'use server' soubor) – importují je doménové
// služby v src/lib/ccc/ a tenké server actions. Vynucuje RBAC serverově,
// ne v UI. Role z webdo24_customer_memberships; webdo24 admin z
// user_metadata.role = 'admin' (stejně jako is_admin() v DB).
// ============================================

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cache } from 'react'
import type { CustomerMembership, MembershipRole } from '@/types/website-contract'

export type GuardErrorCode = 'unauthorized' | 'forbidden' | 'not_found'

/** Typovaná chyba guardu – actions ji můžou zmapovat na UI hlášky. */
export class GuardError extends Error {
  constructor(
    public readonly code: GuardErrorCode,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'GuardError'
  }
}

export function unauthorized(message = 'Nepřihlášený uživatel'): GuardError {
  return new GuardError('unauthorized', message)
}

export function forbidden(message = 'Nedostatečná oprávnění'): GuardError {
  return new GuardError('forbidden', message)
}

export type Capability = 'view' | 'edit' | 'publish' | 'manage'

/**
 * RBAC matice (§3.7):
 *   owner:  view, edit, publish, manage
 *   admin:  view, edit, publish
 *   editor: view, edit
 *   viewer: view
 *   webdo24 admin (user_metadata.role = 'admin'): vše
 */
const ROLE_CAPABILITIES: Record<MembershipRole, readonly Capability[]> = {
  owner: ['view', 'edit', 'publish', 'manage'],
  admin: ['view', 'edit', 'publish'],
  editor: ['view', 'edit'],
  viewer: ['view'],
}

export interface TenantContext {
  userId: string
  customerId: string
  /** Role z membershipu, nebo null pro webdo24 admina bez membershipu. */
  role: MembershipRole | null
  isWebdo24Admin: boolean
}

/**
 * Membership lookup. Jde přes service-role klienta – guard je vstupní bod
 * autorizace a nesmí záviset na tom, že RLS dotaz pustí (RLS na memberships
 * sice SELECT vlastního řádku povoluje, ale guard voláme i pro kontexty,
 * kde cookie session nemusí být kompletní).
 *
 * cache(): v rámci jednoho requestu se lookup provede jen jednou (stránky
 * volají guard z více paralelních doménových služeb najednou – bez cache
 * by každá volba dělala vlastní SELECT → N+1 dotazů navíc).
 */
export const getMembership = cache(
  async (userId: string, customerId: string): Promise<CustomerMembership | null> => {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('webdo24_customer_memberships')
      .select('customer_id, user_id, role, invited_by, created_at')
      .eq('customer_id', customerId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data) return null
    return data as CustomerMembership
  },
)

/**
 * Ověří aktuální session a capability vůči zákazníkovi.
 * Voláno na vstupu každé CCC operace. Hází GuardError.
 */
export async function requireCapability(
  customerId: string,
  capability: Capability,
): Promise<TenantContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw unauthorized()

  // WebDo24 admin (user_metadata.role = 'admin') – plný přístup (§3.7)
  if (user.user_metadata?.role === 'admin') {
    return { userId: user.id, customerId, role: null, isWebdo24Admin: true }
  }

  const membership = await getMembership(user.id, customerId)
  if (!membership) throw forbidden()

  if (!ROLE_CAPABILITIES[membership.role].includes(capability)) {
    throw forbidden(`Role ${membership.role} nemá oprávnění '${capability}'`)
  }

  return {
    userId: user.id,
    customerId,
    role: membership.role,
    isWebdo24Admin: false,
  }
}

/**
 * Přeloží projectId na tenant (customerId). Vrací null, pokud projekt
 * neexistuje. Interně service-role – samo o sobě nic neautorizuje,
 * autorizaci vždy dělej přes requireCapability / requireProjectCapability.
 */
export const getProjectTenant = cache(
  async (projectId: string): Promise<{ projectId: string; customerId: string } | null> => {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('webdo24_projects')
      .select('id, customer_id')
      .eq('id', projectId)
      .maybeSingle()

    if (error || !data) return null
    return { projectId: data.id as string, customerId: data.customer_id as string }
  },
)

/**
 * Zkratka pro operace adresované projektem: přeloží tenant a ověří
 * capability. Hází GuardError('not_found') pro neexistující projekt.
 */
export async function requireProjectCapability(
  projectId: string,
  capability: Capability,
): Promise<TenantContext & { projectId: string }> {
  const tenant = await getProjectTenant(projectId)
  if (!tenant) throw new GuardError('not_found', 'Projekt nenalezen')

  const ctx = await requireCapability(tenant.customerId, capability)
  return { ...ctx, projectId: tenant.projectId }
}
