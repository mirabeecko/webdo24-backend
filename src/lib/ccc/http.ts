// ============================================
// CCC – HTTP helper pro /api/v1 route handlery
//
// Mapuje typované chyby ccc modulů na HTTP odpovědi:
//   GuardError      → 401 / 403 / 404
//   ValidationError → 422 (seznam chyb pro validační UI)
//   ostatní         → 500
// ============================================

import { NextResponse } from 'next/server'
import { GuardError } from '@/lib/ccc/guard'
import { ValidationError } from '@/lib/ccc/preview'

export function cccErrorResponse(err: unknown): NextResponse {
  if (err instanceof GuardError) {
    const status =
      err.code === 'unauthorized' ? 401 : err.code === 'forbidden' ? 403 : 404
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status },
    )
  }

  if (err instanceof ValidationError) {
    return NextResponse.json(
      { error: 'validation_failed', errors: err.errors },
      { status: 422 },
    )
  }

  console.error('[api/v1] unexpected error:', err)
  return NextResponse.json(
    {
      error: 'internal_error',
      message: err instanceof Error ? err.message : String(err),
    },
    { status: 500 },
  )
}
