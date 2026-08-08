// POST /api/v1/changesets – vytvoření ChangeSetu {projectId,title,items,source}
// GET  /api/v1/changesets?projectId= – seznam (§9)
import { NextResponse } from 'next/server'
import { createChangeSet, listChangeSets } from '@/lib/ccc/changesets'
import { cccErrorResponse } from '@/lib/ccc/http'
import type { ChangeSetSource } from '@/types/website-contract'

// Z HTTP klienta povolené jen 'gui' | 'api'; 'ai' / 'webdo24' zakládají
// interní procesy (service role / admin role), ne veřejné API.
const ALLOWED_SOURCES: readonly ChangeSetSource[] = ['gui', 'api']

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const projectId = typeof body?.projectId === 'string' ? body.projectId : null
    const title = typeof body?.title === 'string' ? body.title : null
    const source: ChangeSetSource = ALLOWED_SOURCES.includes(body?.source)
      ? body.source
      : 'gui'
    const items = Array.isArray(body?.items)
      ? body.items.filter(
          (i: unknown): i is { fieldKey: string; newValue: unknown } =>
            typeof i === 'object' &&
            i !== null &&
            typeof (i as Record<string, unknown>).fieldKey === 'string' &&
            'newValue' in (i as Record<string, unknown>),
        )
      : null

    if (!projectId || !title || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'bad_request', message: 'Vyžadováno: projectId, title, items[]' },
        { status: 400 },
      )
    }

    const changeset = await createChangeSet({ projectId, title, items, source })
    return NextResponse.json(changeset, { status: 201 })
  } catch (err) {
    return cccErrorResponse(err)
  }
}

export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json(
        { error: 'bad_request', message: 'Chybí query parametr projectId' },
        { status: 400 },
      )
    }

    const changesets = await listChangeSets(projectId)
    return NextResponse.json({ changesets })
  } catch (err) {
    return cccErrorResponse(err)
  }
}
