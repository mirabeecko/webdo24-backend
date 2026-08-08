export const dynamic = 'force-dynamic'

// /vzhled – vzhled značky (§10): loga, favicon, barvy přes ChangeSet

import { getCccContext } from '@/lib/actions/ccc'
import { getBrandProfile } from '@/lib/ccc/registry'
import { listMediaAssets, getAssetUrlVariants } from '@/lib/ccc/media'
import BrandingForm from '@/components/ccc/BrandingForm'

export default async function VzhledPage() {
  const ctx = await getCccContext()

  if (!ctx) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Vzhled značky</h1>
        <p className="text-white/40 text-sm">Váš projekt se připravuje. Zkuste to prosím později.</p>
      </div>
    )
  }

  const [brandProfile, assets] = await Promise.all([
    getBrandProfile(ctx.projectId),
    listMediaAssets(ctx.projectId),
  ])

  const assetsWithThumbs = assets.map((a) => ({
    ...a,
    thumb_url: getAssetUrlVariants(a).thumbnail_url,
  }))

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Vzhled značky</h1>
        <p className="mt-1 text-sm text-white/40">
          Logo a barvy, které se použijí na celém webu.
        </p>
      </header>

      <BrandingForm
        brandProfile={brandProfile}
        assets={assetsWithThumbs}
        canEdit={ctx.canEdit}
        canPublish={ctx.canPublish}
      />
    </div>
  )
}
