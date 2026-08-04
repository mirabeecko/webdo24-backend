// Client-safe — no server imports

export type IntentCategory =
  | 'content'
  | 'design'
  | 'media'
  | 'seo'
  | 'form'
  | 'service'
  | 'booking'
  | 'page'
  | 'integration'
  | 'heavy'

export interface PolicyResult {
  category: IntentCategory
  allowed: boolean
  confidence: number
  upsell?: {
    title: string
    description: string
    product_key: string
    cta: string
  }
}

const PLAN_ALLOWED: Record<string, IntentCategory[]> = {
  start: ['content', 'media', 'seo', 'service'],
  pro: ['content', 'design', 'media', 'seo', 'form', 'service', 'booking', 'integration'],
  elite: ['content', 'design', 'media', 'seo', 'form', 'service', 'booking', 'page', 'integration', 'heavy'],
}

const UPSELL_BY_CATEGORY: Partial<Record<IntentCategory, PolicyResult['upsell']>> = {
  booking: {
    title: 'Rezervační systém',
    description: 'Zákazníci si rezervují termíny přímo z webu. Automatické potvrzení emailem, žádné telefonáty.',
    product_key: 'rezervace',
    cta: 'Aktivovat rezervace',
  },
  form: {
    title: 'Pokročilé formuláře',
    description: 'Vlastní poptávkové formuláře s podmíněnými poli a okamžitou emailovou notifikací.',
    product_key: 'form',
    cta: 'Přidat formuláře',
  },
  page: {
    title: 'Nové stránky',
    description: 'Blog, landing pages nebo podstránky pro každou službu. Víc obsahu = víc Google.',
    product_key: 'blog-ai',
    cta: 'Přidat stránky',
  },
  design: {
    title: 'Designový upgrade',
    description: 'Přizpůsobte barvy, písma a rozvržení přesně vaší značce.',
    product_key: 'design',
    cta: 'Upgradovat design',
  },
  heavy: {
    title: 'Individuální redesign',
    description: 'Kompletní přestavba webu na míru. Nezávazná konzultace zdarma.',
    product_key: 'vip-sprava',
    cta: 'Domluvit konzultaci',
  },
  integration: {
    title: 'Integrace nástrojů',
    description: 'Google Analytics, Facebook Pixel, CRM a desítky dalších nástrojů.',
    product_key: 'google-profil',
    cta: 'Aktivovat integrace',
  },
}

const KEYWORD_MAP: Array<{ category: IntentCategory; terms: string[] }> = [
  { category: 'booking', terms: ['rezervac', 'termín', 'kalendář', 'booking', 'objednávk', 'schůzk', 'appointment'] },
  { category: 'form', terms: ['formulář', 'poptávkový formulář', 'kontaktní formulář', 'přidat formulář'] },
  { category: 'page', terms: ['stránk', 'blog', 'článek', 'o nás', 'podstránk', 'nová sekce', 'landing page', 'galerie'] },
  { category: 'heavy', terms: ['redesign', 'přestavět', 'kompletně', 'celý web', 'nový web', 'přepracovat celý'] },
  { category: 'integration', terms: ['google analyt', 'facebook pixel', 'instagram', 'crm', 'propoj', 'integrac'] },
  { category: 'design', terms: ['barv', 'font', 'písmo', 'vzhled', 'design', 'layout', 'rozvržen', 'styl web'] },
  { category: 'seo', terms: ['seo', 'vyhledáváč', 'google vyhledávání', 'meta', 'klíčová slova', 'popis stránky', 'optimalizac'] },
  { category: 'media', terms: ['foto', 'obrázek', 'video', 'galerie', 'snímek', 'fotografie', 'banner', 'nahrát'] },
  { category: 'service', terms: ['služb', 'přidat produkt', 'přidat službu', 'nová služba', 'ceník', 'cen'] },
]

export function classifyIntent(input: string): IntentCategory {
  const lower = input.toLowerCase()
  for (const { category, terms } of KEYWORD_MAP) {
    if (terms.some((t) => lower.includes(t))) return category
  }
  return 'content'
}

export function evaluatePolicy(input: string, planTier: string = 'start'): PolicyResult {
  const category = classifyIntent(input)
  const allowed = (PLAN_ALLOWED[planTier] ?? PLAN_ALLOWED.start).includes(category)
  return {
    category,
    allowed,
    confidence: 0.8,
    upsell: allowed
      ? undefined
      : (UPSELL_BY_CATEGORY[category] ?? {
          title: 'Funkce není v plánu',
          description: 'Tato funkce je dostupná v pokročilejším plánu.',
          product_key: 'upgrade',
          cta: 'Zobrazit plány',
        }),
  }
}
