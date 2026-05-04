import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function seed() {
  console.log('Seeding data...')

  // Create admin user
  const { data: adminUser, error: adminError } = await admin.auth.admin.createUser({
    email: 'admin@webdo24.cz',
    password: 'Admin123!',
    email_confirm: true,
    user_metadata: { role: 'admin', name: 'Admin' },
  })

  if (adminError) {
    console.error('Admin user error:', adminError)
    return
  }

  console.log('Admin user created:', adminUser.user?.id)

  // Create customer user
  const { data: customerUser, error: customerError } = await admin.auth.admin.createUser({
    email: 'customer@webdo24.cz',
    password: 'Customer123!',
    email_confirm: true,
    user_metadata: { role: 'customer', name: 'Jan Novák' },
  })

  if (customerError) {
    console.error('Customer user error:', customerError)
    return
  }

  console.log('Customer user created:', customerUser.user?.id)

  // Create customer record
  const { data: customer, error: customerRecordError } = await admin
    .from('webdo24_customers')
    .insert({
      user_id: customerUser.user!.id,
      name: 'Jan Novák',
      email: 'customer@webdo24.cz',
      phone: '+420 123 456 789',
      company: 'Novák s.r.o.',
      ico: '12345678',
      address: 'Praha 1, Václavské náměstí 1',
    })
    .select()
    .single()

  if (customerRecordError) {
    console.error('Customer record error:', customerRecordError)
    return
  }

  console.log('Customer record created:', customer.id)

  // Create projects
  const projects = [
    {
      customer_id: customer.id,
      title: 'Web pro Novák s.r.o.',
      slug: 'web-pro-novak-sro-' + Date.now(),
      business_type: 'Stavebnictví',
      target_audience: 'Firmy a domácnosti',
      location: 'Praha',
      language: 'cs',
      status: 'submitted',
      pipeline_type: 'standard',
      price_type: 'one_time',
      domain: 'novak-sro.cz',
    },
    {
      customer_id: customer.id,
      title: 'E-shop s elektronikou',
      slug: 'e-shop-s-elektronikou-' + Date.now(),
      business_type: 'Elektronika',
      target_audience: 'Spotřebitelé',
      location: 'Brno',
      language: 'cs',
      status: 'generating',
      pipeline_type: 'ecommerce',
      price_type: 'monthly',
      domain: 'elektro-shop.cz',
    },
  ]

  for (const project of projects) {
    const { data: createdProject, error: projectError } = await admin
      .from('webdo24_projects')
      .insert(project)
      .select()
      .single()

    if (projectError) {
      console.error('Project error:', projectError)
      continue
    }

    console.log('Project created:', createdProject.id)

    // Create brief
    await admin.from('webdo24_project_briefs').insert({
      project_id: createdProject.id,
      raw_input: JSON.stringify(project),
      business_description: 'Popis firmy...',
      services: 'Služba 1, Služba 2',
      contacts: 'Email: info@example.com, Tel: 123456789',
      required_sections: 'Úvod, O nás, Služby, Kontakt',
    })

    // Create event
    await admin.from('webdo24_project_events').insert({
      project_id: createdProject.id,
      event_type: 'project_created',
      message: 'Project created via seed script',
    })
  }

  // Create pipeline run for the second project
  const { data: secondProject } = await admin
    .from('webdo24_projects')
    .select('id')
    .eq('customer_id', customer.id)
    .eq('status', 'generating')
    .single()

  if (secondProject) {
    const { data: pipelineRun, error: runError } = await admin
      .from('webdo24_pipeline_runs')
      .insert({
        project_id: secondProject.id,
        pipeline_type: 'ecommerce',
        status: 'running',
        input_json: { test: true },
      })
      .select()
      .single()

    if (runError) {
      console.error('Pipeline run error:', runError)
    } else {
      console.log('Pipeline run created:', pipelineRun.id)
    }
  }

  console.log('Seed completed!')
  console.log('')
  console.log('Login credentials:')
  console.log('Admin: admin@webdo24.cz / Admin123!')
  console.log('Customer: customer@webdo24.cz / Customer123!')
}

seed().catch(console.error)
