import { NextResponse } from 'next/server'
import { getContentBySiteId } from '@/lib/website-connection/content'

// GET /api/v1/sites/{site_id}/content — publikovaný obsah webu (public read)
export async function GET(_request: Request, { params }: { params: Promise<{ site_id: string }> }) {
  const { site_id } = await params
  const result = await getContentBySiteId(site_id)
  if (!result) {
    return NextResponse.json({ error: 'site_not_found' }, { status: 404 })
  }
  return NextResponse.json({
    site_id,
    version: result.version,
    updated_at: new Date().toISOString(),
    content: result.content,
  })
}
