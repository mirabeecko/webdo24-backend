import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import type { AuditFindingSeverity } from '@/types'

export async function POST(request: Request) {
  try {
    await requireAdmin()

    const body = await request.json()
    const {
      domain,
      client_name,
      ga4_property_id = '',
      gtm_account_id = '',
      gtm_container_id = '',
      search_console_site_url = '',
    } = body

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json(
        { error: 'domain is required and must be a string' },
        { status: 400 }
      )
    }

    const normalizedDomain = domain.trim().toLowerCase()
    if (!/^([a-z0-9_-]+\.)+[a-z]{2,}$/i.test(normalizedDomain)) {
      return NextResponse.json(
        { error: 'domain must be a valid domain name' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // 1. Create audit project
    const { data: project, error: projectError } = await admin
      .from('webdo24_audit_projects')
      .insert({
        domain: normalizedDomain,
        client_name: client_name || normalizedDomain,
        ga4_property_id: ga4_property_id || null,
        gtm_account_id: gtm_account_id || null,
        gtm_container_id: gtm_container_id || null,
        search_console_site_url: search_console_site_url || null,
      })
      .select('id')
      .single()

    if (projectError || !project) {
      console.error('Audit project creation error:', projectError)
      return NextResponse.json(
        { error: projectError?.message || 'Failed to create audit project' },
        { status: 500 }
      )
    }

    // 2. Create audit run
    const { data: run, error: runError } = await admin
      .from('webdo24_audit_runs')
      .insert({
        project_id: project.id,
        status: 'running',
      })
      .select('id')
      .single()

    if (runError || !run) {
      console.error('Audit run creation error:', runError)
      return NextResponse.json(
        { error: runError?.message || 'Failed to create audit run' },
        { status: 500 }
      )
    }

    const runId = run.id

    // 3. Call n8n webhook
    const n8nUrl = process.env.N8N_GOOGLE_AUDIT_WEBHOOK_URL
    let n8nData: Record<string, unknown> | null = null
    let n8nError: string | null = null

    if (n8nUrl) {
      try {
        const res = await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            run_id: runId,
            domain: normalizedDomain,
            client_name: client_name || normalizedDomain,
            ga4_property_id: ga4_property_id || null,
            gtm_account_id: gtm_account_id || null,
            gtm_container_id: gtm_container_id || null,
            search_console_site_url: search_console_site_url || null,
          }),
        })

        if (!res.ok) {
          const bodyText = await res.text().catch(() => '')
          n8nError = `n8n returned ${res.status}: ${res.statusText}. ${bodyText || 'Make sure the webhook workflow exists in n8n and is active.'}`
        } else {
          n8nData = (await res.json()) as Record<string, unknown>
        }
      } catch (err) {
        n8nError = err instanceof Error ? err.message : String(err)
      }
    } else {
      n8nError = 'N8N_GOOGLE_AUDIT_WEBHOOK_URL is not configured'
    }

    // 4. Process n8n response
    if (n8nError) {
      await admin
        .from('webdo24_audit_runs')
        .update({
          status: 'failed',
          raw_result: { error: n8nError },
          updated_at: new Date().toISOString(),
        })
        .eq('id', runId)

      return NextResponse.json(
        { error: n8nError },
        { status: 502 }
      )
    }

    // Extract fields from n8n response
    const score =
      typeof n8nData?.score === 'number'
        ? n8nData.score
        : typeof n8nData?.score === 'string'
          ? parseFloat(n8nData.score)
          : null

    const summary =
      n8nData && typeof n8nData.summary === 'object' && n8nData.summary !== null
        ? (n8nData.summary as Record<string, unknown>)
        : null

    const rawFindings = Array.isArray(n8nData?.findings)
      ? n8nData.findings
      : Array.isArray(n8nData?.issues)
        ? n8nData.issues
        : []

    // 5. Update run as completed
    const { error: updateError } = await admin
      .from('webdo24_audit_runs')
      .update({
        status: 'completed',
        score,
        summary,
        raw_result: n8nData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', runId)

    if (updateError) {
      console.error('Audit run update error:', updateError)
    }

    // 6. Insert findings
    if (rawFindings.length > 0) {
      const findingsToInsert = rawFindings
        .map((f: unknown) => {
          if (!f || typeof f !== 'object') return null
          const item = f as Record<string, unknown>
          const severity = String(item.severity || item.priority || 'green')
            .toLowerCase() as AuditFindingSeverity
          const validSeverity: AuditFindingSeverity =
            severity === 'red' || severity === 'yellow' || severity === 'green'
              ? severity
              : 'green'

          return {
            run_id: runId,
            area: String(item.area || item.category || 'general'),
            title: String(item.title || item.name || 'Finding'),
            problem: item.problem ? String(item.problem) : null,
            impact: item.impact ? String(item.impact) : null,
            recommendation: item.recommendation
              ? String(item.recommendation)
              : null,
            severity: validSeverity,
          }
        })
        .filter(Boolean)

      if (findingsToInsert.length > 0) {
        const { error: findingsError } = await admin
          .from('webdo24_audit_findings')
          .insert(findingsToInsert)

        if (findingsError) {
          console.error('Audit findings insert error:', findingsError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      run_id: runId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Google audit start error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
