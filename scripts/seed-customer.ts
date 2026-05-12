import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Chybí env vars NEXT_PUBLIC_SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const USER_EMAIL = 'karel.poctak@seznam.cz'
const USER_PASSWORD = 'Webdo24!Test'

async function seed() {
  console.log('🌱 Seeduji zákazníka WEBDO24 LEAD MACHINE™...\n')

  // 1. Vytvořit nebo najít uživatele
  console.log('1. Kontrola uživatele:', USER_EMAIL)
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find((u: any) => u.email === USER_EMAIL)

  let userId: string

  if (existingUser) {
    console.log('   ✓ Uživatel už existuje, ID:', existingUser.id)
    userId = existingUser.id
    await supabase.auth.admin.updateUserById(userId, {
      password: USER_PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'customer' },
    })
    console.log('   ✓ Heslo aktualizováno')
  } else {
    console.log('   → Vytvářím nového uživatele...')
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: USER_EMAIL,
      password: USER_PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'customer' },
    })
    if (createErr) {
      console.error('   ✗ Chyba:', createErr.message)
      process.exit(1)
    }
    userId = newUser.user!.id
    console.log('   ✓ Uživatel vytvořen, ID:', userId)
  }

  // 2. Vytvořit/získat zákazníka (bez address - nemusí existovat)
  console.log('\n2. Kontrola zákazníka...')
  const { data: existingCustomer } = await supabase
    .from('webdo24_customers')
    .select('id')
    .eq('email', USER_EMAIL)
    .single()

  let customerId: string

  if (existingCustomer) {
    console.log('   ✓ Zákazník už existuje, ID:', existingCustomer.id)
    customerId = existingCustomer.id
    await supabase.from('webdo24_customers').update({ user_id: userId }).eq('id', customerId)
  } else {
    console.log('   → Vytvářím zákazníka...')
    const { data: newCustomer, error } = await supabase
      .from('webdo24_customers')
      .insert({
        user_id: userId,
        name: 'Karel Počták',
        email: USER_EMAIL,
        phone: '777 888 999',
        company: 'Truhlářství Dřevořez',
      })
      .select('id')
      .single()
    if (error) {
      console.error('   ✗ Chyba:', error.message)
      process.exit(1)
    }
    customerId = newCustomer!.id
    console.log('   ✓ Zákazník vytvořen, ID:', customerId)
  }

  // 3. Vytvořit/získat projekt
  console.log('\n3. Kontrola projektu (truhlarstvi-drevorez)...')
  const { data: existingProject } = await supabase
    .from('webdo24_projects')
    .select('id')
    .eq('slug', 'truhlarstvi-drevorez')
    .single()

  let projectId: string

  if (existingProject) {
    console.log('   ✓ Projekt už existuje, ID:', existingProject.id)
    projectId = existingProject.id
    await supabase.from('webdo24_projects').update({ customer_id: customerId }).eq('id', projectId)
  } else {
    console.log('   → Vytvářím projekt...')
    const { data: newProject, error } = await supabase
      .from('webdo24_projects')
      .insert({
        customer_id: customerId,
        title: 'Truhlářství Dřevořez',
        slug: 'truhlarstvi-drevorez',
        business_type: 'Truhlářství',
        location: 'Praha',
        status: 'deployed',
        domain: 'truhlarstvi-drevorez.webdo24.cz',
        production_url: 'https://web.webdo24.cz/truhlarstvi-drevorez/',
        language: 'cs',
        price_type: 'monthly',
      })
      .select('id')
      .single()
    if (error) {
      console.error('   ✗ Chyba:', error.message)
      process.exit(1)
    }
    projectId = newProject!.id
    console.log('   ✓ Projekt vytvořen, ID:', projectId)
  }

  // 4. Vytvořit leady
  console.log('\n4. Seeduji poptávky...')
  const leadsData = [
    { project_id: projectId, name: 'Anna Nováková', phone: '777 123 456', email: 'anna@email.cz', message: 'Dobrý den, chtěla bych se zeptat na cenu zakázkové výroby jídelního stolu z dubového masivu. Můžete mi prosím zavolat?', source: 'web', status: 'new' },
    { project_id: projectId, name: 'Petr Svoboda', phone: '608 987 654', email: 'petr@seznam.cz', message: 'Dobrý den, potřebuji opravit dřevěné schodiště, které je poškozené. Kolik by to přibližně stálo?', source: 'form', status: 'new' },
    { project_id: projectId, name: 'Jana Horáková', phone: '725 333 111', email: 'jana@email.cz', message: 'Dobrý den, mám zájem o výrobu vestavěné skříně do ložnice. Jaké máte volné termíny?', source: 'whatsapp', status: 'contacted' },
    { project_id: projectId, name: 'Milan Kučera', phone: '602 444 888', email: 'milan@firm.cz', message: 'Potřebuji vyrobit dřevěnou pergolu na zahradu. Máte zkušenosti s tímto typem zakázky?', source: 'web', status: 'negotiation' },
    { project_id: projectId, name: 'Lenka Veselá', phone: '731 222 999', email: 'lenka@gmail.com', message: 'Děkuji moc za krásnou zakázku. Stůl je přesně podle mých představ, určitě doporučím dál.', source: 'email', status: 'done' },
    { project_id: projectId, name: 'Tomáš Novotný', phone: '777 555 333', email: 'tomas@email.cz', message: 'Poptávám výrobu kuchyňské linky na míru. Můžete přijet na zaměření?', source: 'web', status: 'new' },
  ]

  await supabase.from('webdo24_leads').delete().eq('project_id', projectId)
  const { data: leads, error: leadsErr } = await supabase
    .from('webdo24_leads')
    .insert(leadsData)
    .select('id')
  if (leadsErr) {
    console.error('   ✗ Chyba leady:', leadsErr.message)
    console.error('   → Zřejmě chybí tabulka webdo24_leads. Spusťte SQL migraci.')
  } else {
    console.log('   ✓ Vytvořeno', leads?.length, 'poptávek')

    // 5. Zprávy
    console.log('\n5. Seeduji zprávy...')
    if (leads && leads.length > 0) {
      const messagesData = [
        { lead_id: leads[0].id, sender_type: 'customer', content: 'Dobrý den, chtěla bych se zeptat na cenu zakázkové výroby jídelního stolu z dubového masivu. Můžete mi prosím zavolat?' },
        { lead_id: leads[0].id, sender_type: 'ai', content: 'Dobrý den Anno, děkuji za zájem o naše truhlářské služby. Rád bych se s vámi domluvil na podrobnostech stolu. Mohli bychom si zavolat zítra dopoledne?', is_ai_suggestion: true, ai_action: 'reply' },
        { lead_id: leads[2].id, sender_type: 'customer', content: 'Dobrý den, mám zájem o výrobu vestavěné skříně do ložnice. Jaké máte volné termíny?' },
        { lead_id: leads[2].id, sender_type: 'user', content: 'Dobrý den, děkuji za zájem. Mám volno ve středu a pátek dopoledne. Co by vám vyhovovalo?' },
        { lead_id: leads[2].id, sender_type: 'customer', content: 'Děkuji, zítra se stavím v 10:00.' },
        { lead_id: leads[2].id, sender_type: 'user', content: 'Skvělé, budu se těšit. Adresa je U Dřevařů 12, Praha 8.' },
        { lead_id: leads[4].id, sender_type: 'customer', content: 'Děkuji moc za krásnou zakázku. Stůl je přesně podle mých představ, určitě doporučím dál.' },
      ]
      await supabase.from('webdo24_messages').delete().in('lead_id', leads.map((l: any) => l.id))
      const { error: msgErr } = await supabase.from('webdo24_messages').insert(messagesData)
      if (msgErr) console.error('   ✗ Chyba zprávy:', msgErr.message)
      else console.log('   ✓ Vytvořeno', messagesData.length, 'zpráv')
    }
  }

  // 6. Obsah webu
  console.log('\n6. Seeduji obsah webu...')
  await supabase.from('webdo24_website_content').delete().eq('project_id', projectId)
  const { error: contentErr } = await supabase.from('webdo24_website_content').insert([
    { project_id: projectId, section_key: 'hero_title', content_type: 'text', content_value: 'Truhlářství Dřevořez', sort_order: 1 },
    { project_id: projectId, section_key: 'hero_subtitle', content_type: 'textarea', content_value: 'Tradiční řemeslo s moderním přístupem. Zakázková výroba nábytku, schodišť a dřevěných konstrukcí v Praze a okolí.', sort_order: 2 },
    { project_id: projectId, section_key: 'phone', content_type: 'phone', content_value: '777 888 999', sort_order: 3 },
    { project_id: projectId, section_key: 'email', content_type: 'text', content_value: 'info@drevorez.cz', sort_order: 4 },
    { project_id: projectId, section_key: 'address', content_type: 'text', content_value: 'Praha 8, U Dřevařů 12', sort_order: 5 },
    { project_id: projectId, section_key: 'hours', content_type: 'text', content_value: 'Po–Pá: 7:00–18:00', sort_order: 6 },
    { project_id: projectId, section_key: 'about_text', content_type: 'textarea', content_value: 'Jsme rodinné truhlářství s více než 20letou tradicí. Specializujeme se na zakázkovou výrobu nábytku, dřevěných schodišť, oken a dveří. Každý kus je originál, vyrobený s láskou k řemeslu a z těch nejkvalitnějších materiálů.', sort_order: 7 },
  ])
  if (contentErr) {
    console.error('   ✗ Chyba obsah:', contentErr.message)
    console.error('   → Zřejmě chybí tabulka webdo24_website_content. Spusťte SQL migraci.')
  } else {
    console.log('   ✓ Obsah webu vytvořen')
  }

  // 7. Reference
  console.log('\n7. Seeduji reference...')
  await supabase.from('webdo24_testimonials').delete().eq('project_id', projectId)
  const { error: testErr } = await supabase.from('webdo24_testimonials').insert([
    { project_id: projectId, customer_name: 'Anna Nováková', rating: 5, text: 'Úžasný jídelní stůl přesně podle mých představ. Kvalita provedení je vynikající, doporučuji všem!' },
    { project_id: projectId, customer_name: 'Petr Svoboda', rating: 5, text: 'Oprava schodiště proběhla rychle a profesionálně. Velmi ochotný přístup, férová cena.' },
    { project_id: projectId, customer_name: 'Jana Horáková', rating: 4, text: 'Vestavěná skříň je krásná, akorát dodání trvalo o týden déle než bylo domluveno.' },
    { project_id: projectId, customer_name: 'Milan Kučera', rating: 5, text: 'Pergola na zahradě vypadá fantasticky. Precizní práce, kvalitní dřevo.' },
    { project_id: projectId, customer_name: 'Lenka Veselá', rating: 5, text: 'Kuchyňská linka na míru je dokonalá. Každý detail promyšlený, používání je radost.' },
  ])
  if (testErr) {
    console.error('   ✗ Chyba reference:', testErr.message)
    console.error('   → Zřejmě chybí tabulka webdo24_testimonials. Spusťte SQL migraci.')
  } else {
    console.log('   ✓ Reference vytvořeny')
  }

  // 8. Služby
  console.log('\n8. Seeduji služby...')
  await supabase.from('webdo24_services').delete().eq('project_id', projectId)
  const { error: svcErr } = await supabase.from('webdo24_services').insert([
    { project_id: projectId, title: 'Zakázkový nábytek', description: 'Jídelní stoly, židle, postele, skříně – vše na míru podle vašich představ.', price: 'od 15 000 Kč', sort_order: 1 },
    { project_id: projectId, title: 'Dřevěná schodiště', description: 'Výroba a montáž vnitřních i venkovních schodišť z masivního dřeva.', price: 'od 80 000 Kč', sort_order: 2 },
    { project_id: projectId, title: 'Kuchyně na míru', description: 'Kompletní výroba kuchyňských linek včetně pracovních desek.', price: 'od 120 000 Kč', sort_order: 3 },
    { project_id: projectId, title: 'Dřevěné pergoly a altány', description: 'Zahradní stavby z kvalitního dřeva s dlouhou životností.', price: 'od 60 000 Kč', sort_order: 4 },
    { project_id: projectId, title: 'Opravy a renovace', description: 'Renovace starého nábytku, opravy schodišť, dveří a oken.', price: 'od 2 500 Kč', sort_order: 5 },
  ])
  if (svcErr) {
    console.error('   ✗ Chyba služby:', svcErr.message)
    console.error('   → Zřejmě chybí tabulka webdo24_services. Spusťte SQL migraci.')
  } else {
    console.log('   ✓ Služby vytvořeny')
  }

  // 9. Automatizace
  console.log('\n9. Seeduji automatizace...')
  await supabase.from('webdo24_automations').delete().eq('customer_id', customerId)
  const { error: autoErr } = await supabase.from('webdo24_automations').insert([
    { customer_id: customerId, automation_key: 'auto_reply', enabled: true, template: 'Děkujeme za poptávku. Ozveme se do 2 hodin.' },
    { customer_id: customerId, automation_key: 'notify_owner', enabled: true, template: 'Máte novou poptávku od {{name}}.' },
    { customer_id: customerId, automation_key: 'follow_up', enabled: false, template: 'Dobrý den, chtěl bych se zeptat, zda máte zájem o naše služby...' },
    { customer_id: customerId, automation_key: 'review_request', enabled: true, template: 'Děkujeme za spolupráci. Budeme rádi, když nám zanecháte recenzi.' },
    { customer_id: customerId, automation_key: 'ai_reply', enabled: false },
    { customer_id: customerId, automation_key: 'ai_improve', enabled: true },
    { customer_id: customerId, automation_key: 'ai_social', enabled: false },
  ])
  if (autoErr) {
    console.error('   ✗ Chyba automatizace:', autoErr.message)
    console.error('   → Zřejmě chybí tabulka webdo24_automations. Spusťte SQL migraci.')
  } else {
    console.log('   ✓ Automatizace vytvořeny')
  }

  // 10. Analytics
  console.log('\n10. Seeduji návštěvnost...')
  await supabase.from('webdo24_analytics').delete().eq('project_id', projectId)
  const analyticsData = []
  const today = new Date()
  for (let i = 0; i < 14; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const views = Math.floor(Math.random() * 80) + 20
    const visitors = Math.floor(views * 0.6)
    const forms = Math.floor(Math.random() * 3)
    analyticsData.push({ project_id: projectId, event_date: dateStr, page_views: views, unique_visitors: visitors, form_submissions: forms })
  }
  const { error: anaErr } = await supabase.from('webdo24_analytics').insert(analyticsData)
  if (anaErr) {
    console.error('   ✗ Chyba analytics:', anaErr.message)
    console.error('   → Zřejmě chybí tabulka webdo24_analytics. Spusťte SQL migraci.')
  } else {
    console.log('   ✓ Analytics vytvořeno (14 dní)')
  }

  console.log('\n✅ Hotovo!')
  console.log('\n📋 Shrnutí:')
  console.log('   Email:', USER_EMAIL)
  console.log('   Heslo:', USER_PASSWORD)
  console.log('   Web: https://web.webdo24.cz/truhlarstvi-drevorez/')
  console.log('   Projekt: Truhlářství Dřevořez')
  console.log('\n🔑 Přihlášení na http://localhost:3001/login')
}

seed().catch((err) => {
  console.error('❌ Chyba:', err)
  process.exit(1)
})
