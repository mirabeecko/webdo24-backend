export type UserRole = 'admin' | 'customer';

export type ProjectStatus =
  | 'draft'
  | 'submitted'
  | 'waiting_for_materials'
  | 'ready_for_generation'
  | 'generating'
  | 'generated'
  | 'qa_check'
  | 'needs_revision'
  | 'approved'
  | 'deployed'
  | 'archived';

export type PipelineRunStatus = 'pending' | 'running' | 'success' | 'failed';

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export type PriceType = 'one_time' | 'monthly';

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  ico?: string;
  dic?: string;
  address?: string;
  note?: string;
  created_at: string;
}

export interface Project {
  id: string;
  customer_id: string;
  title: string;
  slug?: string;
  business_type?: string;
  target_audience?: string;
  location?: string;
  language?: string;
  status: ProjectStatus;
  pipeline_type?: string;
  price_type?: PriceType;
  domain?: string;
  hosting_status?: string;
  email_status?: string;
  preview_url?: string;
  production_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectBrief {
  id: string;
  project_id: string;
  raw_input?: string;
  business_description?: string;
  services?: string;
  prices?: string;
  contacts?: string;
  tone?: string;
  colors?: string;
  competitors?: string;
  seo_keywords?: string;
  required_sections?: string;
  special_requirements?: string;
  /** Volitelné: URL webu, který se zákazníkovi líbí (inspirace pro art direction). */
  inspiration_url?: string;
  /** Volitelné: popis konkrétních prvků, které se zákazníkovi líbí (barvy, typografie, sekce, ...). */
  inspiration_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  uploaded_by?: string;
  created_at: string;
}

export interface PipelineRun {
  id: string;
  project_id: string;
  pipeline_type: string;
  status: PipelineRunStatus;
  input_json?: Record<string, unknown>;
  output_json?: Record<string, unknown>;
  error_message?: string;
  started_at: string;
  finished_at?: string;
}

export interface ProjectEvent {
  id: string;
  project_id: string;
  user_id?: string;
  event_type: string;
  message?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  customer_id: string;
  project_id?: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  payment_type: PriceType;
  due_date?: string;
  paid_at?: string;
  created_at: string;
}

export interface ProjectWithCustomer extends Project {
  customer?: Customer;
}

// ============================================
// Site Versioning  (sql/006)
// ============================================

export type SiteVersionStatus = 'draft' | 'preview' | 'live' | 'archived' | 'failed';
export type SiteVersionAuthor = 'ai' | 'admin' | 'customer' | 'system';

// Strukturovaný snapshot, který renderer použije k buildu webu.
// Verze 1: zatím flexibilní JSON – až se workflow ustálí, zúžíme typy.
export interface SiteSnapshot {
  schema_version: number;             // 1
  theme: {
    primary_color?: string;
    accent_color?: string;
    font_heading?: string;
    font_body?: string;
  };
  meta: {
    title?: string;
    description?: string;
    og_image_url?: string;
    language?: string;
  };
  sections: Array<{
    key: string;                       // hero, services, about, ...
    type: string;                      // hero_centered, services_grid, ...
    visible: boolean;
    fields: Record<string, unknown>;
  }>;
  contact: {
    phone?: string;
    email?: string;
    address?: string;
    hours?: string;
  };
}

export interface SiteVersion {
  id: string;
  project_id: string;
  parent_version_id: string | null;
  snapshot: SiteSnapshot;
  status: SiteVersionStatus;
  build_artifact_url: string | null;
  preview_url: string | null;
  created_by_type: SiteVersionAuthor;
  created_by_user_id: string | null;
  note: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
}

// ============================================
// Change Requests  (sql/006)
// ============================================

export type ChangeCategory =
  | 'trivial' | 'content' | 'media' | 'structure'
  | 'design'  | 'page'    | 'heavy' | 'unknown';

export type ChangeStatus =
  | 'new' | 'classifying' | 'planning' | 'executing'
  | 'preview_ready' | 'approved' | 'publishing'
  | 'published' | 'rejected' | 'failed' | 'escalated';

export type ChangeActionType =
  | 'update_text' | 'update_color' | 'update_image'
  | 'add_section' | 'remove_section' | 'reorder_section'
  | 'add_service' | 'update_service' | 'remove_service'
  | 'add_testimonial' | 'update_contact' | 'update_seo'
  | 'update_theme' | 'custom';

export interface ChangeRequest {
  id: string;
  project_id: string;
  user_id: string | null;
  raw_input: string;
  category: ChangeCategory | null;
  confidence: number | null;
  status: ChangeStatus;
  ai_cost_cents: number;
  iteration_count: number;
  is_billable: boolean;
  draft_version_id: string | null;
  published_version_id: string | null;
  error_message: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ChangeAction {
  id: string;
  change_request_id: string;
  type: ChangeActionType;
  target_path: string | null;
  payload: Record<string, unknown>;
  applied_at: string | null;
  error_message: string | null;
  created_at: string;
}

// ============================================
// Products & Upsell  (sql/006)
// ============================================

export type ProductBillingType = 'one_time' | 'monthly' | 'yearly';
export type UpsellEventType = 'impression' | 'click' | 'dismiss' | 'convert';

export interface Product {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  long_description: string | null;
  price_cents: number;
  currency: string;
  billing_type: ProductBillingType;
  category: string | null;
  icon_key: string | null;
  benefits: string[];
  stripe_price_id: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UpsellEvent {
  id: number;
  customer_id: string | null;
  product_id: string | null;
  event_type: UpsellEventType;
  context: string | null;
  trigger_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================
// Audit Log  (sql/006)
// ============================================

export interface AuditLog {
  id: number;
  user_id: string | null;
  customer_id: string | null;
  project_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  diff: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============================================
// Google Audit Agent
// ============================================

export type AuditRunStatus = 'running' | 'completed' | 'failed';
export type AuditFindingSeverity = 'red' | 'yellow' | 'green';

export interface AuditProject {
  id: string;
  domain: string;
  client_name: string;
  ga4_property_id: string | null;
  gtm_account_id: string | null;
  gtm_container_id: string | null;
  search_console_site_url: string | null;
  created_at: string;
}

export interface AuditRun {
  id: string;
  project_id: string;
  status: AuditRunStatus;
  score: number | null;
  summary: Record<string, unknown> | null;
  raw_result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AuditFinding {
  id: string;
  run_id: string;
  area: string;
  title: string;
  problem: string | null;
  impact: string | null;
  recommendation: string | null;
  severity: AuditFindingSeverity;
  created_at: string;
}

export interface GoogleAuditStartPayload {
  domain: string;
  client_name?: string;
  ga4_property_id?: string;
  gtm_account_id?: string;
  gtm_container_id?: string;
  search_console_site_url?: string;
}

export interface GoogleAuditStartResponse {
  success: boolean;
  run_id: string;
}

export interface GoogleAuditDetailResponse {
  project: AuditProject | null;
  run: AuditRun | null;
  findings: AuditFinding[];
}
