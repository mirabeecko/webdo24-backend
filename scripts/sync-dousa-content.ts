// ============================================
// Sync obsahu z živého webu zákazníka (dousa-elektro.cz) do Content Registry
//
// Zdroj textů je VŽDY https://dousa-elektro.cz/ (živý web) — nikoli lokální
// repo. Skript stáhne HTML, vyextrahuje texty (hero, služby, o nás, kontakt)
// a uloží je jako PUBLISHED hodnoty do Content Registry. Zákazník pak texty
// upravuje v adminu (Obsah / Kontaktní údaje) a po publikování se promítnou
// na backendem renderovaném webu (web.webdo24.cz/{slug}).
//
// Živý web se NEmění — propojení je jednosměrné: web → registry.
//
// Spuštění: npm run sync:dousa
// ============================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const LIVE_URL = 'https://dousa-elektro.cz/'
const PROJECT_ID = '47dd8591-8fa3-4ac2-ab45-57bf1c7e4eb3'

// --------------------------------------------------------------
// HTML pomocníci (žádné externí závislosti)
// --------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/** Odstraní HTML tagy, dekóduje entity, sjednotí bílé znaky. */
function clean(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function extractBetween(html: string, start: string, end: string): string {
  const i = html.indexOf(start)
  if (i === -1) return ''
  const j = html.indexOf(end, i + start.length)
  if (j === -1) return ''
  return html.slice(i + start.length, j)
}

// --------------------------------------------------------------
// Extrakce textů ze živého webu
// --------------------------------------------------------------

function extractTexts(html: string) {
  // ── Hero ──
  const heroSection = extractBetween(html, '<section class="hero">', '</section>')
  const h1Block = extractBetween(heroSection, '<h1>', '</h1>')
  const heroTitle = clean(h1Block) || 'Elektřina bez kompromisů.'
  const heroSubRaw = extractBetween(heroSection, '<p class="hero-sub">', '</p>')
  const heroSubtitle = clean(heroSubRaw)
  const kicker = extractBetween(heroSection, '<div class="kicker">', '</div>')

  // ── Služby (article.service → h3 + p) ──
  const servicesSection = extractBetween(html, '<section id="sluzby">', '</section>')
  const services: Array<{ title: string; description: string; price: string }> = []
  const serviceRe = /<article class="service[^"]*">([\s\S]*?)<\/article>/g
  let m: RegExpExecArray | null
  while ((m = serviceRe.exec(servicesSection)) !== null) {
    const block = m[1]
    const title = clean(extractBetween(block, '<h3>', '</h3>'))
    const desc = clean(extractBetween(block, '<p>', '</p>'))
    if (title) services.push({ title, description: desc, price: '' })
  }

  // ── O nás (specializace / rozvaděče) ──
  const aboutSection = extractBetween(html, '<section id="rozvadece">', '</section>')
  const aboutTitle = clean(extractBetween(aboutSection, '<h3>', '</h3>'))
  const aboutParagraphs = [...aboutSection.matchAll(/<p>([\s\S]*?)<\/p>/g)]
    .map((pm) => clean(pm[1]))
    .filter(Boolean)
  const aboutBullets = [...aboutSection.matchAll(/<li>([\s\S]*?)<\/li>/g)]
    .map((lm) => clean(lm[1]))
    .filter(Boolean)
  const statsBlock = extractBetween(html, '<div class="hero-meta">', '</div>')
  const stats = [...statsBlock.matchAll(/data-count="([^"]+)"[^>]*data-suffix="([^"]*)"/g)]
    .map((sm) => `${sm[1]}${sm[2]}`)

  const aboutText = [
    aboutTitle,
    '',
    ...aboutParagraphs,
    ...(aboutBullets.length ? ['', ...aboutBullets.map((b) => '✓ ' + b)] : []),
    ...(stats.length ? ['', `Statistiky: ${stats.join(' · ')}.`] : []),
  ].join('\n')

  // ── Kontakt / region ──
  const regionMatch = kicker.match(/Chabařovice[^·]*/) ?? null
  const street = regionMatch ? regionMatch[0].trim() : 'Chabařovice, Ústecký kraj (dojezd +30 km)'

  return { heroTitle, heroSubtitle, services, aboutText, street }
}

// --------------------------------------------------------------
// Uložení do Content Registry
// --------------------------------------------------------------

async function setPublished(fieldKey: string, value: unknown) {
  const { data: field, error: fErr } = await admin
    .from('webdo24_content_fields')
    .select('id')
    .eq('project_id', PROJECT_ID)
    .eq('field_key', fieldKey)
    .maybeSingle()
  if (fErr) throw new Error(`field lookup ${fieldKey}: ${fErr.message}`)
  if (!field) {
    console.log(`  • pole ${fieldKey} neexistuje, přeskočeno`)
    return false
  }
  const { error: vErr } = await admin
    .from('webdo24_content_values')
    .upsert(
      { field_id: field.id, published_value: value, published_at: new Date().toISOString() },
      { onConflict: 'field_id' },
    )
  if (vErr) throw new Error(`value upsert ${fieldKey}: ${vErr.message}`)
  return true
}

async function syncCompanyProfile(street: string) {
  const { error } = await admin
    .from('webdo24_company_profiles')
    .update({ street })
    .eq('project_id', PROJECT_ID)
  if (error) throw new Error(`company profile: ${error.message}`)
}

// --------------------------------------------------------------

async function main() {
  console.log(`Stahuji ${LIVE_URL} ...`)
  const res = await fetch(LIVE_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  console.log(`  staženo ${html.length} B\n`)

  const t = extractTexts(html)

  console.log('Extrahované texty:')
  console.log(`  hero.title:     ${t.heroTitle}`)
  console.log(`  hero.subtitle:  ${t.heroSubtitle.slice(0, 80)}…`)
  console.log(`  services:       ${t.services.length} položek`)
  console.log(`  about:          ${t.aboutText.length} znaků`)
  console.log(`  street:         ${t.street}\n`)

  console.log('Ukládám do Content Registry (published):')
  const results: string[] = []
  results.push(await setPublished('homepage.hero.title', t.heroTitle) ? 'homepage.hero.title' : '')
  results.push(await setPublished('homepage.hero.subtitle', t.heroSubtitle) ? 'homepage.hero.subtitle' : '')
  results.push(await setPublished('homepage.services.items', t.services) ? 'homepage.services.items' : '')
  results.push(await setPublished('homepage.about.text', t.aboutText) ? 'homepage.about.text' : '')
  await syncCompanyProfile(t.street)
  results.push('company.street')

  console.log('  ✓ ' + results.filter(Boolean).join(', '))
  console.log('\nHotovo. Texty jsou nyní editovatelné v adminu (Obsah / Kontaktní údaje)')
  console.log('a po publikování se promítnou na web.webdo24.cz/pavel-dousa-elektroinstalace.')
}

main().catch((err) => {
  console.error('CHYBA:', err)
  process.exit(1)
})
