export const dynamic = 'force-dynamic'

import { getProfile, getAutomations, getEmailPrefs } from '@/lib/actions/settings'
import { getTelegramSettings, getSandboxStatus, getDomainSettings, getUpdateSuggestions } from '@/lib/actions/mvp'
import { createClient } from '@/lib/supabase/server'
import SettingsView from '@/components/app/SettingsView'

export default async function NastaveniPage() {
  const [profile, automations, emailPrefs, telegram, sandbox, domain, suggestions] = await Promise.all([
    getProfile(),
    getAutomations(),
    getEmailPrefs(),
    getTelegramSettings(),
    getSandboxStatus(),
    getDomainSettings(),
    getUpdateSuggestions(),
  ])

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
      telegram={telegram}
      sandbox={sandbox}
      domain={domain}
      suggestions={suggestions ?? []}
    />
  )
}
