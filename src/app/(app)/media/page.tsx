export const dynamic = 'force-dynamic'

// /media – Media Library (§8, §9)

import { getCccContext } from '@/lib/actions/ccc'
import { listMediaAssets, getAssetUrlVariants } from '@/lib/ccc/media'
import MediaLibrary from '@/components/ccc/MediaLibrary'

export default async function MediaPage() {
  const ctx = await getCccContext()

  if (!ctx) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Média</h1>
        <p className="text-white/40 text-sm">Váš projekt se připravuje. Zkuste to prosím později.</p>
      </div>
    )
  }

  const assets = await listMediaAssets(ctx.projectId)
  const assetsWithThumbs = assets.map((a) => ({
    ...a,
    thumb_url: getAssetUrlVariants(a).thumbnail_url,
  }))

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Média</h1>
        <p className="mt-1 text-sm text-white/40">
          Fotky, loga a dokumenty pro váš web na jednom místě.
        </p>
      </header>

      <MediaLibrary assets={assetsWithThumbs} canEdit={ctx.canEdit} />
    </div>
  )
}
