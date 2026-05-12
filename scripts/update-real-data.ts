import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function update() {
  console.log('🔄 Aktualizuji reálná data z webu...\n')

  // Najít projekt
  const { data: project } = await supabase
    .from('webdo24_projects')
    .select('id')
    .eq('slug', 'truhlarstvi-drevorez')
    .single()

  if (!project) {
    console.error('Projekt nenalezen!')
    process.exit(1)
  }

  const projectId = project.id

  // 1. Aktualizovat obsah webu
  console.log('1. Aktualizuji obsah webu...')
  await supabase.from('webdo24_website_content').delete().eq('project_id', projectId)
  const { error: wcErr } = await supabase.from('webdo24_website_content').insert([
    { project_id: projectId, section_key: 'hero_title', content_type: 'text', content_value: 'Nábytek na míru z masivu – Plzeň', sort_order: 1 },
    { project_id: projectId, section_key: 'hero_subtitle', content_type: 'textarea', content_value: 'Rodinné truhlářství s 15letou tradicí. Vyrábíme kuchyně, vestavěné skříně, schodiště a veškerý interiérový nábytek přesně podle vašich představ.', sort_order: 2 },
    { project_id: projectId, section_key: 'phone', content_type: 'phone', content_value: '+420 777 123 456', sort_order: 3 },
    { project_id: projectId, section_key: 'email', content_type: 'text', content_value: 'info@drevorez.cz', sort_order: 4 },
    { project_id: projectId, section_key: 'address', content_type: 'text', content_value: 'Truhlářská 12, Plzeň', sort_order: 5 },
    { project_id: projectId, section_key: 'hours', content_type: 'text', content_value: 'Po–Pá: 7:00–16:00', sort_order: 6 },
    { project_id: projectId, section_key: 'about_text', content_type: 'textarea', content_value: 'Jsme rodinné truhlářství z Plzně s více než 15letou tradicí. Vše vyrábíme ručně ve vlastní dílně s důrazem na kvalitu zpracování a volbu materiálů.\n\nKaždá zakázka začíná osobní konzultací a zaměřením zdarma. Vypracujeme 3D vizualizaci, abyste přesně věděli, jak bude výsledek vypadat – ještě před zahájením výroby.\n\nPracujeme po celém Plzeňském kraji a západních Čechách. Naši zákazníci se k nám opakovaně vrací – nejlepší vizitkou pro nás jsou jejich doporučení.', sort_order: 7 },
  ])
  if (wcErr) console.error('   Chyba:', wcErr.message)
  else console.log('   ✓ Obsah aktualizován')

  // 2. Aktualizovat služby
  console.log('\n2. Aktualizuji služby...')
  await supabase.from('webdo24_services').delete().eq('project_id', projectId)
  const { error: svcErr } = await supabase.from('webdo24_services').insert([
    { project_id: projectId, title: 'Kuchyně na míru', description: 'Kuchyňské linky šité na míru vašemu prostoru. Masiv, dýha i lamino. Zaměření a 3D návrh zdarma.', sort_order: 1 },
    { project_id: projectId, title: 'Vestavěné skříně', description: 'Vestavěné skříně a šatny využívající každý centimetr prostoru. Posuvné i klasické dveře.', sort_order: 2 },
    { project_id: projectId, title: 'Schodiště', description: 'Dřevěná schodiště z masivního dřeva. Přímá, točitá, s kovaným zábradlím nebo bez.', sort_order: 3 },
    { project_id: projectId, title: 'Obývací pokoje', description: 'Televizní stěny, knihovny, police a veškerý obývací nábytek dle vašeho přání a stylu interiéru.', sort_order: 4 },
    { project_id: projectId, title: 'Ložnicový nábytek', description: 'Postele, noční stolky, komody a šatní skříně z masivu. Trvanlivé a nadčasové.', sort_order: 5 },
    { project_id: projectId, title: 'Komerční interiéry', description: 'Vybavení kanceláří, restaurací, hotelů a prodejen. Zakázková výroba pro firmy i instituce.', sort_order: 6 },
  ])
  if (svcErr) console.error('   Chyba:', svcErr.message)
  else console.log('   ✓ Služby aktualizovány')

  // 3. Aktualizovat reference
  console.log('\n3. Aktualizuji reference...')
  await supabase.from('webdo24_testimonials').delete().eq('project_id', projectId)
  const { error: testErr } = await supabase.from('webdo24_testimonials').insert([
    { project_id: projectId, customer_name: 'Paní Nováková', rating: 5, text: 'Kuchyně předčila veškerá naše očekávání. Přesná montáž, krásné zpracování a vše proběhlo přesně dle dohodnutého termínu. Určitě doporučuji!' },
    { project_id: projectId, customer_name: 'Pan Svoboda', rating: 5, text: 'Nechali jsme si vyrobit vestavěnou skříň do šikmé střechy – naprosto perfektní využití prostoru. Pánové jsou profíci, komunikace bezproblémová.' },
    { project_id: projectId, customer_name: 'Paní Kučerová', rating: 5, text: 'Schodiště z dubového masivu je paráda. Zaměření, vizualizace, výroba i montáž – vše na jedničku. Děkujeme celému týmu Dřevořezu!' },
  ])
  if (testErr) console.error('   Chyba:', testErr.message)
  else console.log('   ✓ Reference aktualizovány')

  console.log('\n✅ Hotovo!')
}

update().catch(console.error)
