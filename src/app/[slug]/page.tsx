export const dynamicParams = true
export const revalidate = 60

import { notFound } from 'next/navigation'
import { getPublicWebsiteData } from '@/lib/actions/web-admin'
import { Phone, Mail, MapPin, Clock, Star } from 'lucide-react'

export default async function PublicWebsitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getPublicWebsiteData(slug)

  if (!data) notFound()

  const { project, content, services, testimonials } = data

  const getContent = (key: string) => content.find((c: any) => c.section_key === key)?.content_value || ''

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
          {heroSubtitle && <p className="text-lg text-[#6b5d54] max-w-2xl mx-auto">{heroSubtitle}</p>}
          {phone && (
            <a href={`tel:${phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-[#8b5a2b] text-white rounded-xl font-medium hover:bg-[#6b4423] transition-colors">
              <Phone className="h-5 w-5" /> {phone}
            </a>
          )}
        </section>

        {services.length > 0 && (
          <section className="max-w-5xl mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-center mb-8">Naše služby</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((s: any) => (
                <div key={s.id} className="bg-white rounded-2xl border border-[#e8e0d4] p-6 shadow-sm hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                  <p className="text-sm text-[#6b5d54]">{s.description}</p>
                  {s.price && <p className="text-sm text-[#8b5a2b] font-medium mt-3">{s.price}</p>}
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
              {testimonials.map((t: any) => (
                <div key={t.id} className="bg-white rounded-2xl border border-[#e8e0d4] p-6 shadow-sm">
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < t.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                    ))}
                  </div>
                  <p className="text-sm text-[#6b5d54] mb-4">"{t.text}"</p>
                  <p className="text-sm font-medium">{t.customer_name}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="max-w-5xl mx-auto px-4 py-12">
          <div className="bg-[#8b5a2b] rounded-2xl p-8 text-white text-center">
            <h2 className="text-2xl font-bold mb-6">Kontaktujte nás</h2>
            <div className="space-y-3 max-w-md mx-auto">
              {phone && (
                <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex items-center justify-center gap-3 text-white/90 hover:text-white transition-colors">
                  <Phone className="h-5 w-5" /> {phone}
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="flex items-center justify-center gap-3 text-white/90 hover:text-white transition-colors">
                  <Mail className="h-5 w-5" /> {email}
                </a>
              )}
              {address && (
                <div className="flex items-center justify-center gap-3 text-white/90">
                  <MapPin className="h-5 w-5" /> {address}
                </div>
              )}
              {hours && (
                <div className="flex items-center justify-center gap-3 text-white/90">
                  <Clock className="h-5 w-5" /> {hours}
                </div>
              )}
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
