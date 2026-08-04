import { createAdminClient } from '@/lib/supabase/admin'

interface WebhookPayload {
  to: string
  to_name?: string | null
  subject: string
  html: string
  text: string
  metadata: Record<string, unknown>
}

/**
 * Send a single queued email via the configured n8n email routing webhook.
 * Returns true if the provider accepted the request.
 */
export async function sendEmailById(id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient()
  const webhookUrl = process.env.N8N_EMAIL_ROUTING_WEBHOOK_URL

  const { data: email } = await admin
    .from('webdo24_email_queue')
    .select('*')
    .eq('id', id)
    .single()

  if (!email) return { ok: false, error: 'email_not_found' }
  if (email.status === 'sent') return { ok: true }
  if (email.status === 'cancelled') return { ok: false, error: 'cancelled' }

  // Mark as processing
  await admin
    .from('webdo24_email_queue')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', id)

  // If no webhook configured, keep pending so a worker can retry later
  if (!webhookUrl) {
    await admin
      .from('webdo24_email_queue')
      .update({
        status: 'pending',
        retry_count: (email.retry_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    return { ok: false, error: 'missing_webhook_url' }
  }

  try {
    const payload: WebhookPayload = {
      to: email.to_email,
      to_name: email.to_name,
      subject: email.subject,
      html: email.html_body,
      text: email.text_body,
      metadata: email.metadata || {},
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) {
      throw new Error(`webhook_status_${res.status}`)
    }

    await admin
      .from('webdo24_email_queue')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        provider_response: { status: res.status, ok: true },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const retryCount = (email.retry_count || 0) + 1
    const nextStatus = retryCount >= 5 ? 'failed' : 'pending'
    const failedAt = nextStatus === 'failed' ? new Date().toISOString() : null

    await admin
      .from('webdo24_email_queue')
      .update({
        status: nextStatus,
        retry_count: retryCount,
        provider_response: { error: message },
        ...(failedAt ? { failed_at: failedAt } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return { ok: false, error: message }
  }
}

/**
 * Process pending emails that are scheduled for now or earlier.
 * Intended to be called by a cron job / n8n scheduler.
 */
export async function sendPendingEmails(limit = 50): Promise<{ processed: number; failed: number }> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: emails } = await admin
    .from('webdo24_email_queue')
    .select('id')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .order('created_at', { ascending: true })
    .limit(limit)

  let processed = 0
  let failed = 0

  for (const email of emails || []) {
    const result = await sendEmailById(email.id)
    if (result.ok) {
      processed++
    } else {
      failed++
    }
  }

  return { processed, failed }
}
