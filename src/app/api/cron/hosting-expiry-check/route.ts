import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { queueEmail } from '@/lib/email/queue'
import { getTemplate } from '@/lib/email/templates'

/**
 * MIL-138.1 — Hosting expiry check (cron endpoint)
 *
 * GET /api/cron/hosting-expiry-check?secret=<CRON_SECRET>
 *
 * Queries all customers with active hosting subscriptions and
 * sends reminder emails if hosting expires within 30 days.
 *
 * Designed to be called daily by a Hermes cron job.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const results = {
    checked: 0,
    reminders30d: 0,
    reminders7d: 0,
    errors: 0,
    details: [] as string[],
  }

  try {
    // Query all customers with active subscriptions
    const { data: customers, error } = await admin
      .from('webdo24_customers')
      .select('*')
      .in('subscription_status', ['active', 'trialing'])
      .not('current_period_end', 'is', null)

    if (error) {
      throw new Error(`Query failed: ${error.message}`)
    }

    if (!customers || customers.length === 0) {
      return NextResponse.json({
        ...results,
        message: 'No active subscriptions found',
      })
    }

    results.checked = customers.length

    for (const customer of customers as any[]) {
      try {
        const periodEnd = customer.current_period_end
          ? new Date(customer.current_period_end)
          : null

        if (!periodEnd) continue

        const daysUntilExpiry = Math.ceil(
          (periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        )

        // Send reminder at 30 days
        if (daysUntilExpiry <= 30 && daysUntilExpiry > 7) {
          // Check if we already sent a 30-day reminder (avoid duplicates)
          const { data: existing } = await admin
            .from('webdo24_email_queue')
            .select('id')
            .eq('customer_id', customer.id)
            .eq('template_key', 'hosting_expiring_soon')
            .gte('created_at', new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString())
            .limit(1)

          if (!existing || existing.length === 0) {
            await queueEmail({
              customerId: customer.id,
              toEmail: customer.email,
              toName: customer.name,
              templateKey: 'hosting_expiring_soon',
              metadata: {
                customerName: customer.name || customer.email,
                daysLeft: String(daysUntilExpiry),
                expiryDate: periodEnd.toLocaleDateString('cs-CZ'),
              },
            })
            results.reminders30d++
            results.details.push(
              `${customer.email}: 30-day reminder (${daysUntilExpiry} days left)`,
            )
          }
        }

        // Send urgent reminder at 7 days
        if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
          const { data: existing } = await admin
            .from('webdo24_email_queue')
            .select('id')
            .eq('customer_id', customer.id)
            .eq('template_key', 'hosting_expired')
            .gte('created_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .limit(1)

          if (!existing || existing.length === 0) {
            await queueEmail({
              customerId: customer.id,
              toEmail: customer.email,
              toName: customer.name,
              templateKey: 'hosting_expired',
              metadata: {
                customerName: customer.name || customer.email,
                daysLeft: String(daysUntilExpiry),
                expiryDate: periodEnd.toLocaleDateString('cs-CZ'),
              },
            })
            results.reminders7d++
            results.details.push(
              `${customer.email}: 7-day urgent reminder (${daysUntilExpiry} days left)`,
            )
          }
        }
      } catch (customerErr) {
        results.errors++
        results.details.push(
          `Error processing ${customer.email}: ${customerErr instanceof Error ? customerErr.message : String(customerErr)}`,
        )
      }
    }

    return NextResponse.json(results)
  } catch (err) {
    console.error('[hosting-expiry-check]', err)
    return NextResponse.json(
      {
        ...results,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
