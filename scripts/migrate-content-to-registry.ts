// ============================================
// Migrace obsahu: website_content → Content Registry  (architektura §12.2)
//
// Pro každý projekt (nebo jen --project=<slug>):
//   1. vytvoří webdo24_pages (home, o-nas, sluzby, kontakt)
//   2. zaregistruje field katalog (homepage.*, company.*, branding.*)
//   3. přenese webdo24_website_content.section_key → field_key
//      (hero_title → homepage.hero.title, phone → company.phone, …)
//   4. services/testimonials → repeater hodnoty
//   5. company_profiles z kontaktů projektu, brand_profiles defaults
//
// Idempotentní: definice (pages/fields) = upsert, hodnoty (content_values)
// = insert-only (onConflict do nothing) – rerun nikdy nepřepíše novější
// published obsah. Dry-run:  npx tsx scripts/migrate-content-to-registry.ts --dry-run
// Ostře:       npx tsx scripts/migrate-content-to-registry.ts --project=truhlarstvi-drevorez
//
// POZOR: vyžaduje PLATNÝ SUPABASE_SERVICE_ROLE_KEY pro projekt v
// NEXT_PUBLIC_SUPABASE_URL (v .env.local byl k 2026-08-08 zastaralý –
// patřil jinému projektu; správný klíč lze předat přes env proměnnou).
// ============================================

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const PROJECT_ARG = process.argv.find((a) => a.startsWith('--project='))?.split('=')[1]

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

// --------------------------------------------------------------
// Katalog stránek a polí
// --------------------------------------------------------------

const PAGE_DEFS = [
  { slug: 'home', title: 'Úvod', sort_order: 0 },
  { slug: 'o-nas', title: 'O nás', sort_order: 1 },
  { slug: 'sluzby', title: 'Služby', sort_order: 2 },
  { slug: 'kontakt', title: 'Kontakt', sort_order: 3 },
] as const

type FieldDef = {
  field_key: string
  page: 'home' | null // null = globální
  section_key: string | null
  field_type: string
  label: string
  sort_order: number
}

const FIELD_DEFS: FieldDef[] = [
  // homepage
  { field_key: 'homepage.hero.title', page: 'home', section_key: 'hero', field_type: 'text', label: 'Hlavní nadpis', sort_order: 10 },
  { field_key: 'homepage.hero.subtitle', page: 'home', section_key: 'hero', field_type: 'textarea', label: 'Podnadpis', sort_order: 20 },
  { field_key: 'homepage.hero.hero_image', page: 'home', section_key: 'hero', field_type: 'image', label: 'Hlavní obrázek', sort_order: 25 },
  { field_key: 'homepage.about.text', page: 'home', section_key: 'about', field_type: 'textarea', label: 'Text o nás', sort_order: 30 },
  { field_key: 'homepage.services.items', page: 'home', section_key: 'services', field_type: 'repeater', label: 'Položky služeb', sort_order: 40 },
  { field_key: 'homepage.references.items', page: 'home', section_key: 'references', field_type: 'repeater', label: 'Reference', sort_order: 50 },
  // company.* (globální, §11)
  { field_key: 'company.company_name', page: null, section_key: 'company', field_type: 'text', label: 'Název firmy', sort_order: 10 },
  { field_key: 'company.ico', page: null, section_key: 'company', field_type: 'text', label: 'IČO', sort_order: 20 },
  { field_key: 'company.dic', page: null, section_key: 'company', field_type: 'text', label: 'DIČ', sort_order: 30 },
  { field_key: 'company.street', page: null, section_key: 'company', field_type: 'text', label: 'Adresa', sort_order: 40 },
  { field_key: 'company.city', page: null, section_key: 'company', field_type: 'text', label: 'Město', sort_order: 50 },
  { field_key: 'company.postal_code', page: null, section_key: 'company', field_type: 'text', label: 'PSČ', sort_order: 60 },
  { field_key: 'company.country', page: null, section_key: 'company', field_type: 'text', label: 'Země', sort_order: 70 },
  { field_key: 'company.phone', page: null, section_key: 'company', field_type: 'phone', label: 'Telefon', sort_order: 80 },
  { field_key: 'company.secondary_phone', page: null, section_key: 'company', field_type: 'phone', label: 'Druhý telefon', sort_order: 90 },
  { field_key: 'company.email', page: null, section_key: 'company', field_type: 'email', label: 'E-mail', sort_order: 100 },
  { field_key: 'company.opening_hours', page: null, section_key: 'company', field_type: 'text', label: 'Otevírací doba', sort_order: 110 },
  { field_key: 'company.google_maps_url', page: null, section_key: 'company', field_type: 'url', label: 'Odkaz na Google Mapy', sort_order: 120 },
  { field_key: 'company.facebook', page: null, section_key: 'social', field_type: 'url', label: 'Facebook', sort_order: 130 },
  { field_key: 'company.instagram', page: null, section_key: 'social', field_type: 'url', label: 'Instagram', sort_order: 140 },
  { field_key: 'company.linkedin', page: null, section_key: 'social', field_type: 'url', label: 'LinkedIn', sort_order: 150 },
  { field_key: 'company.youtube', page: null, section_key: 'social', field_type: 'url', label: 'YouTube', sort_order: 160 },
  // branding.* (globální, §10)
  { field_key: 'branding.logo_asset_id', page: null, section_key: 'branding', field_type: 'logo', label: 'Hlavní logo', sort_order: 10 },
  { field_key: 'branding.logo_light_asset_id', page: null, section_key: 'branding', field_type: 'logo', label: 'Světlá varianta loga', sort_order: 20 },
  { field_key: 'branding.logo_dark_asset_id', page: null, section_key: 'branding', field_type: 'logo', label: 'Tmavá varianta loga', sort_order: 30 },
  { field_key: 'branding.favicon_asset_id', page: null, section_key: 'branding', field_type: 'logo', label: 'Favicon', sort_order: 40 },
  { field_key: 'branding.primary_color', page: null, section_key: 'branding', field_type: 'color', label: 'Hlavní barva', sort_order: 50 },
  { field_key: 'branding.secondary_color', page: null, section_key: 'branding', field_type: 'color', label: 'Doplňková barva', sort_order: 60 },
]

// Mapping webdo24_website_content.section_key → field_key
// (ověřeno proti reálným datům 2026-08-08: hero_title, hero_subtitle,
// about_text, phone, email, address, hours)
// Odchylka od §12.2: address → company.street (sloupec company.address
// neexistuje; company_profiles má street/city/postal_code).
const SECTION_TO_FIELD: Record<string, string> = {
  hero_title: 'homepage.hero.title',
  hero_subtitle: 'homepage.hero.subtitle',
  about_text: 'homepage.about.text',
  phone: 'company.phone',
  email: 'company.email',
  address: 'company.street',
  hours: 'company.opening_hours',
}

// --------------------------------------------------------------
// Migrace jednoho projektu
// --------------------------------------------------------------

async function migrateProject(project: {
  id: string
  slug: string | null
  title: string | null
  customer_id: string
}) {
  const log = (msg: string) => console.log(`  ${DRY_RUN ? '[dry-run] ' : ''}${msg}`)
  console.log(`\n■ Projekt ${project.slug ?? project.id} (${project.title ?? 'bez názvu'})`)

  // 1. stránky
  const pageRows = PAGE_DEFS.map((p) => ({
    project_id: project.id,
    customer_id: project.customer_id,
    slug: p.slug,
    title: p.title,
    status: 'published',
    sort_order: p.sort_order,
  }))
  log(`pages: upsert ${pageRows.length} (${PAGE_DEFS.map((p) => p.slug).join(', ')})`)
  if (!DRY_RUN) {
    const { error } = await admin
      .from('webdo24_pages')
      .upsert(pageRows, { onConflict: 'project_id,slug' })
    if (error) throw new Error(`pages upsert: ${error.message}`)
  }

  // page id pro 'home'
  let homePageId: string | null = null
  if (!DRY_RUN) {
    const { data } = await admin
      .from('webdo24_pages')
      .select('id')
      .eq('project_id', project.id)
      .eq('slug', 'home')
      .single()
    homePageId = data?.id ?? null
  }

  // 2. field katalog
  const fieldRows = FIELD_DEFS.map((f) => ({
    project_id: project.id,
    customer_id: project.customer_id,
    page_id: f.page === 'home' ? homePageId : null,
    field_key: f.field_key,
    section_key: f.section_key,
    field_type: f.field_type,
    label: f.label,
    sort_order: f.sort_order,
  }))
  log(`content_fields: upsert ${fieldRows.length} definic`)
  if (!DRY_RUN) {
    const { error } = await admin
      .from('webdo24_content_fields')
      .upsert(fieldRows, { onConflict: 'project_id,field_key' })
    if (error) throw new Error(`fields upsert: ${error.message}`)
  }

  // field_key → field_id
  const fieldIdByKey = new Map<string, string>()
  if (!DRY_RUN) {
    const { data } = await admin
      .from('webdo24_content_fields')
      .select('id, field_key')
      .eq('project_id', project.id)
    for (const f of data ?? []) fieldIdByKey.set(f.field_key, f.id)
  }

  // 3. hodnoty z website_content
  const { data: legacy } = await admin
    .from('webdo24_website_content')
    .select('section_key, content_value')
    .eq('project_id', project.id)

  const values = new Map<string, unknown>()
  for (const row of legacy ?? []) {
    const fieldKey = SECTION_TO_FIELD[row.section_key as string]
    if (fieldKey && row.content_value) values.set(fieldKey, row.content_value)
  }
  log(`content_values z website_content: ${values.size} hodnot (${[...values.keys()].join(', ') || 'žádné'})`)

  // 4. services/testimonials → repeater hodnoty
  const { data: services } = await admin
    .from('webdo24_services')
    .select('title, description, price, image_url, sort_order')
    .eq('project_id', project.id)
    .eq('is_published', true)
    .order('sort_order')
  if (services && services.length > 0) {
    values.set(
      'homepage.services.items',
      services.map((s) => ({
        title: s.title ?? '',
        description: s.description ?? '',
        price: s.price ?? '',
        image: s.image_url ?? '',
      })),
    )
    log(`services → homepage.services.items: ${services.length} položek`)
  }

  const { data: testimonials } = await admin
    .from('webdo24_testimonials')
    .select('customer_name, text, rating')
    .eq('project_id', project.id)
    .eq('is_published', true)
  if (testimonials && testimonials.length > 0) {
    values.set(
      'homepage.references.items',
      testimonials.map((t) => ({
        name: t.customer_name ?? '',
        text: t.text ?? '',
        rating: t.rating ?? 5,
      })),
    )
    log(`testimonials → homepage.references.items: ${testimonials.length} položek`)
  }

  // insert-only: rerun nikdy nepřepíše novější published obsah
  if (!DRY_RUN) {
    const nowIso = new Date().toISOString()
    let inserted = 0
    for (const [fieldKey, value] of values) {
      const fieldId = fieldIdByKey.get(fieldKey)
      if (!fieldId) continue
      const { error } = await admin
        .from('webdo24_content_values')
        .upsert(
          { field_id: fieldId, published_value: value, published_at: nowIso },
          { onConflict: 'field_id', ignoreDuplicates: true },
        )
      if (error) throw new Error(`value ${fieldKey}: ${error.message}`)
      inserted++
    }
    log(`content_values: vloženo ${inserted} (existující přeskočeny)`)
  }

  // 5. company_profiles z kontaktů zákazníka + přenesených hodnot
  const { data: customer } = await admin
    .from('webdo24_customers')
    .select('company, ico, dic, address, email, phone')
    .eq('id', project.customer_id)
    .maybeSingle()

  const companyProfile = {
    project_id: project.id,
    customer_id: project.customer_id,
    company_name: customer?.company ?? null,
    ico: customer?.ico ?? null,
    dic: customer?.dic ?? null,
    street: (values.get('company.street') as string | undefined) ?? customer?.address ?? null,
    email: (values.get('company.email') as string | undefined) ?? customer?.email ?? null,
    phone: (values.get('company.phone') as string | undefined) ?? customer?.phone ?? null,
    opening_hours: (values.get('company.opening_hours') as string | undefined) ?? null,
  }
  log(`company_profiles: upsert (${companyProfile.company_name ?? 'bez názvu'})`)
  if (!DRY_RUN) {
    const { error } = await admin
      .from('webdo24_company_profiles')
      .upsert(companyProfile, { onConflict: 'project_id' })
    if (error) throw new Error(`company profile: ${error.message}`)

    // brand_profiles defaults (insert-only)
    const { error: brandError } = await admin
      .from('webdo24_brand_profiles')
      .upsert(
        { project_id: project.id, customer_id: project.customer_id },
        { onConflict: 'project_id', ignoreDuplicates: true },
      )
    if (brandError) throw new Error(`brand profile: ${brandError.message}`)
    log('brand_profiles: default řádek zajištěn')
  }
}

// --------------------------------------------------------------
// Main
// --------------------------------------------------------------

async function main() {
  console.log(
    `Migrace website_content → Registry ${DRY_RUN ? '(DRY-RUN)' : '(OSTRĚ)'}` +
      (PROJECT_ARG ? ` – jen projekt: ${PROJECT_ARG}` : ' – všechny projekty'),
  )

  let query = admin
    .from('webdo24_projects')
    .select('id, slug, title, customer_id')
    .not('customer_id', 'is', null)
  if (PROJECT_ARG) query = query.eq('slug', PROJECT_ARG)

  const { data: projects, error } = await query
  if (error) throw new Error(`projects: ${error.message}`)
  if (!projects || projects.length === 0) {
    console.log('Žádné projekty k migraci.')
    return
  }

  for (const project of projects) {
    await migrateProject(project as {
      id: string
      slug: string | null
      title: string | null
      customer_id: string
    })
  }

  console.log('\nHotovo.')
}

main().catch((e) => {
  console.error('Migrace selhala:', e.message)
  process.exit(1)
})
