import { NextResponse } from 'next/server'
import { runHealthCheck } from '@/lib/website-connection/connect'

// GET /api/v1/sites/{site_id}/health — stav propojení
export async function GET(_request: Request, { params }: { params: Promise<{ site_id: string }> }) {
  const { site_id } = await params
  const result = await runHealthCheck(site_id)
  const statusCode = result.status === 'OFFLINE' ? 503 : result.status === 'DEGRADED' ? 200 : 200
  return NextResponse.json({ site_id, ...result }, { status: statusCode })
}
