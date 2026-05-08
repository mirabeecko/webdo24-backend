import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  try {
    console.log('STRIPE EVENT:', event.type)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      console.log('CHECKOUT SESSION:', {
        id: session.id,
        customer: session.customer,
        subscription: session.subscription,
        email: session.customer_details?.email,
        metadata: session.metadata,
      })

      const stripeCustomerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id

      const stripeSubscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

      console.log('EXTRACTED IDS:', {
        stripeCustomerId,
        stripeSubscriptionId,
        email: session.customer_details?.email,
      })

      if (stripeCustomerId && stripeSubscriptionId && session.customer_details?.email) {
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)

        const updateData: Record<string, unknown> = {
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          subscription_status: subscription.status,
        }

        const { data, error } = await admin
          .from('webdo24_customers')
          .update(updateData)
          .eq('email', session.customer_details.email)
          .select()

        console.log('SUPABASE UPDATE RESULT:', { data, error })
      } else {
        console.log('MISSING DATA FOR UPDATE')
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice

      const stripeCustomerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

      if (stripeCustomerId) {
        const { data, error } = await admin
          .from('webdo24_customers')
          .update({ subscription_status: 'active' })
          .eq('stripe_customer_id', stripeCustomerId)
          .select()

        console.log('INVOICE PAID UPDATE:', { data, error })
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice

      const stripeCustomerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

      if (stripeCustomerId) {
        const { data, error } = await admin
          .from('webdo24_customers')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', stripeCustomerId)
          .select()

        console.log('PAYMENT FAILED UPDATE:', { data, error })
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription

      const { data, error } = await admin
        .from('webdo24_customers')
        .update({ subscription_status: 'canceled' })
        .eq('stripe_subscription_id', subscription.id)
        .select()

      console.log('SUBSCRIPTION DELETED UPDATE:', { data, error })
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Stripe webhook handler error:', err)

    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
