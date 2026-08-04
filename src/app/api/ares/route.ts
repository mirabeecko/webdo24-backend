import { NextResponse } from 'next/server'

interface AresAddress {
  textovaAdresa?: string
  ulice?: string
  cisloDomovni?: number
  cisloOrientacni?: number
  obec?: string
  psc?: string
}

interface AresResponse {
  ico?: string
  obchodniJmeno?: string
  sidlo?: AresAddress
  pravniForma?: string | { nazev?: string }
  dic?: string
}

function normalizeIco(ico: string): string | null {
  const cleaned = ico.replace(/\s/g, '')
  if (!/^\d{8}$/.test(cleaned)) return null
  return cleaned
}

function formatAddress(sidlo?: AresAddress): string {
  if (!sidlo) return ''
  if (sidlo.textovaAdresa) return sidlo.textovaAdresa

  const parts: string[] = []
  if (sidlo.ulice) {
    const number = [sidlo.cisloDomovni, sidlo.cisloOrientacni]
      .filter(Boolean)
      .join('/')
    parts.push(`${sidlo.ulice} ${number}`)
  }
  if (sidlo.psc) parts.push(sidlo.psc)
  if (sidlo.obec) parts.push(sidlo.obec)
  return parts.join(', ')
}

/**
 * Proxy for ARES (Czech business register).
 * Calls ares.gov.cz server-side to avoid CORS issues in the browser.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawIco = searchParams.get('ico')

  if (!rawIco) {
    return NextResponse.json({ error: 'ico is required' }, { status: 400 })
  }

  const ico = normalizeIco(rawIco)
  if (!ico) {
    return NextResponse.json(
      { error: 'ico must be 8 digits' },
      { status: 400 }
    )
  }

  try {
    const res = await fetch(
      `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      }
    )

    if (res.status === 404) {
      return NextResponse.json(
        { error: 'Company not found in ARES' },
        { status: 404 }
      )
    }

    if (!res.ok) {
      throw new Error(`ARES returned ${res.status}`)
    }

    const data = (await res.json()) as AresResponse

    const pravniForma =
      typeof data.pravniForma === 'string'
        ? data.pravniForma
        : data.pravniForma?.nazev || ''

    return NextResponse.json({
      ico: data.ico || ico,
      name: data.obchodniJmeno || '',
      address: formatAddress(data.sidlo),
      legal_form: pravniForma,
      vat_id: data.dic || '',
    })
  } catch (err) {
    console.error('[ares] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ARES request failed' },
      { status: 500 }
    )
  }
}
