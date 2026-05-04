import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole } from '@/types'

export async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function getRole(): Promise<UserRole | null> {
  const user = await getUser()
  if (!user) return null
  const role = user.user_metadata?.role as string
  return role === 'admin' ? 'admin' : 'customer'
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireAdmin() {
  const user = await getUser()
  if (!user || user.user_metadata?.role !== 'admin') {
    throw new Error('Forbidden')
  }
  return user
}

export async function isAdmin(): Promise<boolean> {
  const role = await getRole()
  return role === 'admin'
}

export async function getCustomerId(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('webdo24_customers')
    .select('id')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return data.id
}
