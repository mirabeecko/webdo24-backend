export const dynamic = 'force-dynamic'

import { listChangeRequests } from '@/lib/actions/changes'
import ChangeRequestsView from '@/components/app/ChangeRequestsView'

export default async function PozadavkyPage() {
  const items = await listChangeRequests(30)
  return <ChangeRequestsView initialItems={items} />
}
