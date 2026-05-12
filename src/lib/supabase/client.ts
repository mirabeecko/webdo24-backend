import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createBrowserClient(url, key, {
    cookies: {
      getAll() {
        if (typeof document === 'undefined') return []
        return document.cookie.split(';').map((cookie) => {
          const [name, ...rest] = cookie.trim().split('=')
          return { name, value: rest.join('=') }
        })
      },
      setAll(cookiesToSet) {
        if (typeof document === 'undefined') return
        cookiesToSet.forEach(({ name, value, options }) => {
          let cookieString = `${name}=${value}`
          if (options?.path) cookieString += `; path=${options.path}`
          if (options?.maxAge) cookieString += `; max-age=${options.maxAge}`
          if (options?.sameSite) cookieString += `; samesite=${options.sameSite}`
          if (options?.secure) cookieString += '; secure'
          document.cookie = cookieString
        })
      },
    },
  })
}
