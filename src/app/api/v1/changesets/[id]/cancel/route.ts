// POST /api/v1/changesets/{id}/cancel – zrušení draftu (§3.4)
import { NextResponse } from 'next/server'
import { cancelChangeSet } from '@/lib/ccc/changesets'
import { cccErrorResponse } from '@/lib/ccc/http'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const result = await cancelChangeSet(id)
    return NextResponse.json(result)
  } catch (err) {
    return cccErrorResponse(err)
  }
}
