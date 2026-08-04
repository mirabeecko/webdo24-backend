import type {
  GoogleAuditStartPayload,
  GoogleAuditStartResponse,
  GoogleAuditDetailResponse,
} from '@/types'

const API_BASE = '/api/audit/google'

export async function startGoogleAudit(
  payload: GoogleAuditStartPayload
): Promise<GoogleAuditStartResponse> {
  const res = await fetch(`${API_BASE}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }

  return data as GoogleAuditStartResponse
}

export async function getGoogleAuditRun(
  runId: string
): Promise<GoogleAuditDetailResponse> {
  const res = await fetch(`${API_BASE}/${runId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }

  return data as GoogleAuditDetailResponse
}
