import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Public GET: definice formuláře pro veřejnou stránku /f/[id].
 * Vrací jen aktivní formulář (jméno, popis, pole) — žádné citlivé údaje.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: formId } = await params
  const admin = createAdminClient()
  const { data: form } = await admin
    .from('webdo24_forms')
    .select('id, name, description, fields, submit_button, success_message, status')
    .eq('id', formId)
    .eq('status', 'active')
    .maybeSingle()

  if (!form) {
    return NextResponse.json({ error: 'Formulář neexistuje' }, { status: 404 })
  }
  return NextResponse.json({ form })
}
