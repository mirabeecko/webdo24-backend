export const dynamic = 'force-dynamic'

import { getProfile, getAutomations, getEmailPrefs } from '@/lib/actions/settings'
import { createClient } from '@/lib/supabase/server'
import SettingsView from '@/components/app/SettingsView'

export default async function NastaveniPage() {
  const [profile, automations, emailPrefs] = await Promise.all([getProfile(), getAutomations(), getEmailPrefs()])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: project } = user
    ? await supabase
        .from('webdo24_projects')
        .select('id, stripe_customer_id, status')
        .eq('customer_id', profile?.id ?? '')
        .single()
    : { data: null }

  return (
    <SettingsView
      profile={profile}
      automations={automations}
      emailPrefs={emailPrefs}
      userEmail={user?.email ?? ''}
      stripeCustomerId={(project as any)?.stripe_customer_id ?? null}
    />
  )
}
