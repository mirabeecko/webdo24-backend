export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppCustomerContext } from '@/lib/customer-context'
import { getBillingData } from '@/lib/actions/billing'
import BillingView from '@/components/app/BillingView'

export default async function FakturacePage() {
  const context = await getAppCustomerContext()
  if (!context?.user) redirect('/login')

  const billing = await getBillingData()

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
        stripeCustomerId={billing.stripeCustomerId || context.project?.stripe_customer_id || context.customer.stripe_customer_id || null}
        userEmail={context.user.email || ''}
      />
    </div>
  )
}
