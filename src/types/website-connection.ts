// ============================================
// Website Connection / WebDo24 Connector — typy
// ============================================

export type ConnectionStatus =
  | 'DRAFT'
  | 'AUDITING'
  | 'READY'
  | 'INSTALLING'
  | 'VERIFYING'
  | 'CONNECTED'
  | 'DEGRADED'
  | 'FAILED'
  | 'DISCONNECTED'

export type ConnectionStepKey =
  | 'DISCOVERY'
  | 'AUDIT'
  | 'REGISTER'
  | 'CONTENT_DISCOVERY'
  | 'FORM_DISCOVERY'
  | 'CONNECTOR_INSTALL'
  | 'CONTENT_CONNECT'
  | 'FORM_CONNECT'
  | 'TRACKING_CONNECT'
  | 'VERIFY_CONTENT'
  | 'VERIFY_FORMS'
  | 'HEALTH_CHECK'
  | 'COMPLETE'

export type StepStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED'

export interface WebsiteConnectionRun {
  id: string
  website_id: string
  status: string
  current_step: string | null
  started_at: string
  finished_at: string | null
  result: string | null
  error: string | null
  connector_version: string | null
}

export interface WebsiteConnectionStep {
  id: string
  run_id: string
  step_key: ConnectionStepKey
  status: StepStatus
  started_at: string | null
  finished_at: string | null
  message: string | null
  details: Record<string, unknown>
  error: string | null
}

export interface WebsiteFormRecord {
  id: string
  website_id: string
  form_id: string
  name: string
  source_path: string | null
  fields_schema: FormFieldSchema[]
  is_connected: boolean
  last_submission_at: string | null
}

export type FormFieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'date' | 'number' | 'checkbox'

export interface FormFieldSchema {
  key: string
  label: string
  type: FormFieldType
  required: boolean
}

// Website (rozšířený webdo24_projects)
export interface ConnectedWebsite {
  id: string
  customer_id: string
  title: string
  slug: string | null
  domain: string | null
  site_id: string | null
  status: string
  connection_status: ConnectionStatus
  connection_method: string | null
  framework: string | null
  repository_url: string | null
  repository_branch: string | null
  local_path: string | null
  connector_version: string | null
  content_connected: boolean
  forms_connected: boolean
  tracking_connected: boolean
  last_sync_at: string | null
  last_health_check_at: string | null
  allowed_domains: string[]
  created_at: string
  updated_at: string
}

// Discovery / audit výsledek
export interface DiscoveredForm {
  form_id: string
  name: string
  source_path: string
  fields: FormFieldSchema[]
}

export interface DiscoveredContent {
  field_key: string
  label: string
  field_type: string
  value?: unknown
}

export interface DiscoveryResult {
  framework: string
  package_manager: string | null
  build_script: string | null
  deploy_target: string | null
  content: DiscoveredContent[]
  forms: DiscoveredForm[]
  warnings: string[]
}

export interface HealthResult {
  status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN'
  checks: Array<{ key: string; label: string; ok: boolean; detail?: string }>
  content_version: number | null
  checked_at: string
}
