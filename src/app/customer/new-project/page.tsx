// Legacy zákaznický portál – konsolidován do (app) route group (Phase 3)
// Nový projekt = poptávka změny/nového webu přes Požadavky.
import { redirect } from 'next/navigation'

export default function CustomerNewProjectRedirect() {
  redirect('/pozadavky')
}
