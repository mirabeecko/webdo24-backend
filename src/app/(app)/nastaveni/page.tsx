export const dynamic = 'force-dynamic'

import { getProfile, getAutomations, getEmailPrefs } from '@/lib/actions/settings'
import { getTelegramSettings, getSandboxStatus, getDomainSettings, getUpdateSuggestions } from '@/lib/actions/mvp'
import { getAppCustomerContext } from '@/lib/customer-context'
import SettingsView from '@/components/app/SettingsView'

export default async function NastaveniPage() {
  const [context, profile, automations, emailPrefs, telegram, sandbox, domain, suggestions] = await Promise.all([
    getAppCustomerContext(),
    getProfile(),
    getAutomations(),
    getEmailPrefs(),
    getTelegramSettings(),
    getSandboxStatus(),
    getDomainSettings(),
    getUpdateSuggestions(),
  ])

  return (
    <SettingsView
      profile={profile}
      automations={automations}
      emailPrefs={emailPrefs}
      userEmail={context?.user?.email ?? ''}
      stripeCustomerId={context?.project?.stripe_customer_id ?? context?.customer?.stripe_customer_id ?? null}
      telegram={telegram}
      sandbox={sandbox}
      domain={domain}
      suggestions={suggestions ?? []}
    />
  )
}
