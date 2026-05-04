import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const project_id = formData.get('project_id') as string

    if (!file || !project_id) {
      return NextResponse.json(
        { error: 'file and project_id are required' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Verify project exists and user has access
    const { data: project, error: projectError } = await admin
      .from('webdo24_projects')
      .select('customer_id')
      .eq('id', project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { data: customer } = await admin
      .from('webdo24_customers')
      .select('user_id')
      .eq('id', project.customer_id)
      .single()

    const isAdmin = user.user_metadata?.role === 'admin'
    const isOwner = customer?.user_id === user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
    const filePath = `${project_id}/${fileName}`

    const { error: uploadError } = await admin.storage
      .from('webdo24-files')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: 'Upload failed', details: uploadError },
        { status: 500 }
      )
    }

    const { data: publicUrl } = admin.storage
      .from('webdo24-files')
      .getPublicUrl(filePath)

    // Save record to database
    const { data: fileRecord, error: dbError } = await admin
      .from('webdo24_project_files')
      .insert({
        project_id,
        file_name: file.name,
        file_url: publicUrl.publicUrl,
        file_type: file.type,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json(
        { error: 'Failed to save file record', details: dbError },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, file: fileRecord })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
