// ============================================
// Discovery — detekce frameworku, obsahu a formulářů webu
// Pracuje na lokální cestě (pokud backend běží ve stejném prostředí)
// nebo vrací heuristiku z poskytnutých metadat.
// ============================================

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { DiscoveredContent, DiscoveredForm, DiscoveryResult, FormFieldSchema } from '@/types/website-connection'

const MAX_SCAN_FILES = 400

function safeRead(p: string): string {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}

// --------------------------------------------------------------
// Framework
// --------------------------------------------------------------

export interface FrameworkInfo {
  framework: string
  package_manager: string | null
  build_script: string | null
  deploy_target: string | null
}

export function detectFramework(path: string): FrameworkInfo {
  const pkgPath = join(path, 'package.json')
  const pkgRaw = safeRead(pkgPath)
  let framework = 'HTML'
  let buildScript: string | null = null
  let deployTarget: string | null = null

  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw)
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
      if (deps.next) framework = 'Next.js'
      else if (deps.nuxt) framework = 'Nuxt'
      else if (deps.astro) framework = 'Astro'
      else if (deps.svelte || deps['@sveltejs/kit']) framework = 'SvelteKit'
      else if (deps.react) framework = 'React'
      else if (deps.vue) framework = 'Vue'
      else if (deps.vite) framework = 'Vite'
      buildScript = pkg.scripts?.build || pkg.scripts?.generate || null
    } catch {
      /* ignore */
    }
  }
  if (framework === 'HTML' && existsSync(join(path, 'wp-config.php'))) framework = 'WordPress'
  if (framework === 'HTML' && existsSync(join(path, 'index.php'))) framework = 'PHP'
  if (framework === 'HTML' && !existsSync(join(path, 'index.html')) && existsSync(join(path, 'app'))) framework = 'Unknown SPA'

  const packageManager = existsSync(join(path, 'pnpm-lock.yaml'))
    ? 'pnpm'
    : existsSync(join(path, 'yarn.lock'))
      ? 'yarn'
      : existsSync(join(path, 'package-lock.json'))
        ? 'npm'
        : null

  if (existsSync(join(path, 'vercel.json'))) deployTarget = 'Vercel'
  else if (existsSync(join(path, 'netlify.toml'))) deployTarget = 'Netlify'
  else if (existsSync(join(path, 'CNAME'))) deployTarget = 'GitHub Pages / static'

  return { framework, package_manager: packageManager, build_script: buildScript, deploy_target: deployTarget }
}

// --------------------------------------------------------------
// Scan souborů
// --------------------------------------------------------------

const CONTENT_EXTS = ['.html', '.htm', '.tsx', '.jsx', '.vue', '.svelte', '.php', '.astro']

function* walk(dir: string, depth = 0): Generator<string> {
  if (depth > 6) return
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.git' || e === '.next' || e === 'dist' || e === 'build') continue
    const full = join(dir, e)
    let isDir = false
    try {
      isDir = statSync(full).isDirectory()
    } catch {
      continue
    }
    if (isDir) {
      yield* walk(full, depth + 1)
    } else if (CONTENT_EXTS.some((ext) => full.endsWith(ext))) {
      yield full
    }
  }
}

// --------------------------------------------------------------
// Forms
// --------------------------------------------------------------

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function discoverForms(path: string): DiscoveredForm[] {
  const forms: DiscoveredForm[] = []
  let count = 0
  for (const file of walk(path)) {
    if (count++ > MAX_SCAN_FILES) break
    const text = safeRead(file)
    const formRe = /<form[^>]*>/g
    let m: RegExpExecArray | null
    while ((m = formRe.exec(text)) !== null) {
      const tag = m[0]
      const idMatch = tag.match(/id=["']([^"']+)["']/)
      const nameMatch = tag.match(/name=["']([^"']+)["']/)
      const formId = idMatch?.[1] || nameMatch?.[1] || slugify('form-' + (forms.length + 1))
      // pole z atributů name uvnitř následujícího bloku (až po </form>)
      const after = text.slice(m.index)
      const end = after.indexOf('</form>')
      const block = end >= 0 ? after.slice(0, end) : after.slice(0, 3000)
      const fields: FormFieldSchema[] = []
      const fieldRe = /<(input|textarea|select)[^>]*name=["']([^"']+)["'][^>]*>/g
      let fm: RegExpExecArray | null
      while ((fm = fieldRe.exec(block)) !== null) {
        const typeMatch = fm[0].match(/type=["']([^"']+)["']/)
        const ftype = typeMatch?.[1] || 'text'
        fields.push({
          key: fm[2],
          label: fm[2].replace(/[-_]/g, ' '),
          type: ftype === 'email' ? 'email' : ftype === 'tel' || ftype === 'phone' ? 'phone' : ftype === 'textarea' ? 'textarea' : ftype === 'number' ? 'number' : ftype === 'select' ? 'select' : ftype === 'checkbox' ? 'checkbox' : 'text',
          required: /required/i.test(fm[0]),
        })
      }
      forms.push({
        form_id: formId,
        name: formId.replace(/[-_]/g, ' '),
        source_path: file.replace(path + '/', ''),
        fields,
      })
    }
  }
  return forms
}

// --------------------------------------------------------------
// Content (standardní schéma + heuristické hodnoty z HTML)
// --------------------------------------------------------------

export function discoverContent(path: string): DiscoveredContent[] {
  const content: DiscoveredContent[] = [
    { field_key: 'hero.title', label: 'Hlavní nadpis (Hero)', field_type: 'text' },
    { field_key: 'hero.subtitle', label: 'Podnadpis', field_type: 'textarea' },
    { field_key: 'about.text', label: 'Text o nás', field_type: 'textarea' },
    { field_key: 'services.items', label: 'Služby', field_type: 'repeater' },
    { field_key: 'contact.phone', label: 'Telefon', field_type: 'phone' },
    { field_key: 'contact.email', label: 'E-mail', field_type: 'email' },
    { field_key: 'contact.address', label: 'Adresa', field_type: 'text' },
    { field_key: 'seo.title', label: 'SEO titulek', field_type: 'text' },
    { field_key: 'seo.description', label: 'SEO popis', field_type: 'textarea' },
  ]

  // Heuristická extrakce z HTML souborů (h1, title, meta description, tel:)
  for (const file of walk(path)) {
    if (!file.endsWith('.html') && !file.endsWith('.htm')) continue
    const text = safeRead(file)
    const h1 = text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    if (h1) {
      const hero = content.find((c) => c.field_key === 'hero.title')
      if (hero) hero.value = h1.replace(/<[^>]+>/g, '').trim()
    }
    const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    if (title) {
      const seo = content.find((c) => c.field_key === 'seo.title')
      if (seo) seo.value = title.trim()
    }
    const desc = text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
    if (desc) {
      const seoD = content.find((c) => c.field_key === 'seo.description')
      if (seoD) seoD.value = desc.trim()
    }
    const phone = text.match(/href=["']tel:([^"']+)["']/i)?.[1]
    if (phone) {
      const cp = content.find((c) => c.field_key === 'contact.phone')
      if (cp) cp.value = phone.trim()
    }
    const email = text.match(/href=["']mailto:([^"']+)["']/i)?.[1]
    if (email) {
      const ce = content.find((c) => c.field_key === 'contact.email')
      if (ce) ce.value = email.trim()
    }
    break // stačí první HTML stránka (homepage)
  }

  return content
}

// --------------------------------------------------------------

export function runDiscovery(path: string | null): DiscoveryResult {
  const warnings: string[] = []
  if (!path || !existsSync(path)) {
    return { framework: 'Unknown', package_manager: null, build_script: null, deploy_target: null, content: [], forms: [], warnings: ['Lokální cesta neexistuje nebo není přístupná'] }
  }
  const fw = detectFramework(path)
  const content = discoverContent(path)
  const forms = discoverForms(path)
  if (forms.length === 0) warnings.push('Nebyly nalezeny žádné <form> prvky — formuláře lze přidat ručně')
  if (fw.framework === 'Unknown' || fw.framework === 'Unknown SPA') warnings.push('Framework nebylo možné jednoznačně určit')
  return { framework: fw.framework, package_manager: fw.package_manager, build_script: fw.build_script, deploy_target: fw.deploy_target, content, forms, warnings }
}
