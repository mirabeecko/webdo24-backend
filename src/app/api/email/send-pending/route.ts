import { NextResponse } from 'next/server'
import { sendPendingEmails } from '@/lib/email/sender'

/**
 * Worker endpoint for sending queued emails.
 * Call this from n8n / Supabase Cron / any scheduler with:
 *   Authorization: Bearer <INTERNAL_EMAIL_WORKER_TOKEN>
 */
export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const expectedToken = process.env.INTERNAL_EMAIL_WORKER_TOKEN

  if (!expectedToken) {
    return NextResponse.json(
      { error: 'INTERNAL_EMAIL_WORKER_TOKEN not configured' },
      { status: 500 }
    )
  }

  if (!token || token !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const result = await sendPendingEmails(limit)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[email/send-pending]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
