import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'

/**
 * MIL-138.1 — Hosting + Maintenance billing
 *
 * POST /api/stripe/create-hosting-session
 * Body:
 *   - product: 'hosting' | 'maintenance' | 'bundle'
 *   - customer_email?: string
 *   - project_id?: string
 *   - success_url?: string
 *   - cancel_url?: string
 *
 * Creates a Stripe Checkout session for yearly hosting/maintenance subscription.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { product, customer_email, project_id, success_url, cancel_url } = body

    const appUrl = process.env.APP_URL ?? 'http://localhost:3000'

    // Map product to Stripe Price ID
    const priceMap: Record<string, string | undefined> = {
      hosting: process.env.STRIPE_PRICE_HOSTING_YEARLY,
      maintenance: process.env.STRIPE_PRICE_MAINTENANCE_YEARLY,
      bundle: process.env.STRIPE_PRICE_BUNDLE_YEARLY,
    }

    // Default to bundle if not specified or invalid
    const productKey = product && priceMap[product] ? product : 'hosting'
    const priceId = priceMap[productKey]

    if (!priceId) {
      return NextResponse.json(
        { error: `Missing Stripe Price ID for product: ${productKey}` },
        { status: 500 },
      )
    }

    const productLabels: Record<string, string> = {
      hosting: 'WEBDO24 Hosting — roční (2 490 Kč)',
      maintenance: 'WEBDO24 Maintenance — roční (4 900 Kč)',
      bundle: 'WEBDO24 Hosting + Maintenance — roční (7 390 Kč)',
    }

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: 'subscription',
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,

      payment_method_types: ['card'],

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      metadata: {
        source: 'webdo24_hosting',
        product: productKey,
        project_id: project_id || '',
      },

      subscription_data: {
        metadata: {
          product: productKey,
          source: 'webdo24_hosting',
        },
      },

      success_url:
        success_url || `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&product=${productKey}`,
      cancel_url:
        cancel_url || `${appUrl}/payment/cancel?product=${productKey}`,

      ...(customer_email ? { customer_email } : {}),
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
      product: productKey,
      label: productLabels[productKey],
    })
  } catch (err) {
    console.error('[create-hosting-session]', err)

    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
