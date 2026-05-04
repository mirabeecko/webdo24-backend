-- Webdo24 Initial Schema
-- All tables must have prefix webdo24_

-- Customers table
CREATE TABLE IF NOT EXISTS webdo24_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  ico TEXT,
  dic TEXT,
  address TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Projects table
CREATE TABLE IF NOT EXISTS webdo24_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES webdo24_customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  business_type TEXT,
  target_audience TEXT,
  location TEXT,
  language TEXT DEFAULT 'cs',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'waiting_for_materials', 'ready_for_generation',
    'generating', 'generated', 'qa_check', 'needs_revision', 'approved',
    'deployed', 'archived'
  )),
  pipeline_type TEXT DEFAULT 'standard',
  price_type TEXT DEFAULT 'one_time' CHECK (price_type IN ('one_time', 'monthly')),
  domain TEXT,
  hosting_status TEXT DEFAULT 'pending',
  email_status TEXT DEFAULT 'pending',
  preview_url TEXT,
  production_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Project briefs table
CREATE TABLE IF NOT EXISTS webdo24_project_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  raw_input TEXT,
  business_description TEXT,
  services TEXT,
  prices TEXT,
  contacts TEXT,
  tone TEXT,
  colors TEXT,
  competitors TEXT,
  seo_keywords TEXT,
  required_sections TEXT,
  special_requirements TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Project files table
CREATE TABLE IF NOT EXISTS webdo24_project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pipeline runs table
CREATE TABLE IF NOT EXISTS webdo24_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  pipeline_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  input_json JSONB,
  output_json JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ
);

-- Project events table
CREATE TABLE IF NOT EXISTS webdo24_project_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS webdo24_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES webdo24_customers(id) ON DELETE CASCADE,
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'CZK',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_type TEXT DEFAULT 'one_time' CHECK (payment_type IN ('one_time', 'monthly')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers
CREATE TRIGGER update_webdo24_projects_updated_at
  BEFORE UPDATE ON webdo24_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webdo24_project_briefs_updated_at
  BEFORE UPDATE ON webdo24_project_briefs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_webdo24_projects_customer_id ON webdo24_projects(customer_id);
CREATE INDEX idx_webdo24_projects_status ON webdo24_projects(status);
CREATE INDEX idx_webdo24_project_briefs_project_id ON webdo24_project_briefs(project_id);
CREATE INDEX idx_webdo24_project_files_project_id ON webdo24_project_files(project_id);
CREATE INDEX idx_webdo24_pipeline_runs_project_id ON webdo24_pipeline_runs(project_id);
CREATE INDEX idx_webdo24_project_events_project_id ON webdo24_project_events(project_id);
CREATE INDEX idx_webdo24_invoices_customer_id ON webdo24_invoices(customer_id);

-- RLS Policies
ALTER TABLE webdo24_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_project_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_project_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_invoices ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- webdo24_customers policies
CREATE POLICY "admin_all_customers" ON webdo24_customers
  FOR ALL USING (is_admin());
CREATE POLICY "customer_own_profile" ON webdo24_customers
  FOR SELECT USING (user_id = auth.uid());

-- webdo24_projects policies
CREATE POLICY "admin_all_projects" ON webdo24_projects
  FOR ALL USING (is_admin());
CREATE POLICY "customer_own_projects" ON webdo24_projects
  FOR SELECT USING (
    customer_id IN (
      SELECT id FROM webdo24_customers WHERE user_id = auth.uid()
    )
  );

-- webdo24_project_briefs policies
CREATE POLICY "admin_all_briefs" ON webdo24_project_briefs
  FOR ALL USING (is_admin());
CREATE POLICY "customer_own_briefs" ON webdo24_project_briefs
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM webdo24_projects
      WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
    )
  );

-- webdo24_project_files policies
CREATE POLICY "admin_all_files" ON webdo24_project_files
  FOR ALL USING (is_admin());
CREATE POLICY "customer_own_files" ON webdo24_project_files
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM webdo24_projects
      WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
    )
  );

-- webdo24_pipeline_runs policies
CREATE POLICY "admin_all_pipeline_runs" ON webdo24_pipeline_runs
  FOR ALL USING (is_admin());
CREATE POLICY "customer_own_pipeline_runs" ON webdo24_pipeline_runs
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM webdo24_projects
      WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
    )
  );

-- webdo24_project_events policies
CREATE POLICY "admin_all_events" ON webdo24_project_events
  FOR ALL USING (is_admin());
CREATE POLICY "customer_own_events" ON webdo24_project_events
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM webdo24_projects
      WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
    )
  );

-- webdo24_invoices policies
CREATE POLICY "admin_all_invoices" ON webdo24_invoices
  FOR ALL USING (is_admin());
CREATE POLICY "customer_own_invoices" ON webdo24_invoices
  FOR SELECT USING (
    customer_id IN (
      SELECT id FROM webdo24_customers WHERE user_id = auth.uid()
    )
  );
