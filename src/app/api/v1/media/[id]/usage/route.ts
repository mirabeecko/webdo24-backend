// GET /api/v1/media/{id}/usage – kde je asset použitý (§9, §3.5)
import { NextResponse } from 'next/server'
import { getMediaAssetUsage } from '@/lib/ccc/media'
import { cccErrorResponse } from '@/lib/ccc/http'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const usage = await getMediaAssetUsage(id)
    return NextResponse.json({ usage })
  } catch (err) {
    return cccErrorResponse(err)
  }
}
