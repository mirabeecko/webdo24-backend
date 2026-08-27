import { NextResponse } from 'next/server'
import { getPublicStoredForm } from '@/lib/sales-store'

/**
 * Public GET: definice formuláře pro veřejnou stránku /f/[id].
 * Vrací jen aktivní formulář (jméno, popis, pole) — žádné citlivé údaje.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: formId } = await params
  const form = await getPublicStoredForm(formId)
  if (!form) {
    return NextResponse.json({ error: 'Formulář neexistuje' }, { status: 404 })
  }
  return NextResponse.json({ form })
}
