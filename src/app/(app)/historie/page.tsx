export const dynamic = 'force-dynamic'

// /historie – historie publikovaných změn + rollback (§7)

import { getCccContext } from '@/lib/actions/ccc'
import { listPublications } from '@/lib/ccc/publish'
import ChangeHistory from '@/components/ccc/ChangeHistory'

export default async function HistoriePage() {
  const ctx = await getCccContext()

  if (!ctx) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Historie změn</h1>
        <p className="text-white/40 text-sm">Váš projekt se připravuje. Zkuste to prosím později.</p>
      </div>
    )
  }

  const publications = await listPublications(ctx.projectId)

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Historie změn</h1>
        <p className="text-sm text-white/40 mt-1">
          Všechny publikované změny webu. Každou lze bezpečně vrátit zpět.
        </p>
      </header>

      <ChangeHistory publications={publications} canPublish={ctx.canPublish} />
    </div>
  )
}
