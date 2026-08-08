// GET /api/v1/publications?projectId= – historie změn (§9)
import { NextResponse } from 'next/server'
import { listPublications } from '@/lib/ccc/publish'
import { cccErrorResponse } from '@/lib/ccc/http'

export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json(
        { error: 'bad_request', message: 'Chybí query parametr projectId' },
        { status: 400 },
      )
    }

    const publications = await listPublications(projectId)
    return NextResponse.json({ publications })
  } catch (err) {
    return cccErrorResponse(err)
  }
}
