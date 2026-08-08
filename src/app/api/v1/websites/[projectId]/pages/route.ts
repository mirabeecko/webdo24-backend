// GET /api/v1/websites/{projectId}/pages – stránky webu (§9)
import { NextResponse } from 'next/server'
import { listPages } from '@/lib/ccc/registry'
import { cccErrorResponse } from '@/lib/ccc/http'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params
    const pages = await listPages(projectId)
    return NextResponse.json({ pages })
  } catch (err) {
    return cccErrorResponse(err)
  }
}
