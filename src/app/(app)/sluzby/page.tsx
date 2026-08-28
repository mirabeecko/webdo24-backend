export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppCustomerContext } from '@/lib/customer-context'
import { listProducts } from '@/lib/actions/upsell'
import ServiceCatalog from '@/components/app/ServiceCatalog'

export default async function ServicesPage() {
  const context = await getAppCustomerContext()
  if (!context?.user) redirect('/login')

  const products = await listProducts()

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-[#0F172A]">Nabídky a služby</h1>
        <p className="mt-1 text-gray-500">
          Služby, které vám pomohou zlepšit web, marketing a komunikaci se zákazníky.
        </p>
      </div>

      <ServiceCatalog
        products={products}
        customerEmail={context.customer.email || context.user.email || ''}
        projectId={context.project?.id}
      />
    </div>
  )
}
