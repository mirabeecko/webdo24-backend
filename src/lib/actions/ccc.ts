'use server'

// ============================================
// CCC – server actions bridge pro Customer Dashboard (Phase 3)
//
// Tenké wrappery nad doménovými moduly v src/lib/ccc/ – žádná business
// logika tady, jen resolve kontextu (user → customer → project) a
// delegace. Autorizace je vždy znovu vynucena uvnitř ccc modulů
// (requireCapability), actions jen dodají projectId.
// ============================================

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMembership } from '@/lib/ccc/guard'
import { listPages, getPageContent, getCompanyProfile, getBrandProfile } from '@/lib/ccc/registry'
import {
  createChangeSet,
  listChangeSets,
  getChangeSet,
  cancelChangeSet,
  type CreateChangeSetItemInput,
} from '@/lib/ccc/changesets'
import { requestPreview } from '@/lib/ccc/preview'
import {
  approveChangeSet,
  publishChangeSet,
  rollbackPublication,
  listPublications,
} from '@/lib/ccc/publish'
import { listMediaAssets, getMediaAssetUsage, uploadMediaAsset, updateMediaAssetAlt } from '@/lib/ccc/media'
import { listNotifications, markNotificationRead } from '@/lib/ccc/notifications'
import type { MediaCategory, MembershipRole } from '@/types/website-contract'

// --------------------------------------------------------------
// Kontext: aktuální uživatel → customer → projekt (V1: 1:1:1)
// --------------------------------------------------------------

export interface CccContext {
  userId: string
  customerId: string
  projectId: string
  projectSlug: string | null
  role: MembershipRole
  canEdit: boolean
  canPublish: boolean
}

const EDIT_ROLES: readonly MembershipRole[] = ['owner', 'admin', 'editor']
const PUBLISH_ROLES: readonly MembershipRole[] = ['owner', 'admin']

export async function getCccContext(): Promise<CccContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: customer } = await admin
    .from('webdo24_customers')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!customer) return null

  const { data: project } = await admin
    .from('webdo24_projects')
    .select('id, slug')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!project) return null

  const membership = await getMembership(user.id, customer.id)
  // fallback pro zákazníky bez seednutého membershipu (customers.user_id = owner)
  const role: MembershipRole = membership?.role ?? 'owner'

  return {
    userId: user.id,
    customerId: customer.id,
    projectId: project.id,
    projectSlug: (project.slug as string | null) ?? null,
    role,
    canEdit: EDIT_ROLES.includes(role),
    canPublish: PUBLISH_ROLES.includes(role),
  }
}

async function requireContext(): Promise<CccContext> {
  const ctx = await getCccContext()
  if (!ctx) throw new Error('Nepřihlášený uživatel nebo chybějící projekt')
  return ctx
}

// --------------------------------------------------------------
// Registry: stránky a obsah
// --------------------------------------------------------------

export async function getPagesAction() {
  const ctx = await requireContext()
  return listPages(ctx.projectId)
}

export async function getPageContentAction(pageSlug: string) {
  const ctx = await requireContext()
  return getPageContent(ctx.projectId, pageSlug)
}

export async function getCompanyProfileAction() {
  const ctx = await requireContext()
  return getCompanyProfile(ctx.projectId)
}

export async function getBrandProfileAction() {
  const ctx = await requireContext()
  return getBrandProfile(ctx.projectId)
}

// --------------------------------------------------------------
// ChangeSet flow
// --------------------------------------------------------------

export async function createChangeSetAction(
  title: string,
  items: CreateChangeSetItemInput[],
) {
  const ctx = await requireContext()
  return createChangeSet({ projectId: ctx.projectId, title, items, source: 'gui' })
}

export async function listChangeSetsAction() {
  const ctx = await requireContext()
  return listChangeSets(ctx.projectId)
}

export async function getChangeSetAction(id: string) {
  await requireContext()
  return getChangeSet(id)
}

export async function requestPreviewAction(changesetId: string) {
  await requireContext()
  return requestPreview(changesetId)
}

export async function approveAction(changesetId: string) {
  await requireContext()
  return approveChangeSet(changesetId)
}

export async function publishAction(changesetId: string) {
  await requireContext()
  return publishChangeSet(changesetId)
}

export async function cancelChangeSetAction(changesetId: string) {
  await requireContext()
  return cancelChangeSet(changesetId)
}

// --------------------------------------------------------------
// Historie / rollback
// --------------------------------------------------------------

export async function listPublicationsAction() {
  const ctx = await requireContext()
  return listPublications(ctx.projectId)
}

export async function rollbackAction(publicationId: string) {
  await requireContext()
  return rollbackPublication(publicationId)
}

// --------------------------------------------------------------
// Media Library
// --------------------------------------------------------------

export async function listMediaAction(category?: MediaCategory) {
  const ctx = await requireContext()
  return listMediaAssets(ctx.projectId, category)
}

export async function getMediaUsageAction(assetId: string) {
  await requireContext()
  return getMediaAssetUsage(assetId)
}

export async function updateMediaAltAction(assetId: string, altText: string) {
  await requireContext()
  return updateMediaAssetAlt(assetId, altText)
}

/** Upload přímo přes server action – FormData se serializuje nativně. */
export async function uploadMediaAction(formData: FormData) {
  const ctx = await requireContext()
  const file = formData.get('file')
  const category = formData.get('category')
  const altText = formData.get('alt_text')

  if (!(file instanceof File)) throw new Error('Chybí soubor')

  return uploadMediaAsset({
    projectId: ctx.projectId,
    file,
    category:
      typeof category === 'string' && category
        ? (category as MediaCategory)
        : undefined,
    altText: typeof altText === 'string' && altText ? altText : undefined,
  })
}

// --------------------------------------------------------------
// Notifikace
// --------------------------------------------------------------

export async function getNotificationsAction(limit = 20) {
  const ctx = await requireContext()
  return listNotifications(ctx.customerId, limit)
}

export async function markNotificationReadAction(notificationId: string) {
  await requireContext()
  return markNotificationRead(notificationId)
}
