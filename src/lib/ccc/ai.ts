// ============================================
// CCC – AI vrstva  (architektura §13, §14, §21, §1.F)
//
// Veškerá AI jde přes self-hosted n8n webhook N8N_AI_ASSIST_WEBHOOK_URL
// (projekt nemá přímé AI API klíče). Autentizace outbound callu:
// X-Webhook-Secret: N8N_WEBHOOK_SECRET (stejný vzor jako inbound
// /api/webhooks/n8n).
//
// PRAVIDLO (§22): AI NIKDY nepublikuje. Výstup je jen návrh – použití =
// převzetí do editoru → ChangeSet (source 'gui') → standardní flow.
// AI obrázek jde pouze do Media Library (source 'ai'), na web se
// dostane výhradně přes ChangeSet na image/logo poli.
//
// Graceful degradation (§1.F): bez env / při výpadku n8n vracíme čistou
// českou chybu – CMS funguje i bez AI.
// ============================================

import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjectCapability } from '@/lib/ccc/guard'
import { uploadMediaAsset } from '@/lib/ccc/media'
import type { FieldType, MediaAsset } from '@/types/website-contract'

const AI_TIMEOUT_MS = 60_000

const AI_UNAVAILABLE_MESSAGE = 'AI asistent není momentálně dostupný'

export type AiTextMode =
  | 'improve'
  | 'shorten'
  | 'expand'
  | 'professional'
  | 'sales'
  | 'simple'
  | 'seo'
  | 'custom'

// --------------------------------------------------------------
// Interní helper: volání n8n webhooku
// --------------------------------------------------------------

async function callAiAssist(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = process.env.N8N_AI_ASSIST_WEBHOOK_URL
  if (!url) throw new Error(AI_UNAVAILABLE_MESSAGE)

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const secret = process.env.N8N_WEBHOOK_SECRET
  if (secret) headers['X-Webhook-Secret'] = secret

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    })
  } catch {
    throw new Error(AI_UNAVAILABLE_MESSAGE)
  }

  if (!res.ok) throw new Error(AI_UNAVAILABLE_MESSAGE)

  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    throw new Error(AI_UNAVAILABLE_MESSAGE)
  }
}

/** Kontext pro prompt: základní údaje o firmě (company profil). */
async function getProjectContext(projectId: string): Promise<Record<string, unknown>> {
  const admin = createAdminClient()
  const [{ data: project }, { data: company }] = await Promise.all([
    admin
      .from('webdo24_projects')
      .select('title, business_type, location')
      .eq('id', projectId)
      .maybeSingle(),
    admin
      .from('webdo24_company_profiles')
      .select('company_name, city')
      .eq('project_id', projectId)
      .maybeSingle(),
  ])

  return {
    project_title: project?.title ?? null,
    business_type: project?.business_type ?? null,
    location: project?.location ?? null,
    company_name: company?.company_name ?? null,
    city: company?.city ?? null,
  }
}

async function auditAi(
  ctx: { userId: string; customerId: string },
  projectId: string,
  action: 'AI_CONTENT_GENERATED' | 'AI_ACTION_ACCEPTED',
  diff: Record<string, unknown>,
) {
  const admin = createAdminClient()
  await admin.from('webdo24_audit_log').insert({
    user_id: ctx.userId,
    customer_id: ctx.customerId,
    project_id: projectId,
    action,
    entity: 'content_field',
    entity_id: null,
    diff,
  })
}

// --------------------------------------------------------------
// AI texty (§13)
// --------------------------------------------------------------

export interface SuggestTextInput {
  projectId: string
  fieldKey: string
  fieldType: FieldType
  currentValue: string
  mode: AiTextMode
  customInstruction?: string
}

export async function suggestTextVariants(input: SuggestTextInput): Promise<{ suggestion: string }> {
  const ctx = await requireProjectCapability(input.projectId, 'edit')

  const response = await callAiAssist({
    action: 'text',
    mode: input.mode,
    field_key: input.fieldKey,
    field_type: input.fieldType,
    current_value: input.currentValue,
    custom_instruction: input.customInstruction ?? null,
    context: await getProjectContext(input.projectId),
  })

  const suggestion = response.suggestion
  if (typeof suggestion !== 'string' || !suggestion.trim()) {
    throw new Error(AI_UNAVAILABLE_MESSAGE)
  }

  await auditAi(ctx, input.projectId, 'AI_CONTENT_GENERATED', {
    kind: 'text',
    field_key: input.fieldKey,
    mode: input.mode,
  })

  return { suggestion: suggestion.trim() }
}

// --------------------------------------------------------------
// AI obrázky (§14) – výstup pouze do Media Library
// --------------------------------------------------------------

export interface GenerateImageInput {
  projectId: string
  prompt: string
  targetFieldKey?: string
}

export async function generateImageAsset(input: GenerateImageInput): Promise<MediaAsset> {
  const ctx = await requireProjectCapability(input.projectId, 'edit')

  const prompt = input.prompt.trim()
  if (!prompt) throw new Error('Popište, co má obrázek obsahovat')

  const response = await callAiAssist({ action: 'image', prompt })

  // odpověď: image_base64 nebo image_url
  let bytes: BlobPart
  if (typeof response.image_base64 === 'string' && response.image_base64) {
    bytes = Buffer.from(response.image_base64, 'base64')
  } else if (typeof response.image_url === 'string' && response.image_url) {
    try {
      const res = await fetch(response.image_url, { signal: AbortSignal.timeout(AI_TIMEOUT_MS) })
      if (!res.ok) throw new Error()
      bytes = Buffer.from(await res.arrayBuffer())
    } catch {
      throw new Error(AI_UNAVAILABLE_MESSAGE)
    }
  } else {
    throw new Error(AI_UNAVAILABLE_MESSAGE)
  }

  // Uložení do Media Library přes standardní upload logiku (magic bytes,
  // whitelist, scoped path, audit MEDIA_UPLOADED) – source 'ai'
  const file = new File([bytes], 'ai-generovane.png', { type: 'image/png' })
  const asset = await uploadMediaAsset({
    projectId: input.projectId,
    file,
    category: 'photo',
    altText: prompt.slice(0, 200),
  })

  // přepiš source na 'ai' (uploadMediaAsset defaultuje 'upload')
  const admin = createAdminClient()
  await admin.from('webdo24_media_assets').update({ source: 'ai' }).eq('id', asset.id)

  await auditAi(ctx, input.projectId, 'AI_CONTENT_GENERATED', {
    kind: 'image',
    asset_id: asset.id,
    target_field_key: input.targetFieldKey ?? null,
    prompt_preview: prompt.slice(0, 120),
  })

  return { ...asset, source: 'ai' }
}

// --------------------------------------------------------------
// Akceptace návrhu (§13 – „Použít návrh") – jen audit; samotné
// použití je client-side převzetí hodnoty do editoru → ChangeSet.
// --------------------------------------------------------------

export async function recordAiAcceptance(
  projectId: string,
  fieldKey: string,
  kind: 'text' | 'image',
): Promise<{ ok: true }> {
  const ctx = await requireProjectCapability(projectId, 'edit')
  await auditAi(ctx, projectId, 'AI_ACTION_ACCEPTED', { kind, field_key: fieldKey })
  return { ok: true }
}
