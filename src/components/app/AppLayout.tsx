'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Globe, FileText, Image as ImageIcon,
  Palette, Contact, History, Inbox, Sparkles,
  ShoppingBag, CreditCard, Settings, LogOut, Zap,
  Receipt, ClipboardList, Mail,
} from 'lucide-react'

// Navigace seskupená logicky (premium produkt):
//   řízení byznysu → prodej → obsah webu → finance → nastavení
const navSections = [
  {
    items: [
      { href: '/dashboard', label: 'Přehled', icon: LayoutDashboard },
      { href: '/poptavky', label: 'Poptávky', icon: Inbox },
      { href: '/pozadavky', label: 'Požadavky', icon: Sparkles },
    ],
  },
  {
    label: 'Prodej',
    items: [
      { href: '/nabidky', label: 'Nabídky', icon: Receipt },
      { href: '/formulare', label: 'Formuláře', icon: ClipboardList },
    ],
  },
  {
    label: 'Web',
    items: [
      { href: '/web', label: 'Můj web', icon: Globe },
      { href: '/obsah', label: 'Obsah', icon: FileText },
      { href: '/media', label: 'Média', icon: ImageIcon },
      { href: '/vzhled', label: 'Vzhled značky', icon: Palette },
      { href: '/kontakty', label: 'Kontaktní údaje', icon: Contact },
      { href: '/historie', label: 'Historie', icon: History },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/sluzby', label: 'Moje služby', icon: ShoppingBag },
      { href: '/fakturace', label: 'Fakturace', icon: CreditCard },
    ],
  },
  {
    label: 'Nastavení',
    items: [
      { href: '/email', label: 'E-mail', icon: Mail },
      { href: '/nastaveni', label: 'Nastavení', icon: Settings },
    ],
  },
]

export default function AppLayout({ children, userEmail }: { children: React.ReactNode; userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="flex min-h-screen bg-[#0a0e17]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-[#0d1525] border-r border-white/5 fixed inset-y-0 left-0 z-40">
        <div className="p-6">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
              <Zap className="h-5 w-5 text-[#0a0e17]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">WEBDO24</h1>
              <p className="text-[10px] text-cyan-400/60 uppercase tracking-wider font-medium">Lead Machine</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-4 overflow-y-auto">
          {navSections.map((section, si) => (
            <div key={si} className="space-y-1">
              {section.label && (
                <p className="px-4 pt-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                      active
                        ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/20'
                        : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="mb-3 px-3">
            <p className="text-xs text-white/30 truncate">{userEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/30 hover:bg-white/5 hover:text-white/50 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Odhlásit se
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pb-20 lg:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Nav – horizontálně skrolovatelná */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0d1525] border-t border-white/5 z-50 pb-safe backdrop-blur-xl">
        <div className="flex items-center h-16 overflow-x-auto px-2 gap-1">
          {navSections.flatMap((s) => s.items).map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-16 h-14 px-2 rounded-xl transition-all shrink-0 ${
                  active ? 'text-cyan-400' : 'text-white/30'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
