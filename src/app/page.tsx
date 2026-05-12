import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const role = user.user_metadata?.role
    if (role === 'admin') {
      redirect('/admin')
    }

    redirect('/dashboard')
  } catch {
    redirect('/login')
  }
}
