export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBillingData } from '@/lib/actions/billing'
import BillingView from '@/components/app/BillingView'

export default async function FakturacePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const billing = await getBillingData()

  // Get project for stripe customer ID
  const { data: project } = await supabase
    .from('webdo24_projects')
    .select('id, stripe_customer_id')
    .eq('customer_id', billing.customerId)
    .single()

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-[#0F172A]">Fakturace a služby</h1>
        <p className="mt-1 text-gray-500">
          Správa hostingu, maintenance a plateb.
        </p>
      </div>

      <BillingView
        billing={billing}
        stripeCustomerId={billing.stripeCustomerId || (project as any)?.stripe_customer_id || null}
        userEmail={user.email || ''}
      />
    </div>
  )
}
