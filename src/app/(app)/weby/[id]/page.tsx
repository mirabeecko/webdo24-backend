export const dynamic = 'force-dynamic'

import WebsiteDetail from '@/components/app/WebsiteDetail'

export default async function WebsiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <WebsiteDetail websiteId={id} />
}
