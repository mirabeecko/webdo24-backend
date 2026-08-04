export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { listProducts } from '@/lib/actions/upsell'
import ServiceCatalog from '@/components/app/ServiceCatalog'

export default async function ServicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: customer } = await supabase
    .from('webdo24_customers')
    .select('id, name, email')
    .eq('user_id', user.id)
    .single()

  if (!customer) redirect('/dashboard')

  const { data: project } = await supabase
    .from('webdo24_projects')
    .select('id')
    .eq('customer_id', customer.id)
    .single()

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
        customerEmail={customer.email}
        projectId={project?.id}
      />
    </div>
  )
}
