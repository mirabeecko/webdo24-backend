// ============================================
// Content — import obsahu a publikované verze
// REUSE: webdo24_content_fields (schema) + webdo24_content_values (hodnoty)
//        + getPublicContentMap (public read)
// ============================================

import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicContentMap } from '@/lib/ccc/registry'
import { getWebsiteBySiteId, updateWebsiteConnection } from './registry'
import type { DiscoveredContent } from '@/types/website-connection'

/** Importuje objevený obsah jako published (verze 1) do Content Registry. */
export async function importContent(projectId: string, customerId: string, items: DiscoveredContent[]): Promise<number> {
  const admin = createAdminClient()
  let imported = 0
  for (const item of items) {
    const { data: field, error: fErr } = await admin
      .from('webdo24_content_fields')
      .upsert(
        {
          project_id: projectId,
          customer_id: customerId,
          page_id: null,
          field_key: item.field_key,
          section_key: item.field_key.split('.')[0],
          field_type: item.field_type,
          label: item.label,
          validation: {},
          sort_order: imported * 10,
          schema_version: 1,
        },
        { onConflict: 'project_id,field_key' },
      )
      .select('id')
      .single()
    if (fErr) continue

    if (item.value !== undefined && item.value !== null && item.value !== '') {
      const { error: vErr } = await admin
        .from('webdo24_content_values')
        .upsert(
          { field_id: (field as { id: string }).id, published_value: item.value, published_at: new Date().toISOString() },
          { onConflict: 'field_id' },
        )
      if (vErr) continue
    }
    imported++
  }
  if (imported > 0) {
    await updateWebsiteConnection(customerId, projectId, { content_connected: true, last_sync_at: new Date().toISOString() })
  }
  return imported
}

/** Vrací publikovaný obsah pro veřejné API podle site_id. */
export async function getContentBySiteId(siteId: string): Promise<{ content: Record<string, unknown>; version: number } | null> {
  const site = await getWebsiteBySiteId(siteId)
  if (!site || !site.slug) return null
  const map = await getPublicContentMap(site.slug)
  // verze: počet publikovaných verzí (nebo current_version_id)
  const admin = createAdminClient()
  const { count } = await admin
    .from('webdo24_site_versions')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', site.id)
    .eq('status', 'live')
  return { content: map || {}, version: (count || 0) + 1 }
}
