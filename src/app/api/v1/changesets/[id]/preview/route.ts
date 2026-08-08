// POST /api/v1/changesets/{id}/preview – validace + signed preview URL (§6)
import { NextResponse } from 'next/server'
import { requestPreview } from '@/lib/ccc/preview'
import { cccErrorResponse } from '@/lib/ccc/http'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const preview = await requestPreview(id)
    return NextResponse.json(preview)
  } catch (err) {
    return cccErrorResponse(err)
  }
}
