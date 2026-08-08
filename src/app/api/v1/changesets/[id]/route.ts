// GET /api/v1/changesets/{id} – detail včetně diffu (§9, §16)
import { NextResponse } from 'next/server'
import { getChangeSet } from '@/lib/ccc/changesets'
import { cccErrorResponse } from '@/lib/ccc/http'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const changeset = await getChangeSet(id)
    if (!changeset) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    return NextResponse.json(changeset)
  } catch (err) {
    return cccErrorResponse(err)
  }
}
