import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { customer_email, project_id, product_id } = body

    const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
    let priceId: string | undefined
    let productName = 'Webdo24 upgrade'
    let mode: 'payment' | 'subscription' = 'payment'

    if (product_id) {
      // Dynamický produkt z DB
      const admin = createAdminClient()
      const { data: product } = await admin
        .from('webdo24_products')
        .select('name, stripe_price_id, billing_type')
        .eq('id', product_id)
        .single()

      if (!product?.stripe_price_id) {
        return NextResponse.json({ error: 'Produkt nemá nastavený Stripe Price ID' }, { status: 400 })
      }
      priceId = product.stripe_price_id
      productName = product.name
      mode = product.billing_type === 'monthly' || product.billing_type === 'yearly' ? 'subscription' : 'payment'
    } else {
      // Fallback na legacy Conversion Pro Pack
      priceId = process.env.STRIPE_PRICE_UPSELL_900
      if (!priceId) {
        return NextResponse.json({ error: 'Missing STRIPE_PRICE_UPSELL_900' }, { status: 500 })
      }
    }

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode,
      payment_method_types: ['card', 'sepa_debit', 'eps', 'klarna'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        source: 'webdo24_upsell',
        project_id: project_id ?? '',
        product_id: product_id ?? '',
      },
      success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/payment/cancel`,
      ...(customer_email ? { customer_email } : {}),
    }

    if (mode === 'payment') {
      sessionParams.expires_at = Math.floor(Date.now() / 1000) + 30 * 60
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[create-upsell-session]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
