import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Health check — pro monitoring (UptimeRobot, cron, Caddy).
 * GET /api/health → 200 { status, db, time } | 503 když DB neodpovídá.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const started = Date.now()
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('webdo24_projects').select('id', { head: true, count: 'planned' }).limit(1)
    if (error) throw error
    return NextResponse.json(
      {
        status: 'ok',
        service: 'webdo24-backend',
        db: 'ok',
        time_ms: Date.now() - started,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      {
        status: 'degraded',
        service: 'webdo24-backend',
        db: 'error',
        error: message,
        time_ms: Date.now() - started,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}
