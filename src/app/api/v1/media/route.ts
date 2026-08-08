// POST /api/v1/media – upload (multipart FormData, §7)
// GET  /api/v1/media?projectId=&category= – seznam assetů (§9)
import { NextResponse } from 'next/server'
import { listMediaAssets, uploadMediaAsset } from '@/lib/ccc/media'
import { cccErrorResponse } from '@/lib/ccc/http'
import type { MediaCategory } from '@/types/website-contract'

const CATEGORIES: readonly MediaCategory[] = [
  'photo',
  'logo',
  'gallery',
  'product',
  'document',
  'video',
]

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const projectId = formData.get('project_id')
    const category = formData.get('category')
    const altText = formData.get('alt_text')

    if (!(file instanceof File) || typeof projectId !== 'string' || !projectId) {
      return NextResponse.json(
        { error: 'bad_request', message: 'Vyžadováno: file, project_id (multipart)' },
        { status: 400 },
      )
    }

    const asset = await uploadMediaAsset({
      projectId,
      file,
      category: CATEGORIES.includes(category as MediaCategory)
        ? (category as MediaCategory)
        : undefined,
      altText: typeof altText === 'string' && altText ? altText : undefined,
    })

    return NextResponse.json(asset, { status: 201 })
  } catch (err) {
    return cccErrorResponse(err)
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const projectId = url.searchParams.get('projectId')
    const category = url.searchParams.get('category')

    if (!projectId) {
      return NextResponse.json(
        { error: 'bad_request', message: 'Chybí query parametr projectId' },
        { status: 400 },
      )
    }

    const assets = await listMediaAssets(
      projectId,
      CATEGORIES.includes(category as MediaCategory)
        ? (category as MediaCategory)
        : undefined,
    )
    return NextResponse.json({ assets })
  } catch (err) {
    return cccErrorResponse(err)
  }
}
