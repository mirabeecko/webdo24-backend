export const dynamic = 'force-dynamic'

// /obsah – editor obsahu nad Content Registry (§29)

import { getCccContext } from '@/lib/actions/ccc'
import { listPages, getPageContent } from '@/lib/ccc/registry'
import { listChangeSets } from '@/lib/ccc/changesets'
import { listMediaAssets, getAssetUrlVariants } from '@/lib/ccc/media'
import ContentEditor from '@/components/ccc/ContentEditor'

export default async function ObsahPage() {
  const ctx = await getCccContext()

  if (!ctx) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Obsah</h1>
        <p className="text-white/40 text-sm">Váš projekt se připravuje. Zkuste to prosím později.</p>
      </div>
    )
  }

  const [pages, changesets, assets] = await Promise.all([
    listPages(ctx.projectId),
    listChangeSets(ctx.projectId),
    listMediaAssets(ctx.projectId),
  ])

  const firstPage = pages[0] ?? null
  const { fields } = firstPage
    ? await getPageContent(ctx.projectId, firstPage.slug)
    : { fields: [] }

  const assetsWithThumbs = assets.map((a) => ({
    ...a,
    thumb_url: getAssetUrlVariants(a).thumbnail_url,
  }))

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Obsah webu</h1>
        <p className="mt-1 text-sm text-white/40">
          Upravte texty a obrázky. Změny se na webu projeví až po publikování návrhu.
        </p>
      </header>

      <ContentEditor
        pages={pages}
        initialPageSlug={firstPage?.slug ?? null}
        initialFields={fields}
        openChangesets={changesets}
        assets={assetsWithThumbs}
        canEdit={ctx.canEdit}
        canPublish={ctx.canPublish}
      />
    </div>
  )
}
