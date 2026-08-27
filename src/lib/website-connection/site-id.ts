// ============================================
// site_id — veřejný jednoznačný identifikátor webu
// (např. site_7e29ac19). Nezávislý na DB id.
// ============================================

import { randomBytes } from 'node:crypto'

const SITE_ID_RE = /^site_[a-z0-9]{8}$/

/** Vygeneruje nový site_id (8 hex znaků z CSPRNG). */
export function generateSiteId(): string {
  return 'site_' + randomBytes(4).toString('hex')
}

/** Ověří formát site_id. */
export function isValidSiteId(value: string | null | undefined): value is string {
  return typeof value === 'string' && SITE_ID_RE.test(value)
}

/** Normalizuje doménu (odstraní protokol, path, port). */
export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase()
  d = d.replace(/^https?:\/\//, '')
  d = d.split('/')[0]
  d = d.split(':')[0]
  d = d.replace(/^www\./, '')
  return d
}
