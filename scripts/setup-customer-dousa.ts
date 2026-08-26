// ============================================
// Setup zákazníka: Pavel Douša – Elektroinstalace (dousa-elektro.cz)
//
// Vytvoří (idempotentně):
//  1. Supabase Auth uživatele dousa.elektro@seznam.cz (role customer)
//  2. webdo24_customers záznam (+ auto membership owner přes trigger)
//  3. webdo24_projects (slug pavel-dousa-elektroinstalace, domain dousa-elektro.cz)
//  4. Stránku "home" + Content Registry pole a published hodnoty
//  5. Company/Brand profily
//  6. Média (logo + hero obrázek) do Supabase Storage
//
// Spuštění: npm run setup:dousa   (nebo tsx -r dotenv/config scripts/setup-customer-dousa.ts)
// ============================================

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMAIL = 'dousa.elektro@seznam.cz'
const PASSWORD = 'elektrikárnamoto'
const NAME = 'Pavel Douša'
const COMPANY = 'Pavel Douša – Elektroinstalace'
const SLUG = 'pavel-dousa-elektroinstalace'
const DOMAIN = 'dousa-elektro.cz'
const BUCKET = 'webdo24-files'

const SERVICES = [
  {
    title: 'Montáž & výměna rozvaděčů',
    description:
      'Bytové i provozní rozvaděče na klíč. Přepěťové ochrany, chrániče, popisky. Vše připravené pro revizního technika.',
    price: '',
  },
  {
    title: 'Kompletní elektroinstalace',
    description:
      'Novostavby, rekonstrukce, drobné úpravy. Trasy promyšlené tak, aby to fungovalo i za 20 let — bez sekání do zdi naslepo.',
    price: '',
  },
  {
    title: 'Rekonstrukce bytů a domů',
    description:
      'Sjednotím to, co tam je, a připravím to, co bude. Domluva s ostatními řemesly, aby do vás nezačal kopat zedník v půli práce.',
    price: '',
  },
  {
    title: 'Světla, LED & chytré prvky',
    description:
      'Scény, stmívače, LED pásky, chytré spínače a senzory. Aby se světlo chovalo, jak to potřebujete vy — ne tlačítko ze 70. let.',
    price: '',
  },
  {
    title: 'Provozovny & dílny',
    description:
      'Třífázové zásuvky, robustní okruhy, samostatné jištění strojů. Postavené na to, že tam bude každý den někdo pracovat.',
    price: '',
  },
  {
    title: 'Příprava na revizi',
    description:
      'Dokumentace, popisy, čistý stav. Když přijde revizní technik, neztrácíte čas dohledáváním. A neplatíte za druhou návštěvu.',
    price: '',
  },
]

const HERO_TITLE = 'Elektřina bez kompromisů.'
const HERO_SUBTITLE =
  'Jsem Pavel Douša — elektrikář z Chabařovic. Dělám rozvaděče, kompletní instalace, rekonstrukce bytů a domů, LED a chytré prvky. Bez bordelu. Bez výmluv. S přehledem.'
const ABOUT_TEXT =
  'Jsem Pavel Douša, elektrikář z Chabařovic s více než 15 lety v oboru a 540+ dokončenými zakázkami. Specializuji se na rozvaděče na klíč, kompletní elektroinstalace, rekonstrukce bytů a domů, LED osvětlení a chytré prvky.\n\nRozvaděč je srdce každé instalace. Když je dělaný správně, lidi v něm vidí pořádek, řemeslo a klid. Když je dělaný špatně, prozradí se to při první kontrole — nebo při první závadě.\n\nStavím rozvaděče na klíč: bytové, rodinné, pro provozovny i dílny. Vždy s přehledným popisem, dokumentací a logikou, kterou pochopí i ten, kdo přijde po mně.\n\nPracuji v Chabařovicích, Ústí nad Labem, Teplicích a okolí do 30 km.'

async function findUserByEmail(email: string) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null
}

async function main() {
  // ── 1. Auth uživatel ──
  let user = await findUserByEmail(EMAIL)
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'customer', name: NAME },
    })
    if (error) throw new Error(`auth create: ${error.message}`)
    user = data.user
    console.log('✓ Auth uživatel vytvořen:', user.id)
  } else {
    console.log('• Auth uživatel existuje:', user.id)
    // zajistit roli customer
    if (user.user_metadata?.role !== 'customer') {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, role: 'customer', name: NAME },
      })
      console.log('• role nastavena na customer')
    }
  }

  // ── 2. Customer ──
  let { data: customer } = await admin
    .from('webdo24_customers')
    .select('*')
    .eq('email', EMAIL)
    .maybeSingle()

  if (!customer) {
    const { data, error } = await admin
      .from('webdo24_customers')
      .insert({
        user_id: user.id,
        name: NAME,
        email: EMAIL,
        company: COMPANY,
      })
      .select()
      .single()
    if (error) throw new Error(`customer insert: ${error.message}`)
    customer = data
    console.log('✓ Customer vytvořen:', customer.id)
  } else {
    console.log('• Customer existuje:', customer.id)
    if (!customer.user_id) {
      await admin.from('webdo24_customers').update({ user_id: user.id }).eq('id', customer.id)
      console.log('• user_id doplněn')
    }
  }
  const customerId = customer.id as string

  // email prefs
  const { data: prefs } = await admin
    .from('webdo24_customer_email_prefs')
    .select('customer_id')
    .eq('customer_id', customerId)
    .maybeSingle()
  if (!prefs) {
    await admin.from('webdo24_customer_email_prefs').insert({
      customer_id: customerId,
      notifications_enabled: true,
      marketing_enabled: false,
    })
    console.log('✓ Email prefs vytvořeny')
  }

  // ── 3. Projekt ──
  let { data: project } = await admin
    .from('webdo24_projects')
    .select('*')
    .eq('slug', SLUG)
    .maybeSingle()

  if (!project) {
    const { data, error } = await admin
      .from('webdo24_projects')
      .insert({
        customer_id: customerId,
        title: COMPANY,
        slug: SLUG,
        business_type: 'Elektroinstalace',
        target_audience: 'Domácnosti a firmy v okolí Chabařovic, Ústí nad Labem a Teplic',
        location: 'Chabařovice',
        language: 'cs',
        status: 'deployed',
        pipeline_type: 'standard',
        price_type: 'monthly',
        domain: DOMAIN,
        hosting_status: 'active',
        email_status: 'active',
        production_url: `https://${DOMAIN}`,
      })
      .select()
      .single()
    if (error) throw new Error(`project insert: ${error.message}`)
    project = data
    console.log('✓ Projekt vytvořen:', project.id)
  } else {
    console.log('• Projekt existuje:', project.id)
  }
  const projectId = project.id as string

  // ── 4. Stránka home ──
  let { data: page } = await admin
    .from('webdo24_pages')
    .select('*')
    .eq('project_id', projectId)
    .eq('slug', 'home')
    .maybeSingle()

  if (!page) {
    const { data, error } = await admin
      .from('webdo24_pages')
      .insert({
        project_id: projectId,
        customer_id: customerId,
        slug: 'home',
        title: 'Úvod',
        seo_title: 'Pavel Douša | Elektrikář Chabařovice — Rozvaděče · Instalace · Revize',
        seo_description: HERO_SUBTITLE,
        status: 'published',
        sort_order: 0,
      })
      .select()
      .single()
    if (error) throw new Error(`page insert: ${error.message}`)
    page = data
    console.log('✓ Stránka home vytvořena:', page.id)
  } else {
    console.log('• Stránka home existuje:', page.id)
  }
  const pageId = page.id as string

  // ── 5. Média (logo + hero) ──
  const uploadAsset = async (filePath: string, category: 'logo' | 'photo', alt: string) => {
    const bytes = readFileSync(filePath)
    const ext = filePath.endsWith('.png') ? 'png' : 'jpg'
    const assetId = crypto.randomUUID()
    const storagePath = `${customerId}/${projectId}/${assetId}/original.${ext}`

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: 'image/png', upsert: false })
    if (upErr) throw new Error(`storage upload ${filePath}: ${upErr.message}`)

    const { data: pubUrl } = admin.storage.from(BUCKET).getPublicUrl(storagePath)
    const { data: asset, error: dbErr } = await admin
      .from('webdo24_media_assets')
      .insert({
        customer_id: customerId,
        project_id: projectId,
        category,
        filename: filePath.split('/').pop()!,
        mime_type: 'image/png',
        storage_path: storagePath,
        original_url: pubUrl.publicUrl,
        alt_text: alt,
        source: 'upload',
        created_by: user.id,
      })
      .select('*')
      .single()
    if (dbErr) throw new Error(`media insert ${filePath}: ${dbErr.message}`)
    console.log(`✓ Média nahráno (${category}):`, asset.id)
    return asset as { id: string; original_url: string }
  }

  const logoAsset = await uploadAsset('/tmp/dousa-assets/logo.png', 'logo', 'Logo Pavel Douša – Elektroinstalace')
  const heroAsset = await uploadAsset('/tmp/dousa-assets/hero.png', 'photo', 'Elektroinstalace Pavel Douša – hero')

  // ── 6. Content Registry pole + published hodnoty ──
  const fieldDefs: Array<{
    field_key: string
    section_key: string
    field_type: string
    label: string
    sort_order: number
    value: unknown
  }> = [
    { field_key: 'homepage.hero.title', section_key: 'hero', field_type: 'text', label: 'Hlavní nadpis', sort_order: 10, value: HERO_TITLE },
    { field_key: 'homepage.hero.subtitle', section_key: 'hero', field_type: 'textarea', label: 'Podnadpis', sort_order: 20, value: HERO_SUBTITLE },
    { field_key: 'homepage.hero.hero_image', section_key: 'hero', field_type: 'image', label: 'Hlavní obrázek', sort_order: 25, value: { asset_id: heroAsset.id, url: heroAsset.original_url, alt: 'Elektroinstalace Pavel Douša – hero' } },
    { field_key: 'homepage.about.text', section_key: 'about', field_type: 'textarea', label: 'Text o nás', sort_order: 30, value: ABOUT_TEXT },
    { field_key: 'homepage.services.items', section_key: 'services', field_type: 'repeater', label: 'Položky služeb', sort_order: 40, value: SERVICES },
    { field_key: 'homepage.references.items', section_key: 'references', field_type: 'repeater', label: 'Reference zákazníků', sort_order: 50, value: [] },
    { field_key: 'branding.logo_asset_id', section_key: 'branding', field_type: 'logo', label: 'Logo', sort_order: 5, value: { asset_id: logoAsset.id, url: logoAsset.original_url, alt: 'Logo Pavel Douša – Elektroinstalace' } },
  ]

  for (const f of fieldDefs) {
    const { data: field, error: fieldErr } = await admin
      .from('webdo24_content_fields')
      .upsert(
        {
          project_id: projectId,
          customer_id: customerId,
          page_id: pageId,
          field_key: f.field_key,
          section_key: f.section_key,
          field_type: f.field_type,
          label: f.label,
          validation: {},
          sort_order: f.sort_order,
          schema_version: 1,
        },
        { onConflict: 'project_id,field_key' },
      )
      .select()
      .single()
    if (fieldErr) throw new Error(`field upsert ${f.field_key}: ${fieldErr.message}`)

    const { error: valErr } = await admin
      .from('webdo24_content_values')
      .upsert(
        {
          field_id: field.id,
          published_value: f.value,
          published_at: new Date().toISOString(),
        },
        { onConflict: 'field_id' },
      )
    if (valErr) throw new Error(`value upsert ${f.field_key}: ${valErr.message}`)
    console.log(`✓ Pole + hodnota: ${f.field_key}`)
  }

  // ── 7. Company / Brand profily ──
  const { error: compErr } = await admin.from('webdo24_company_profiles').upsert(
    {
      project_id: projectId,
      customer_id: customerId,
      company_name: COMPANY,
      street: 'Chabařovice, Ústecký kraj (dojezd +30 km)',
      country: 'Česká republika',
      email: EMAIL,
      phone: '',
      opening_hours: '',
    },
    { onConflict: 'project_id' },
  )
  if (compErr) throw new Error(`company profile: ${compErr.message}`)
  console.log('✓ Company profil nastaven')

  const { error: brandErr } = await admin.from('webdo24_brand_profiles').upsert(
    {
      project_id: projectId,
      customer_id: customerId,
      logo_asset_id: logoAsset.id,
      primary_color: '#0ea5e9',
      secondary_color: '#ffd600',
    },
    { onConflict: 'project_id' },
  )
  if (brandErr) throw new Error(`brand profile: ${brandErr.message}`)
  console.log('✓ Brand profil nastaven')

  console.log('\n=== HOTOVO ===')
  console.log('Login:  ', EMAIL, '/', PASSWORD)
  console.log('Projekt:', projectId)
  console.log('Slug:   ', SLUG)
  console.log('Web:    http://localhost:3001/' + SLUG)
}

main().catch((err) => {
  console.error('CHYBA:', err)
  process.exit(1)
})
