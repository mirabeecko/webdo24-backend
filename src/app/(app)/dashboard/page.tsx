export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getDashboardData } from '@/lib/actions/dashboard'
import AIChat from '@/components/app/AIChat'
import DashboardStatus from '@/components/ccc/DashboardStatus'

export default async function DashboardPage() {
  const data = await getDashboardData()

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-8">
        <div className="max-w-sm text-center">
          <h2 className="text-xl font-bold text-[#0F172A] mb-2">Vítejte!</h2>
          <p className="text-gray-500 mb-6 text-sm leading-relaxed">
            Váš projekt se připravuje. Brzy se tu objeví váš dashboard.
          </p>
          <Link
            href="/nastaveni"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F172A] text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Nastavit profil
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Stavový přehled dle §17 (CCC) – nad existujícím AI chatem */}
      <DashboardStatus />
      <AIChat
        customerName={data.customerName ?? ''}
        planTier={data.hasProPack ? 'pro' : 'start'}
        projectId={data.project.id}
        customerEmail={data.customerEmail}
        newLeadsCount={data.newLeadsCount}
        recentChanges={data.recentChanges}
      />
    </div>
  )
}
