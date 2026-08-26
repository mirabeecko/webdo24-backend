export const dynamic = 'force-dynamic'

import QuoteBuilder from '@/components/app/QuoteBuilder'

export default async function QuoteBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <QuoteBuilder quoteId={id} />
}
