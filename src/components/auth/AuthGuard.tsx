'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      const isAuthPage = pathname === '/login' || pathname === '/register'

      if (!user && !isAuthPage && !pathname.startsWith('/api/')) {
        router.push('/login')
        return
      }

      if (user && isAuthPage) {
        const role = user.user_metadata?.role
        if (role === 'admin') {
          router.push('/admin')
        } else {
          router.push('/customer')
        }
        return
      }

      setLoading(false)
    }

    checkAuth()
  }, [pathname, router, supabase])

  if (loading && pathname !== '/login' && pathname !== '/register') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
