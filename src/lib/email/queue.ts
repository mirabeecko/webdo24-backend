'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getTemplate } from './templates'
import type { EmailTemplateKey, QueuedEmail } from './types'

/**
 * Queue an email to be sent asynchronously.
 * Prefer using this helper from server actions instead of calling the sender
 * directly — it decouples business logic from email delivery and makes
 * retries / debugging easier.
 */
export async function queueEmail(opts: QueuedEmail): Promise<{ ok: true; id: string }> {
  const admin = createAdminClient()
  const template = getTemplate(opts.templateKey)

  const htmlBody = template.html(opts.metadata || {})
  const textBody = template.text(opts.metadata || {})

  const { data, error } = await admin.from('webdo24_email_queue').insert({
    customer_id: opts.customerId,
    to_email: opts.toEmail,
    to_name: opts.toName || null,
    template_key: opts.templateKey,
    subject: template.subject,
    html_body: htmlBody,
    text_body: textBody,
    metadata: opts.metadata || {},
    status: 'pending',
    scheduled_for: opts.scheduledFor?.toISOString() || new Date().toISOString(),
  }).select('id').single()

  if (error || !data) {
    console.error('[queueEmail] failed:', error)
    throw new Error(error?.message || 'queue_email_failed')
  }

  return { ok: true, id: data.id }
}

/**
 * Helper: queue email for a customer by ID.
 * Loads customer email/name automatically.
 */
export async function queueEmailToCustomer(
  customerId: string,
  templateKey: EmailTemplateKey,
  metadata?: Record<string, unknown>
): Promise<{ ok: true; id: string } | null> {
  const admin = createAdminClient()

  const { data: customer } = await admin
    .from('webdo24_customers')
    .select('id, email, name')
    .eq('id', customerId)
    .single()

  if (!customer?.email) {
    console.warn('[queueEmailToCustomer] customer or email not found:', customerId)
    return null
  }

  // Respect email preferences unless this is a critical transactional email
  const criticalTemplates: EmailTemplateKey[] = [
    'payment_success',
    'payment_failed',
    'invoice_created',
    'invoice_paid',
    'hosting_expiring_soon',
    'hosting_expired',
    'hosting_renewed',
  ]

  if (!criticalTemplates.includes(templateKey)) {
    const { data: prefs } = await admin
      .from('webdo24_customer_email_prefs')
      .select('notifications_enabled')
      .eq('customer_id', customerId)
      .single()

    if (prefs?.notifications_enabled === false) {
      return null
    }
  }

  return queueEmail({
    customerId: customer.id,
    toEmail: customer.email,
    toName: customer.name,
    templateKey,
    metadata,
  })
}

/**
 * Helper: queue email to the admin team.
 */
export async function queueEmailToAdmin(
  templateKey: EmailTemplateKey,
  metadata?: Record<string, unknown>
): Promise<{ ok: true; id: string }> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@webdo24.cz'
  return queueEmail({
    customerId: null,
    toEmail: adminEmail,
    toName: 'WEBDO24 Admin',
    templateKey,
    metadata,
  })
}
