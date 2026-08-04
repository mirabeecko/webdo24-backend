export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getChangeRequest } from '@/lib/actions/changes'
import ChangeDetailView from '@/components/app/ChangeDetailView'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PozadavekDetailPage({ params }: Props) {
  const { id } = await params
  const cr = await getChangeRequest(id)
  if (!cr) notFound()
  return <ChangeDetailView cr={cr} />
}
