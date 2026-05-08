import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Missing stripe_customer_id' },
        { status: 400 }
      )
    }

    const appUrl = process.env.APP_URL

    if (!appUrl) {
      return NextResponse.json(
        { error: 'Missing APP_URL' },
        { status: 500 }
      )
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: body.stripe_customer_id,
      return_url: `${appUrl}/customer`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe customer portal error:', err)

    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
