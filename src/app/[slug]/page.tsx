export const dynamicParams = true
export const dynamic = 'force-dynamic'

// ============================================
// Veřejný renderer zákaznického webu (web.webdo24.cz/{slug})
// Website Contract v1 (architektura §4):
//   - primární zdroj: Content Registry (published hodnoty, bez auth)
//   - fallback: legacy webdo24_website_content (nemigrované projekty)
//   - editable binding: data-content-id / data-content-type (§4.2)
//   - preview overlay: ?__wd24_cs=&__wd24_preview=&__wd24_exp= (§6)
//   - meta webdo24:version pro post-publish verification (§5.3)
// ============================================

import { notFound } from 'next/navigation'
import { Phone, Mail, MapPin, Clock, Star } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicContentMap, type ContentMap } from '@/lib/ccc/registry'
import { verifyPreviewToken, getChangeSetDraftMap } from '@/lib/ccc/preview'
import { getPublicWebsiteData } from '@/lib/actions/web-admin'
import ContactForm from '@/components/public/ContactForm'
import {
  DATA_CONTENT_ID_ATTR,
  DATA_CONTENT_TYPE_ATTR,
  WEBDO24_SCHEMA_VERSION,
} from '@/types/website-contract'

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/** Editable binding atributy (§4.2) – stabilní spojení DOM ↔ Registry. */
function bind(fieldKey: string, fieldType: string) {
  return {
    [DATA_CONTENT_ID_ATTR]: fieldKey,
    [DATA_CONTENT_TYPE_ATTR]: fieldType,
  }
}

function text(map: ContentMap, key: string): string {
  const v = map[key]
  return typeof v === 'string' ? v : ''
}

type ImageValue = { asset_id?: string; url?: string; alt?: string }

function image(map: ContentMap, key: string): ImageValue | null {
  const v = map[key]
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    const rec = v as Record<string, unknown>
    if (typeof rec.url === 'string' && rec.url) {
      return { asset_id: rec.asset_id as string, url: rec.url, alt: rec.alt as string }
    }
  }
  return null
}

interface ServiceItem {
  title?: string
  description?: string
  price?: string
  image?: string
}

interface ReferenceItem {
  name?: string
  text?: string
  rating?: number
}

function arrayValue<T>(map: ContentMap, key: string): T[] {
  const v = map[key]
  return Array.isArray(v) ? (v as T[]) : []
}

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

// --------------------------------------------------------------
// Stránka
// --------------------------------------------------------------

export default async function PublicWebsitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const sp = await searchParams

  const admin = createAdminClient()
  const { data: project } = await admin
    .from('webdo24_projects')
    .select('id, title, slug, current_version_id')
    .eq('slug', slug)
    .maybeSingle()

  if (!project) notFound()

  // Registry obsah (published; fallback detekce: migrovaný projekt má
  // aspoň jednu homepage.* hodnotu z content_values)
  const contentMap = (await getPublicContentMap(slug)) ?? {}
  const hasRegistryContent = Object.keys(contentMap).some((k) => k.startsWith('homepage.'))

  // ── Preview overlay (§6) – jen registry režim; neplatný token =
  //    tiše produkční obsah, nic neuniká ──
  let preview: { title: string; count: number } | null = null
  let map = contentMap

  const csId = firstParam(sp.__wd24_cs)
  const token = firstParam(sp.__wd24_preview)
  const exp = firstParam(sp.__wd24_exp)

  if (hasRegistryContent && csId && token && exp) {
    if (await verifyPreviewToken(csId, token, exp)) {
      const draft = await getChangeSetDraftMap(csId)
      map = { ...contentMap, ...draft }
      const { data: cs } = await admin
        .from('webdo24_changesets')
        .select('title')
        .eq('id', csId)
        .maybeSingle()
      preview = { title: (cs?.title as string) ?? '', count: Object.keys(draft).length }
    }
  }

  // ── Legacy fallback (nemigrované projekty, §12.3) ──
  if (!hasRegistryContent) {
    return <LegacyWebsite slug={slug} />
  }

  // ── Registry render (Website Contract v1) ──
  const heroTitle = text(map, 'homepage.hero.title') || (project.title as string)
  const heroSubtitle = text(map, 'homepage.hero.subtitle')
  const heroImage = image(map, 'homepage.hero.hero_image')
  const aboutText = text(map, 'homepage.about.text')
  const services = arrayValue<ServiceItem>(map, 'homepage.services.items')
  const references = arrayValue<ReferenceItem>(map, 'homepage.references.items')

  const phone = text(map, 'company.phone')
  const email = text(map, 'company.email')
  const address = text(map, 'company.street')
  const hours = text(map, 'company.opening_hours')
  const logo = image(map, 'branding.logo_asset_id')

  const appUrl = process.env.APP_URL ?? 'https://login.webdo24.cz'

  return (
    <html lang="cs">
      <head>
        <title>{heroTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="webdo24:schema" content={String(WEBDO24_SCHEMA_VERSION)} />
        <meta
          name="webdo24:version"
          content={(project.current_version_id as string | null) ?? ''}
        />
      </head>
      <body className="bg-[#faf7f2] text-[#2c1810] font-sans">
        <header className="bg-white/95 backdrop-blur border-b border-[#e8e0d4] sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div
              className="text-xl font-bold text-[#8b5a2b] flex items-center gap-2"
              {...bind('branding.logo_asset_id', 'logo')}
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo.url} alt={logo.alt ?? ''} className="h-8 w-8 object-contain" />
              ) : (
                <span>🪵</span>
              )}
              {project.title}
            </div>
          </div>
        </header>

        <section className="max-w-5xl mx-auto px-4 py-16 text-center">
          <h1
            className="text-4xl md:text-5xl font-bold mb-6"
            {...bind('homepage.hero.title', 'text')}
          >
            {heroTitle}
          </h1>
          {heroSubtitle && (
            <p
              className="text-lg text-[#6b5d54] max-w-2xl mx-auto"
              {...bind('homepage.hero.subtitle', 'textarea')}
            >
              {heroSubtitle}
            </p>
          )}
          {heroImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage.url}
              alt={heroImage.alt ?? ''}
              className="mt-8 mx-auto max-h-80 rounded-2xl border border-[#e8e0d4] object-cover"
              {...bind('homepage.hero.hero_image', 'image')}
            />
          )}
          {phone && (
            <a
              href={`tel:${phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-[#8b5a2b] text-white rounded-xl font-medium hover:bg-[#6b4423] transition-colors"
              {...bind('company.phone', 'phone')}
            >
              <Phone className="h-5 w-5" /> {phone}
            </a>
          )}
        </section>

        {services.length > 0 && (
          <section className="max-w-5xl mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-center mb-8">Naše služby</h2>
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              {...bind('homepage.services.items', 'repeater')}
            >
              {services.map((s, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-[#e8e0d4] p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                  <p className="text-sm text-[#6b5d54]">{s.description}</p>
                  {s.price && (
                    <p className="text-sm text-[#8b5a2b] font-medium mt-3">{s.price}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {aboutText && (
          <section className="max-w-5xl mx-auto px-4 py-12">
            <div className="bg-white rounded-2xl border border-[#e8e0d4] p-8 shadow-sm">
              <h2 className="text-2xl font-bold mb-4">O nás</h2>
              <p
                className="text-[#6b5d54] leading-relaxed whitespace-pre-line"
                {...bind('homepage.about.text', 'textarea')}
              >
                {aboutText}
              </p>
            </div>
          </section>
        )}

        {references.length > 0 && (
          <section className="max-w-5xl mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-center mb-8">Co říkají zákazníci</h2>
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              {...bind('homepage.references.items', 'repeater')}
            >
              {references.map((t, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-[#e8e0d4] p-6 shadow-sm"
                >
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star
                        key={j}
                        className={`h-4 w-4 ${j < (t.rating ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-[#6b5d54] mb-4">&quot;{t.text}&quot;</p>
                  <p className="text-sm font-medium">{t.name}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="max-w-5xl mx-auto px-4 py-12">
          <div className="bg-[#8b5a2b] rounded-2xl p-8 text-white text-center">
            <h2 className="text-2xl font-bold mb-6">Kontaktujte nás</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              <div className="space-y-3 max-w-md mx-auto md:mx-0">
                {phone && (
                  <a
                    href={`tel:${phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-3 text-white/90 hover:text-white transition-colors"
                    {...bind('company.phone', 'phone')}
                  >
                    <Phone className="h-5 w-5" /> {phone}
                  </a>
                )}
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-3 text-white/90 hover:text-white transition-colors"
                    {...bind('company.email', 'email')}
                  >
                    <Mail className="h-5 w-5" /> {email}
                  </a>
                )}
                {address && (
                  <div
                    className="flex items-center gap-3 text-white/90"
                    {...bind('company.street', 'text')}
                  >
                    <MapPin className="h-5 w-5" /> {address}
                  </div>
                )}
                {hours && (
                  <div
                    className="flex items-center gap-3 text-white/90"
                    {...bind('company.opening_hours', 'text')}
                  >
                    <Clock className="h-5 w-5" /> {hours}
                  </div>
                )}
              </div>
              <ContactForm projectId={project.id as string} />
            </div>
          </div>
        </section>

        <footer className="text-center py-8 text-sm text-[#6b5d54]">
          © {new Date().getFullYear()} {project.title}. Všechna práva vyhrazena.
        </footer>

        {/* Preview bar (§6) – jen informační, publish akce jsou v dashboardu */}
        {preview && (
          <div className="fixed bottom-0 inset-x-0 z-[100] bg-amber-400 text-amber-950 px-4 py-2.5 text-sm flex flex-wrap items-center justify-center gap-x-3 gap-y-1 shadow-lg">
            <span>
              Náhled nepublikovaných změn · {preview.title} · {preview.count}{' '}
              {preview.count === 1 ? 'změna' : preview.count < 5 ? 'změny' : 'změn'}
            </span>
            <a
              href={`${appUrl}/obsah`}
              className="font-semibold underline underline-offset-2 hover:no-underline"
            >
              Zpět do administrace
            </a>
          </div>
        )}
      </body>
    </html>
  )
}

// --------------------------------------------------------------
// Legacy renderer (nemigrované projekty) – původní cesta beze změny
// --------------------------------------------------------------

async function LegacyWebsite({ slug }: { slug: string }) {
  const data = await getPublicWebsiteData(slug)
  if (!data) notFound()

  const { project, content, services, testimonials } = data

  const getContent = (key: string) =>
    (content as Array<{ section_key: string; content_value: string }>).find(
      (c) => c.section_key === key,
    )?.content_value || ''

  const heroTitle = getContent('hero_title') || project.title
  const heroSubtitle = getContent('hero_subtitle')
  const phone = getContent('phone')
  const email = getContent('email')
  const address = getContent('address')
  const hours = getContent('hours')
  const aboutText = getContent('about_text')

  return (
    <html lang="cs">
      <head>
        <title>{heroTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-[#faf7f2] text-[#2c1810] font-sans">
        <header className="bg-white/95 backdrop-blur border-b border-[#e8e0d4] sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="text-xl font-bold text-[#8b5a2b] flex items-center gap-2">
              <span>🪵</span>
              {project.title}
            </div>
          </div>
        </header>

        <section className="max-w-5xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">{heroTitle}</h1>
          {heroSubtitle && (
            <p className="text-lg text-[#6b5d54] max-w-2xl mx-auto">{heroSubtitle}</p>
          )}
          {phone && (
            <a
              href={`tel:${phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-[#8b5a2b] text-white rounded-xl font-medium hover:bg-[#6b4423] transition-colors"
            >
              <Phone className="h-5 w-5" /> {phone}
            </a>
          )}
        </section>

        {services.length > 0 && (
          <section className="max-w-5xl mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-center mb-8">Naše služby</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((s: { id: string; title: string; description: string; price: string | null }) => (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl border border-[#e8e0d4] p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                  <p className="text-sm text-[#6b5d54]">{s.description}</p>
                  {s.price && (
                    <p className="text-sm text-[#8b5a2b] font-medium mt-3">{s.price}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {aboutText && (
          <section className="max-w-5xl mx-auto px-4 py-12">
            <div className="bg-white rounded-2xl border border-[#e8e0d4] p-8 shadow-sm">
              <h2 className="text-2xl font-bold mb-4">O nás</h2>
              <p className="text-[#6b5d54] leading-relaxed whitespace-pre-line">{aboutText}</p>
            </div>
          </section>
        )}

        {testimonials.length > 0 && (
          <section className="max-w-5xl mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-center mb-8">Co říkají zákazníci</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {testimonials.map((t: { id: string; rating: number; text: string; customer_name: string }) => (
                <div
                  key={t.id}
                  className="bg-white rounded-2xl border border-[#e8e0d4] p-6 shadow-sm"
                >
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < t.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-[#6b5d54] mb-4">&quot;{t.text}&quot;</p>
                  <p className="text-sm font-medium">{t.customer_name}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="max-w-5xl mx-auto px-4 py-12">
          <div className="bg-[#8b5a2b] rounded-2xl p-8 text-white text-center">
            <h2 className="text-2xl font-bold mb-6">Kontaktujte nás</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              <div className="space-y-3 max-w-md mx-auto md:mx-0">
                {phone && (
                  <a
                    href={`tel:${phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-3 text-white/90 hover:text-white transition-colors"
                  >
                    <Phone className="h-5 w-5" /> {phone}
                  </a>
                )}
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-3 text-white/90 hover:text-white transition-colors"
                  >
                    <Mail className="h-5 w-5" /> {email}
                  </a>
                )}
                {address && (
                  <div className="flex items-center gap-3 text-white/90">
                    <MapPin className="h-5 w-5" /> {address}
                  </div>
                )}
                {hours && (
                  <div className="flex items-center gap-3 text-white/90">
                    <Clock className="h-5 w-5" /> {hours}
                  </div>
                )}
              </div>
              <ContactForm projectId={project.id} />
            </div>
          </div>
        </section>

        <footer className="text-center py-8 text-sm text-[#6b5d54]">
          © {new Date().getFullYear()} {project.title}. Všechna práva vyhrazena.
        </footer>
      </body>
    </html>
  )
}
