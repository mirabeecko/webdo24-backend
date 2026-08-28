'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppCustomerContext } from '@/lib/customer-context'
import type { Product, UpsellEvent, UpsellEventType } from '@/types'

// --------------------------------------------------------------
// Caller context
// --------------------------------------------------------------

async function getCaller() {
  const context = await getAppCustomerContext()
  if (!context) return null
  const { customer, project, user } = context

  return {
    userId: user.id,
    customerId: customer.id,
    hasProPack: !!customer.has_pro_pack,
    customerCreatedAt: customer.created_at,
    project,
  }
}

// --------------------------------------------------------------
// LIST aktivních produktů
// --------------------------------------------------------------

export async function listProducts(): Promise<Product[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('webdo24_products')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  return (data as Product[]) ?? []
}

// --------------------------------------------------------------
// Pravidla pro výběr „nejlepšího tipu dne"
// Vrací jeden produkt + reason, nebo null pokud nic relevantního.
// --------------------------------------------------------------

export type UpsellTip = {
  product: Product
  reason: string                  // human-friendly důvod do UI
  triggerKey: string              // strojový key pro tracking
}

function daysSince(iso?: string | null) {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export async function getDashboardTip(): Promise<UpsellTip | null> {
  const ctx = await getCaller()
  if (!ctx || !ctx.project) return null

  const supabase = await createClient()

  // Načti aktivní produkty (krátce, pro lookup podle slugu)
  const products = await listProducts()
  const bySlug = new Map(products.map((p) => [p.slug, p]))

  // Načti, co už klient nedávno dismissoval (max 14 dní zpět)
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const { data: dismissed } = await supabase
    .from('webdo24_upsell_events')
    .select('product_id')
    .eq('customer_id', ctx.customerId)
    .eq('event_type', 'dismiss')
    .gte('created_at', since)

  const dismissedIds = new Set((dismissed ?? []).map((d) => d.product_id))

  // ── Rules (priority order — first match wins) ──
  const projectDays = daysSince(ctx.project.created_at)

  // 1) Web > 30 dní, nemá ještě upsell SEO → SEO balíček
  if (projectDays >= 30) {
    const seo = bySlug.get('seo-balicek')
    if (seo && !dismissedIds.has(seo.id)) {
      return {
        product: seo,
        reason: 'Váš web žije už měsíc – pojďme přilákat klienty z Googlu.',
        triggerKey: 'web_age_30d',
      }
    }
  }

  // 2) Méně než 3 fotky → fotobalíček
  const { count: photoCount } = await supabase
    .from('webdo24_project_files')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', ctx.project.id)
    .eq('file_type', 'image')
  if ((photoCount ?? 0) < 3) {
    const foto = bySlug.get('foto-balicek')
    if (foto && !dismissedIds.has(foto.id)) {
      return {
        product: foto,
        reason: 'Web s fotkami získá víc důvěry – přidáme profi sadu.',
        triggerKey: 'low_photo_count',
      }
    }
  }

  // 3) Pro/Premium + > 60 dní bez blogu → Blog AI
  if (projectDays >= 60) {
    const blog = bySlug.get('blog-ai')
    if (blog && !dismissedIds.has(blog.id)) {
      return {
        product: blog,
        reason: 'Pravidelný obsah dělá zázraky se SEO – nasaďme AI blog.',
        triggerKey: 'no_blog_60d',
      }
    }
  }

  // 4) Service business → Rezervace
  if (ctx.project.business_type && /kadeř|salon|kosmetik|fitness|masáž|restaurac|kavárn/i.test(ctx.project.business_type)) {
    const rez = bySlug.get('rezervace')
    if (rez && !dismissedIds.has(rez.id)) {
      return {
        product: rez,
        reason: 'Vaši zákazníci si chtějí rezervovat sami, kdykoliv.',
        triggerKey: 'service_business',
      }
    }
  }

  // 5) Fallback: první aktivní produkt, který klient neviděl
  for (const p of products) {
    if (!dismissedIds.has(p.id)) {
      return {
        product: p,
        reason: 'Tip pro váš byznys.',
        triggerKey: 'fallback',
      }
    }
  }

  return null
}

// --------------------------------------------------------------
// Tracking event
// --------------------------------------------------------------

export async function trackUpsellEvent(opts: {
  productId: string
  eventType: UpsellEventType
  context?: string
  triggerReason?: string
}): Promise<{ ok: true }> {
  const ctx = await getCaller()
  if (!ctx) throw new Error('not_authenticated')

  // RLS dovolí customer INSERT s vlastním customer_id
  const supabase = await createClient()
  const { error } = await supabase.from('webdo24_upsell_events').insert({
    customer_id: ctx.customerId,
    product_id: opts.productId,
    event_type: opts.eventType,
    context: opts.context ?? null,
    trigger_reason: opts.triggerReason ?? null,
  })

  if (error) throw new Error(error.message)
  return { ok: true }
}

// --------------------------------------------------------------
// Stats per produkt (pro admin)
// --------------------------------------------------------------

export async function getProductStats(): Promise<Array<{
  product_id: string
  impressions: number
  clicks: number
  conversions: number
  dismisses: number
  ctr: number
  cvr: number
}>> {
  const admin = createAdminClient()
  // Nestřídmá agregace v JS — pro startup OK, později nahradit SQL view
  const { data } = await admin
    .from('webdo24_upsell_events')
    .select('product_id, event_type')

  const map = new Map<string, { impressions: number; clicks: number; conversions: number; dismisses: number }>()
  for (const e of (data ?? []) as Pick<UpsellEvent, 'product_id' | 'event_type'>[]) {
    if (!e.product_id) continue
    const cur = map.get(e.product_id) ?? { impressions: 0, clicks: 0, conversions: 0, dismisses: 0 }
    if (e.event_type === 'impression') cur.impressions++
    else if (e.event_type === 'click') cur.clicks++
    else if (e.event_type === 'convert') cur.conversions++
    else if (e.event_type === 'dismiss') cur.dismisses++
    map.set(e.product_id, cur)
  }

  return [...map.entries()].map(([product_id, v]) => ({
    product_id,
    ...v,
    ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
    cvr: v.clicks > 0 ? v.conversions / v.clicks : 0,
  }))
}
