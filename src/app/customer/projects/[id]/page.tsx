// Legacy zákaznický portál – konsolidován do (app) route group (Phase 3)
import { redirect } from 'next/navigation'

export default function CustomerProjectDetailRedirect() {
  redirect('/web')
}
