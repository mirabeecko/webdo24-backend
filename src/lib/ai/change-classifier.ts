// Lightweight rule-based change classifier.
// Cíl: rychle (bez LLM volání) odhadnout kategorii požadavku,
// aby AI workflow věděl, jakým směrem requesty směrovat.
//
// Pro produkci tohle bude doplněno o LLM klasifikátor (Claude haiku / GPT mini)
// — tady drží jen baseline, na který se dá fallbackovat při AI outage.

import type { ChangeCategory } from '@/types'

type ClassifyResult = {
  category: ChangeCategory
  confidence: number       // 0–1
  reason: string           // proč padla tato kategorie (debug)
}

const PATTERNS: Array<{ category: ChangeCategory; weight: number; rx: RegExp; label: string }> = [
  // TRIVIAL – jednoslovné fakty: cena, telefon, mail, otevírací doba, jméno
  { category: 'trivial', weight: 0.92, rx: /\b(cen[au]|cenu|cenu na|stojí|kč|korun)\b/i, label: 'cena' },
  { category: 'trivial', weight: 0.9,  rx: /\b(telefon|číslo|mobil)\b/i, label: 'telefon' },
  { category: 'trivial', weight: 0.9,  rx: /\b(e?-?mail|emailov|@)\b/i, label: 'email' },
  { category: 'trivial', weight: 0.88, rx: /\b(otevírací doba|otevřeno|otvírací)\b/i, label: 'otvírací doba' },
  { category: 'trivial', weight: 0.85, rx: /\b(adres[au]|sídlo|provozov)\b/i, label: 'adresa' },

  // MEDIA – fotky, obrázky, galerie
  { category: 'media',   weight: 0.9,  rx: /\b(fot[okay]|obrázek|obrázk[uy]|galeri|hero foto|nahrá[tjť])\b/i, label: 'media' },

  // DESIGN – barvy, font, vzhled
  { category: 'design',  weight: 0.88, rx: /\b(barv[auy]|font|písmo|design|vzhled|modernější|elegantní|odvážn)\b/i, label: 'design' },

  // STRUCTURE – sekce, formulář, blok
  { category: 'structure', weight: 0.82, rx: /\b(přidej|odeber|nová sekce|kontaktní formulář|blok|sekci|sekce)\b/i, label: 'sekce' },

  // PAGE – nová stránka, blog, anglická verze
  { category: 'page',    weight: 0.85, rx: /\b(nová stránka|blog|anglickou? verzi|překlad|více ?jazyč)\b/i, label: 'page' },

  // SEO
  { category: 'content', weight: 0.7,  rx: /\b(seo|google|klíčov[áé] slov|titulek|meta)\b/i, label: 'seo/content' },

  // CONTENT – texty obecně
  { category: 'content', weight: 0.6,  rx: /\b(text|popis|nadpis|hero text|úvod|hlavičk[au]|přepiš|zkrať|rozšiř)\b/i, label: 'text' },

  // HEAVY – rebrand, e-shop, kompletní změny
  { category: 'heavy',   weight: 0.95, rx: /\b(rebrand|kompletní změna|úplně nov|e-?shop|booking)\b/i, label: 'heavy' },
]

export function classifyChangeRequest(input: string): ClassifyResult {
  const text = input.trim()
  if (!text) {
    return { category: 'unknown', confidence: 0, reason: 'empty input' }
  }

  // Spočti score per kategorii (víc patternů zvyšuje sebejistotu)
  const scores = new Map<ChangeCategory, { weight: number; hits: string[] }>()
  for (const p of PATTERNS) {
    if (p.rx.test(text)) {
      const cur = scores.get(p.category) ?? { weight: 0, hits: [] }
      cur.weight = Math.max(cur.weight, p.weight)
      cur.hits.push(p.label)
      scores.set(p.category, cur)
    }
  }

  if (scores.size === 0) {
    return { category: 'content', confidence: 0.35, reason: 'fallback to content' }
  }

  // Pravidla rozhodování – některé kategorie přebíjejí ostatní
  const priority: ChangeCategory[] = ['heavy', 'page', 'structure', 'design', 'media', 'trivial', 'content']
  for (const cat of priority) {
    const s = scores.get(cat)
    if (s) {
      return {
        category: cat,
        confidence: Math.min(0.99, s.weight + (s.hits.length - 1) * 0.03),
        reason: s.hits.join(', '),
      }
    }
  }

  return { category: 'unknown', confidence: 0.2, reason: 'no rule matched' }
}
