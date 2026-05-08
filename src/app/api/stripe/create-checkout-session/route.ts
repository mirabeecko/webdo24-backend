import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    const priceId = process.env.STRIPE_PRICE_MONTHLY_1990
    const appUrl = process.env.APP_URL

    if (!priceId) {
      return NextResponse.json(
        { error: 'Missing STRIPE_PRICE_MONTHLY_1990' },
        { status: 500 }
      )
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
	expires_at: Math.floor(Date.now() / 1000) + (30 * 60),

      payment_method_types: ['card'],

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      metadata: {
        source: 'webdo24',
        project_id: body.project_id || '',
      },

      subscription_data: {
        metadata: {
          commitment: '12_months',
          monthly_price: '1990',
        },
      },

      success_url:
        `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        `${appUrl}/payment/cancel`,
    })

    return NextResponse.json({
      url: session.url,
    })
  } catch (err) {
    console.error(err)

    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
