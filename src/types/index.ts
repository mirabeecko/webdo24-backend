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
