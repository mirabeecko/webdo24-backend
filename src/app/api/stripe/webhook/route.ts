import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'

interface Webdo24Customer {
  id: string
  email: string
  name: string
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  subscription_status?: string | null
  current_period_end?: string | null
  has_pro_pack?: boolean | null
}

interface StripeSubscriptionExtended extends Stripe.Subscription {
  current_period_end?: number
}

function extractStripeId(
  value: string | { id: string } | null | undefined
): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) return value.id
  return null
}

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

      const email = session.customer_details?.email ?? null
      const stripeCustomerId = extractStripeId(session.customer)
      const stripeSubscriptionId = extractStripeId(session.subscription)
      const source = session.metadata?.source || 'webdo24'

      console.log('STRIPE SESSION:', {
        id: session.id,
        mode: session.mode,
        email,
        stripeCustomerId,
        stripeSubscriptionId,
        source,
      })

      if (!email) {
        console.error('MISSING CUSTOMER EMAIL: Cannot create or update customer without email')
        return NextResponse.json({ received: true })
      }

      const { data: existingCustomers, error: findError } = await admin
        .from('webdo24_customers')
        .select<string, Webdo24Customer>('*')
        .eq('email', email)
        .limit(1)

      if (findError) {
        console.error('SUPABASE FIND ERROR:', findError)
        return NextResponse.json({ received: true })
      }

      const customer = existingCustomers && existingCustomers.length > 0 ? existingCustomers[0] : null

      // ── Upsell one-time payment ──
      if (session.mode === 'payment' && source === 'webdo24_upsell') {
        if (customer) {
          // Activate pro pack
          const { error: updateErr } = await admin
            .from('webdo24_customers')
            .update({ has_pro_pack: true })
            .eq('id', customer.id)

          console.log('PRO PACK ACTIVATED:', { id: customer.id, error: updateErr })

          // Record purchase
          const { error: purchaseErr } = await admin
            .from('webdo24_upsell_purchases')
            .insert({
              customer_id: customer.id,
              stripe_session_id: session.id,
              stripe_payment_intent_id: extractStripeId(session.payment_intent),
              amount: session.amount_total ?? 90000,
              currency: session.currency ?? 'czk',
              status: 'paid',
              metadata: session.metadata || {},
            })

          console.log('UPSELL PURCHASE RECORDED:', { error: purchaseErr })
        } else {
          console.error('UPSELL: Customer not found for email', email)
        }

        return NextResponse.json({ received: true })
      }

      // ── Subscription payment ──
      if (!stripeCustomerId || !stripeSubscriptionId) {
        console.error('MISSING STRIPE IDS:', { stripeCustomerId, stripeSubscriptionId })
        return NextResponse.json({ received: true })
      }

      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId) as Stripe.Response<StripeSubscriptionExtended>

      const currentPeriodEnd =
        typeof subscription.current_period_end === 'number'
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null

      const baseData: Partial<Webdo24Customer> = {
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        subscription_status: subscription.status,
        ...(currentPeriodEnd ? { current_period_end: currentPeriodEnd } : {}),
      }

      if (customer) {
        console.log('CUSTOMER FOUND:', { id: customer.id, email: customer.email })

        const { data, error } = await admin
          .from('webdo24_customers')
          .update(baseData)
          .eq('id', customer.id)
          .select<string, Webdo24Customer>('*')

        console.log('CUSTOMER UPDATED:', { id: customer.id })
        console.log('SUPABASE RESULT:', { data, error })
      } else {
        const nameFromEmail = email.split('@')[0]
        const customerName = session.customer_details?.name || nameFromEmail

        const { data, error } = await admin
          .from('webdo24_customers')
          .insert({
            email,
            name: customerName,
            ...baseData,
          })
          .select<string, Webdo24Customer>('*')

        console.log('CUSTOMER CREATED:', { email, name: customerName })
        console.log('SUPABASE RESULT:', { data, error })
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice

      const stripeCustomerId = extractStripeId(invoice.customer)

      if (stripeCustomerId) {
        const { data, error } = await admin
          .from('webdo24_customers')
          .update({ subscription_status: 'active' })
          .eq('stripe_customer_id', stripeCustomerId)
          .select<string, Webdo24Customer>('*')

        console.log('INVOICE PAID UPDATE:', { data, error })
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice

      const stripeCustomerId = extractStripeId(invoice.customer)

      if (stripeCustomerId) {
        const { data, error } = await admin
          .from('webdo24_customers')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', stripeCustomerId)
          .select<string, Webdo24Customer>('*')

        console.log('PAYMENT FAILED UPDATE:', { data, error })
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription

      const { data, error } = await admin
        .from('webdo24_customers')
        .update({ subscription_status: 'canceled' })
        .eq('stripe_subscription_id', subscription.id)
        .select<string, Webdo24Customer>('*')

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
