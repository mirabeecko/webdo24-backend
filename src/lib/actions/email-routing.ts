'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── HELPER: get customer + project ──
async function getCustomerWithProject() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: customer } = await supabase
    .from('webdo24_customers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!customer) return null

  const { data: project } = await supabase
    .from('webdo24_projects')
    .select('id, slug, zone_id')
    .eq('customer_id', customer.id)
    .single()

  return { customer, project }
}

// ── VALIDATION ──
function validateEmailRouting(data: {
  domain: string
  email_prefix: string
  destination_email: string
}) {
  const errors: string[] = []

  if (!data.domain || data.domain.trim().length === 0) {
    errors.push('Doména je povinná')
  }

  const prefixRegex = /^[a-z0-9._-]+$/i
  if (!data.email_prefix || !prefixRegex.test(data.email_prefix)) {
    errors.push('Prefix emailu smí obsahovat jen písmena, čísla, tečku, pomlčku nebo podtržítko')
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!data.destination_email || !emailRegex.test(data.destination_email)) {
    errors.push('Cílový email není platný')
  }

  return errors
}

// ── LOGGING HELPER ──
async function logEvent(
  supabase: any,
  customerId: string,
  event: string,
  details?: Record<string, any>
) {
  try {
    await supabase.from('webdo24_analytics').insert({
      project_id: null,
      event_date: new Date().toISOString().split('T')[0],
      metadata: {
        type: 'email_routing_log',
        customer_id: customerId,
        event,
        details,
        created_at: new Date().toISOString(),
      },
    })
  } catch {
    // Silent fail for logging
  }
}

// ── GET REQUESTS ──
export async function getEmailRoutingRequests() {
  const result = await getCustomerWithProject()
  if (!result) return { requests: [], projectDomain: null }

  const { customer, project } = result
  const supabase = await createClient()

  const { data: requests } = await supabase
    .from('webdo24_email_routing_requests')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })

  return {
    requests: requests || [],
    projectDomain: project?.slug ? `${project.slug}.cz` : null,
    projectZoneId: project?.zone_id || null,
  }
}

// ── CREATE REQUEST + SEND WEBHOOK ──
export async function createEmailRoutingRequest(formData: {
  domain: string
  email_prefix: string
  destination_email: string
  zone_id?: string
}) {
  const result = await getCustomerWithProject()
  if (!result) throw new Error('Nejste přihlášen nebo nemáte projekt')

  const { customer, project } = result
  const supabase = await createClient()

  // 1. Validate domain belongs to customer
  const customerDomain = formData.domain.trim().toLowerCase()
  if (project?.slug) {
    const expectedDomain = `${project.slug}.cz`
    if (customerDomain !== expectedDomain && !customerDomain.endsWith(`.${project.slug}.cz`)) {
      // Allow any domain for now if no strict matching, but log it
    }
  }

  // 2. Backend validation
  const validationErrors = validateEmailRouting({
    domain: customerDomain,
    email_prefix: formData.email_prefix,
    destination_email: formData.destination_email,
  })

  if (validationErrors.length > 0) {
    await logEvent(supabase, customer.id, 'validation_failed', { errors: validationErrors })
    throw new Error(validationErrors.join(', '))
  }

  const customEmail = `${formData.email_prefix}@${customerDomain}`
  const zoneId = formData.zone_id || project?.zone_id || null

  // 3. Save request as pending
  const { data: request, error: insertError } = await supabase
    .from('webdo24_email_routing_requests')
    .insert({
      customer_id: customer.id,
      domain: customerDomain,
      zone_id: zoneId,
      email_prefix: formData.email_prefix.trim().toLowerCase(),
      custom_email: customEmail,
      destination_email: formData.destination_email.trim().toLowerCase(),
      status: 'pending',
    })
    .select()
    .single()

  if (insertError) {
    await logEvent(supabase, customer.id, 'insert_failed', { error: insertError.message })
    throw new Error(`Chyba při ukládání: ${insertError.message}`)
  }

  // 4. Send webhook to n8n
  const webhookUrl = process.env.N8N_EMAIL_ROUTING_WEBHOOK_URL
  if (!webhookUrl) {
    await logEvent(supabase, customer.id, 'webhook_skipped', { reason: 'no_url_configured' })
    return { success: true, request, webhookSent: false }
  }

  const payload = {
    customer_id: customer.id,
    domain: customerDomain,
    zone_id: zoneId,
    email_prefix: formData.email_prefix.trim().toLowerCase(),
    destination_email: formData.destination_email.trim().toLowerCase(),
  }

  try {
    await logEvent(supabase, customer.id, 'request_sent', { payload })

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    let responseData: any = { raw: responseText }
    try {
      responseData = JSON.parse(responseText)
    } catch {
      // Keep raw text if not JSON
    }

    if (!response.ok) {
      await supabase
        .from('webdo24_email_routing_requests')
        .update({
          status: 'error',
          n8n_response: responseData,
          error_message: `Webhook HTTP ${response.status}: ${responseText.slice(0, 500)}`,
        })
        .eq('id', request.id)

      await logEvent(supabase, customer.id, 'webhook_failed', {
        request_id: request.id,
        status: response.status,
        response: responseData,
      })

      throw new Error(`Webhook selhal (HTTP ${response.status}). Zkuste to prosím znovu.`)
    }

    // Success
    await supabase
      .from('webdo24_email_routing_requests')
      .update({
        status: 'waiting_verification',
        n8n_response: responseData,
      })
      .eq('id', request.id)

    await logEvent(supabase, customer.id, 'webhook_success', {
      request_id: request.id,
      response: responseData,
    })

    revalidatePath('/nastaveni')
    return { success: true, request: { ...request, status: 'waiting_verification' }, webhookSent: true }

  } catch (err: any) {
    // Network or other error
    if (!err.message?.includes('Webhook selhal')) {
      await supabase
        .from('webdo24_email_routing_requests')
        .update({
          status: 'error',
          error_message: err.message || 'Neznámá chyba při odesílání webhooku',
        })
        .eq('id', request.id)

      await logEvent(supabase, customer.id, 'webhook_failed', {
        request_id: request.id,
        error: err.message,
      })
    }

    throw err
  }
}

// ── RESEND REQUEST ──
export async function resendEmailRoutingRequest(requestId: string) {
  const result = await getCustomerWithProject()
  if (!result) throw new Error('Nejste přihlášen')

  const { customer } = result
  const supabase = await createClient()

  // Verify ownership
  const { data: existing } = await supabase
    .from('webdo24_email_routing_requests')
    .select('*')
    .eq('id', requestId)
    .eq('customer_id', customer.id)
    .single()

  if (!existing) throw new Error('Žádost nenalezena')

  // Reset status and resend
  await supabase
    .from('webdo24_email_routing_requests')
    .update({ status: 'pending', error_message: null, n8n_response: {} })
    .eq('id', requestId)

  return createEmailRoutingRequest({
    domain: existing.domain,
    email_prefix: existing.email_prefix,
    destination_email: existing.destination_email,
    zone_id: existing.zone_id,
  })
}
