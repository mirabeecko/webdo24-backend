// POST /api/v1/changesets/{id}/approve – preview_ready → approved (§5.2)
import { NextResponse } from 'next/server'
import { approveChangeSet } from '@/lib/ccc/publish'
import { cccErrorResponse } from '@/lib/ccc/http'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const result = await approveChangeSet(id)
    return NextResponse.json(result)
  } catch (err) {
    return cccErrorResponse(err)
  }
}
