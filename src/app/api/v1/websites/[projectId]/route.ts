// GET /api/v1/websites/{projectId} – stav webu (§9)
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjectCapability } from '@/lib/ccc/guard'
import { cccErrorResponse } from '@/lib/ccc/http'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params
    await requireProjectCapability(projectId, 'view')

    const admin = createAdminClient()
    const { data: project, error } = await admin
      .from('webdo24_projects')
      .select('id, slug, status, production_url, custom_domain, current_version_id, hosting_status')
      .eq('id', projectId)
      .single()

    if (error || !project) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    let lastPublishedAt: string | null = null
    if (project.current_version_id) {
      const { data: version } = await admin
        .from('webdo24_site_versions')
        .select('published_at')
        .eq('id', project.current_version_id)
        .maybeSingle()
      lastPublishedAt = (version?.published_at as string | null) ?? null
    }

    return NextResponse.json({
      id: project.id,
      slug: project.slug,
      status: project.status,
      online: project.status === 'deployed',
      production_url: project.production_url,
      custom_domain: project.custom_domain,
      hosting_status: project.hosting_status,
      current_version_id: project.current_version_id,
      last_published_at: lastPublishedAt,
    })
  } catch (err) {
    return cccErrorResponse(err)
  }
}
