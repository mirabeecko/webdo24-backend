'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        const isAuthPage = pathname === '/login' || pathname === '/register'

        if (!user && !isAuthPage && !pathname.startsWith('/api/')) {
          router.replace('/login')
          return
        }

        if (user && isAuthPage) {
          const role = user.user_metadata?.role
          if (role === 'admin') {
            router.replace('/admin')
          } else {
            router.replace('/customer')
          }
          return
        }
      } catch {
        // Prevent hard lock on loading UI when auth request fails.
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    checkAuth()

    return () => {
      isMounted = false
    }
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
