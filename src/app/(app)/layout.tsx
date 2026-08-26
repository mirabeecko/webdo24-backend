export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/server'
import AppLayout from '@/components/app/AppLayout'

export default async function AppRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return <AppLayout userEmail={user.email || ''}>{children}</AppLayout>
}
