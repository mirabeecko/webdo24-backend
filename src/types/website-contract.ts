// ============================================
// WebDo24 Website Contract v1  (architektura §4)
// Customer Control Center – kanonický content model (sql/011)
// ============================================

/** Verze kontraktu, kterou web/šablona deklaruje. */
export type Webdo24SchemaVersion = 1;

export const WEBDO24_SCHEMA_VERSION: Webdo24SchemaVersion = 1;

/**
 * HTML atribut pro editable binding (§4 pravidlo 2):
 * renderer obalí editovatelné místo data-content-id="homepage.hero.title".
 */
export const DATA_CONTENT_ID_ATTR = 'data-content-id';
export const DATA_CONTENT_TYPE_ATTR = 'data-content-type';

// ============================================
// Content Registry  (§3.2)
// ============================================

export type FieldType =
  | 'text'
  | 'textarea'
  | 'rich_text'
  | 'number'
  | 'boolean'
  | 'url'
  | 'email'
  | 'phone'
  | 'image'
  | 'gallery'
  | 'logo'
  | 'video'
  | 'file'
  | 'color'
  | 'select'
  | 'repeater'
  | 'cta';

export type PageStatus = 'draft' | 'published' | 'archived';

export interface Page {
  id: string;
  project_id: string;
  customer_id: string;
  slug: string;                        // 'home', 'o-nas', 'sluzby', 'kontakt'
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  status: PageStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Validační pravidla pole (content_fields.validation). */
export interface FieldValidation {
  max_length?: number;
  pattern?: string;
  required?: boolean;
  options?: string[];
}

export interface ContentField {
  id: string;
  project_id: string;
  customer_id: string;
  page_id: string | null;              // null = globální pole
  field_key: string;                   // 'homepage.hero.title', 'company.phone'
  section_key: string | null;          // 'hero', 'services', 'footer'
  field_type: FieldType;
  label: string;                       // 'Hlavní nadpis' (česky, pro UI)
  validation: FieldValidation;
  sort_order: number;
  schema_version: number;
  created_at: string;
  updated_at: string;
}

/**
 * Hodnota pole. Draft záměrně NENÍ součástí – žije výhradně v
 * changeset_items.new_value, čímž je vynucená jediná cesta do produkce (§22).
 */
export interface ContentValue {
  field_id: string;
  published_value: unknown | null;
  published_at: string | null;
  updated_at: string;
}

/** Pole joinuté s published hodnotou (pro editor i renderer). */
export interface ContentFieldWithValue extends ContentField {
  published_value: unknown | null;
  published_at: string | null;
}

// ============================================
// Globální profily  (§3.3)
// ============================================

export interface CompanyProfile {
  project_id: string;
  customer_id: string;
  company_name: string | null;
  ico: string | null;
  dic: string | null;
  street: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  secondary_phone: string | null;
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  youtube: string | null;
  opening_hours: Record<string, string> | null;   // {po: "8:00–17:00", ...}
  google_maps_url: string | null;
  updated_at: string;
}

export interface BrandProfile {
  project_id: string;
  customer_id: string;
  logo_asset_id: string | null;
  logo_light_asset_id: string | null;
  logo_dark_asset_id: string | null;
  favicon_asset_id: string | null;
  icon_asset_id: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  updated_at: string;
}

// ============================================
// ChangeSet engine  (§3.4)
// ============================================

export type ChangeSetStatus =
  | 'draft'
  | 'validated'
  | 'preview_ready'
  | 'approved'
  | 'publishing'
  | 'published'
  | 'publish_failed'
  | 'cancelled';

export type ChangeSetSource = 'gui' | 'ai' | 'webdo24' | 'api';

export type ChangeSetItemType =
  | 'content'
  | 'media'
  | 'branding'
  | 'company'
  | 'seo'
  | 'page';

export interface ChangeSet {
  id: string;
  project_id: string;
  customer_id: string;
  title: string;
  status: ChangeSetStatus;
  source: ChangeSetSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChangeSetItem {
  id: string;
  changeset_id: string;
  field_id: string;
  old_value: unknown | null;           // snapshot published_value při vytvoření
  new_value: unknown;                  // draft hodnota
  item_type: ChangeSetItemType;
  created_at: string;
}

/** Item joinutý s definicí pole (pro diff UI). */
export interface ChangeSetItemWithField extends ChangeSetItem {
  field_key: string;
  field_label: string;
  field_type: FieldType;
}

export interface ChangeSetWithItems extends ChangeSet {
  items: ChangeSetItemWithField[];
}

// ============================================
// Publications  (§3.4 – auditní záznam publikace)
// ============================================

export type PublicationStatus = 'published' | 'failed' | 'rolled_back';

export interface PublicationItemSnapshot {
  field_key: string;
  old: unknown | null;
  new: unknown;
}

export interface Publication {
  id: string;
  changeset_id: string;
  project_id: string;
  customer_id: string;
  site_version_id: string | null;
  published_by: string | null;
  items_snapshot: PublicationItemSnapshot[];
  verification: Record<string, unknown> | null;
  status: PublicationStatus;
  is_rollback_of: string | null;
  created_at: string;
}

// ============================================
// Media Library  (§3.5)
// ============================================

export type MediaCategory =
  | 'photo'
  | 'logo'
  | 'gallery'
  | 'product'
  | 'document'
  | 'video';

export type MediaSource = 'upload' | 'ai' | 'stock';

export interface MediaAsset {
  id: string;
  customer_id: string;
  project_id: string;
  category: MediaCategory;
  filename: string;
  mime_type: string;
  storage_path: string;                // {customer_id}/{project_id}/{asset_id}/{filename}
  original_url: string;
  optimized_url: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  alt_text: string | null;
  source: MediaSource;
  parent_asset_id: string | null;      // verzování – původní se nikdy nepřepisuje
  created_by: string | null;
  created_at: string;
}

// ============================================
// Služby a notifikace  (§3.6)
// ============================================

export type CustomerServiceStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'cancelled'
  | 'available';                       // available = upsell nabídka

export interface CustomerService {
  id: string;
  customer_id: string;
  product_id: string;
  status: CustomerServiceStatus;
  price_cents: number | null;
  next_billing_at: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationType =
  | 'published'
  | 'publish_failed'
  | 'request_done'
  | 'new_lead'
  | 'billing'
  | (string & {});                     // otevřené pro budoucí typy

export interface Notification {
  id: string;
  customer_id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

// ============================================
// Memberships a role  (§3.7)
// ============================================

export type MembershipRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface CustomerMembership {
  customer_id: string;
  user_id: string;
  role: MembershipRole;
  invited_by: string | null;
  created_at: string;
}

// ============================================
// Website Contract v1  (§4)
// ============================================

/** Sekce stránky: section_key → seznam field_key v rámci sekce. */
export interface ContractSection {
  section_key: string;                 // 'hero', 'services', 'cta', ...
  field_keys: string[];
}

export interface ContractPage {
  slug: string;                        // 'home', 'o-nas', 'sluzby', 'kontakt'
  title: string;
  seo_title?: string | null;
  seo_description?: string | null;
  sections: ContractSection[];
}

/**
 * Serializovatelný kontrakt webu. Definuje VÝZNAM obsahu, nikoliv design.
 * Globální objekty se nikdy neduplikují do stránek (§4 pravidlo 3).
 */
export interface WebsiteContract {
  webdo24_schema_version: Webdo24SchemaVersion;
  globals: {
    /** company.* field_keys → webdo24_company_profiles */
    company: Record<string, unknown>;
    /** branding.* field_keys → webdo24_brand_profiles */
    branding: Record<string, unknown>;
    /** pages[published] ordered by sort_order */
    navigation: Array<{ slug: string; title: string }>;
    /** pages.seo_title / seo_description + projekt-level defaults */
    seo: {
      title?: string | null;
      description?: string | null;
    };
    /** company.social.* (facebook, instagram, linkedin, youtube) */
    social: Record<string, string | null>;
  };
  pages: Record<string, ContractPage>;
}
