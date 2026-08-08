// GET /api/v1/pages/{pageId}/content – registry pole + published hodnoty (§9)
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPageContent } from '@/lib/ccc/registry'
import { cccErrorResponse } from '@/lib/ccc/http'
import { GuardError } from '@/lib/ccc/guard'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  try {
    const { pageId } = await params

    const admin = createAdminClient()
    const { data: page, error } = await admin
      .from('webdo24_pages')
      .select('project_id, slug')
      .eq('id', pageId)
      .maybeSingle()

    if (error || !page) throw new GuardError('not_found', 'Stránka nenalezena')

    // guard + obsah (pole stránky včetně globálních, join published hodnot)
    const content = await getPageContent(
      page.project_id as string,
      page.slug as string,
    )
    return NextResponse.json(content)
  } catch (err) {
    return cccErrorResponse(err)
  }
}
