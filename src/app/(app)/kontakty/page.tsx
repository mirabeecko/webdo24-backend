export const dynamic = 'force-dynamic'

// /kontakty – kontaktní údaje firmy (§11) přes ChangeSet

import { getCccContext } from '@/lib/actions/ccc'
import { getCompanyProfile } from '@/lib/ccc/registry'
import CompanyForm from '@/components/ccc/CompanyForm'

export default async function KontaktyPage() {
  const ctx = await getCccContext()

  if (!ctx) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Kontaktní údaje</h1>
        <p className="text-white/40 text-sm">Váš projekt se připravuje. Zkuste to prosím později.</p>
      </div>
    )
  }

  const companyProfile = await getCompanyProfile(ctx.projectId)

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Kontaktní údaje</h1>
        <p className="mt-1 text-sm text-white/40">
          Jediné místo, kde spravujete kontakty pro celý web.
        </p>
      </header>

      <CompanyForm
        companyProfile={companyProfile}
        canEdit={ctx.canEdit}
        canPublish={ctx.canPublish}
      />
    </div>
  )
}
