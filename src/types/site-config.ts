// Site Config Schema — co AI může měnit
// Renderer bere tento JSON a builduje web. AI nikdy nemá přímý přístup ke kódu.

export interface SiteConfig {
  schema_version: number
  branding: BrandingConfig
  seo: SEOConfig
  sections: SiteSection[]
  services: ServiceItem[]
  leadForms: LeadForm[]
  contact: ContactConfig
  social: SocialConfig
}

export interface BrandingConfig {
  name?: string
  tagline?: string
  primary_color?: string
  accent_color?: string
  logo_url?: string
  font_heading?: string
  font_body?: string
}

export interface SEOConfig {
  title?: string
  description?: string
  keywords?: string[]
  og_image_url?: string
  google_analytics_id?: string
}

export interface SiteSection {
  id: string
  type: SectionType
  visible: boolean
  order: number
  fields: Record<string, unknown>
}

export type SectionType =
  | 'hero'
  | 'services'
  | 'about'
  | 'testimonials'
  | 'contact'
  | 'gallery'
  | 'faq'
  | 'cta'
  | 'booking'
  | 'pricing'
  | 'team'
  | 'custom'

export interface ServiceItem {
  id: string
  title: string
  description?: string
  price?: string
  icon?: string
  cta_label?: string
  cta_url?: string
  visible: boolean
}

export interface LeadForm {
  id: string
  name: string
  fields: FormField[]
  destination_email?: string
  success_message?: string
  placement?: string
}

export interface FormField {
  key: string
  label: string
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'date'
  required: boolean
  options?: string[]
  placeholder?: string
}

export interface ContactConfig {
  phone?: string
  email?: string
  address?: string
  hours?: string
  whatsapp?: string
  map_embed_url?: string
}

export interface SocialConfig {
  facebook?: string
  instagram?: string
  linkedin?: string
  youtube?: string
  tiktok?: string
}

// Prázdná výchozí konfigurace
export const EMPTY_SITE_CONFIG: SiteConfig = {
  schema_version: 1,
  branding: {},
  seo: {},
  sections: [],
  services: [],
  leadForms: [],
  contact: {},
  social: {},
}
