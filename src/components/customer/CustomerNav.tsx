'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FolderOpen,
  PlusCircle,
  LogOut,
} from 'lucide-react'

export default function CustomerNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = [
    { href: '/customer', label: 'Můj účet', icon: LayoutDashboard },
    { href: '/customer/projects', label: 'Moje projekty', icon: FolderOpen },
    { href: '/customer/new-project', label: 'Nový projekt', icon: PlusCircle },
  ]

  return (
    <aside className="w-64 bg-gray-900 text-white">
      <div className="p-6">
        <h2 className="text-xl font-bold">Webdo24</h2>
        <p className="mt-1 text-sm text-gray-400">Zákaznický portál</p>
      </div>

      <nav className="mt-6 space-y-1 px-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center rounded-md px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="mr-3 h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="absolute bottom-0 w-64 p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center rounded-md px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Odhlásit se
        </button>
      </div>
    </aside>
  )
}
