import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWebsiteBySiteId } from '@/lib/website-connection/registry'
import { getWebsiteFormBySiteId } from '@/lib/website-connection/connect'
import { isValidSiteId } from '@/lib/website-connection/site-id'
import { queueEmailToCustomer } from '@/lib/email/queue'
import { generateAutoReplyForLead } from '@/lib/actions/crm'

const MAX_BODY_BYTES = 64_000
const TRACKING_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'] as const

function str(v: unknown, max = 4000): string {
  return typeof v === 'string' ? v.slice(0, max).trim() : ''
}

/**
 * POST /api/v1/leads — univerzální lead endpoint pro připojené weby.
 * Idempotentní (submission_id), honeypot, origin validace, sanitace.
 */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin') || ''
    const referer = request.headers.get('referer') || ''
    const rawText = await request.text()
    if (rawText.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
    }
    let body: Record<string, unknown> = {}
    try {
      body = JSON.parse(rawText)
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    // honeypot
    if (str(body.website) || str(body.company)) {
      return NextResponse.json({ success: true }) // tichý drop botu
    }

    const siteId = str(body.site_id)
    if (!isValidSiteId(siteId)) {
      return NextResponse.json({ error: 'invalid_site_id' }, { status: 400 })
    }
    const site = await getWebsiteBySiteId(siteId)
    if (!site) {
      return NextResponse.json({ error: 'site_not_found' }, { status: 404 })
    }
    if (!['CONNECTED', 'DEGRADED'].includes(site.connection_status)) {
      return NextResponse.json({ error: 'site_not_connected' }, { status: 403 })
    }

    // origin / allowed domains
    const allowed = (site.allowed_domains as string[]) || []
    if (origin && allowed.length > 0) {
      const originHost = origin.replace(/^https?:\/\//, '').split(':')[0]
      if (!allowed.some((d) => originHost === d || originHost.endsWith('.' + d))) {
        return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 })
      }
    }

    const formId = str(body.form_id, 120)
    if (formId) {
      const form = await getWebsiteFormBySiteId(siteId, formId)
      if (!form) {
        return NextResponse.json({ error: 'form_not_found' }, { status: 404 })
      }
    }

    const data = (body.data && typeof body.data === 'object' ? body.data : {}) as Record<string, unknown>
    const context = (body.context && typeof body.context === 'object' ? body.context : {}) as Record<string, unknown>
    const tracking = (body.tracking && typeof body.tracking === 'object' ? body.tracking : {}) as Record<string, unknown>

    const name = str(data.name, 200) || 'Neznámý zájemce'
    const email = str(data.email, 320)
    const phone = str(data.phone, 80)
    const message = str(data.message, 4000) || Object.entries(data)
      .filter(([k]) => !['name', 'email', 'phone', 'message'].includes(k))
      .map(([k, v]) => `${k}: ${String(v).slice(0, 2000)}`)
      .join('\n') || 'Poptávka z webu'

    const submissionId = str(body.submission_id, 120) || null

    const admin = createAdminClient()

    // idempotence
    if (submissionId) {
      const { data: existing } = await admin
        .from('webdo24_leads')
        .select('id')
        .eq('submission_id', submissionId)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ success: true, lead_id: (existing as { id: string }).id, duplicate: true })
      }
    }

    const insert: Record<string, unknown> = {
      project_id: site.id,
      site_id: siteId,
      form_id: formId || null,
      submission_id: submissionId,
      is_test: Boolean(body.is_test),
      name,
      phone: phone || null,
      email: email || null,
      message,
      source: 'website',
      status: 'new',
      page_url: str(context.page_url, 2000) || null,
      landing_page: str(context.landing_page, 2000) || null,
      referrer: referer || str(context.referrer, 2000) || null,
      metadata: { raw_data: data },
    }
    for (const f of TRACKING_FIELDS) {
      const v = str(tracking[f], 500)
      if (v) insert[f] = v
    }

    const { data: lead, error } = await admin.from('webdo24_leads').insert(insert).select('id').single()
    if (error) {
      // race na submission_id → vrátit existující
      if (submissionId) {
        const { data: existing } = await admin.from('webdo24_leads').select('id').eq('submission_id', submissionId).maybeSingle()
        if (existing) return NextResponse.json({ success: true, lead_id: (existing as { id: string }).id, duplicate: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (site.customer_id) {
      queueEmailToCustomer(site.customer_id, 'new_lead', { leadId: lead.id, leadName: name, leadPhone: phone, leadEmail: email, leadMessage: message }).catch(() => {})
      generateAutoReplyForLead({ leadId: lead.id, projectId: site.id, customerId: site.customer_id, name, phone, email, message })
    }

    return NextResponse.json({ success: true, lead_id: lead.id })
  } catch (err) {
    console.error('[v1/leads] error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
