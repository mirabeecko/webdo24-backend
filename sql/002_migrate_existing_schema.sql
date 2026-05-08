-- Migrace existujícího webdo24.cz schématu pro webdo24-backend
-- Spusť v Supabase SQL Editoru: https://supabase.com/dashboard/project/mljqltwcdqknezuqpisb/sql/new

-- ============================================
-- 1. Přidat sloupce do webdo24_customers
-- ============================================
ALTER TABLE webdo24_customers 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ico TEXT,
  ADD COLUMN IF NOT EXISTS dic TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT;

-- ============================================
-- 2. Přidat sloupce do webdo24_projects
-- ============================================
ALTER TABLE webdo24_projects
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES webdo24_customers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS target_audience TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'cs',
  ADD COLUMN IF NOT EXISTS pipeline_type TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'one_time' CHECK (price_type IN ('one_time', 'monthly')),
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS hosting_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS preview_url TEXT,
  ADD COLUMN IF NOT EXISTS production_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Upravit status CHECK constraint (pokud neexistuje)
ALTER TABLE webdo24_projects DROP CONSTRAINT IF EXISTS webdo24_projects_status_check;
ALTER TABLE webdo24_projects ADD CONSTRAINT webdo24_projects_status_check 
  CHECK (status IN ('draft', 'submitted', 'waiting_for_materials', 'ready_for_generation',
    'generating', 'generated', 'qa_check', 'needs_revision', 'approved',
    'deployed', 'archived'));

-- ============================================
-- 3. Vytvořit chybějící tabulky
-- ============================================

-- Project briefs
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

-- Project files
CREATE TABLE IF NOT EXISTS webdo24_project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pipeline runs
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

-- Project events
CREATE TABLE IF NOT EXISTS webdo24_project_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Invoices
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

-- ============================================
-- 4. Triggery a indexy
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_webdo24_projects_updated_at
  BEFORE UPDATE ON webdo24_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_webdo24_project_briefs_updated_at
  BEFORE UPDATE ON webdo24_project_briefs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_webdo24_projects_customer_id ON webdo24_projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_projects_status ON webdo24_projects(status);
CREATE INDEX IF NOT EXISTS idx_webdo24_project_briefs_project_id ON webdo24_project_briefs(project_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_project_files_project_id ON webdo24_project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_pipeline_runs_project_id ON webdo24_pipeline_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_project_events_project_id ON webdo24_project_events(project_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_invoices_customer_id ON webdo24_invoices(customer_id);

-- ============================================
-- 5. RLS Policies
-- ============================================
ALTER TABLE webdo24_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_project_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_project_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_invoices ENABLE ROW LEVEL SECURITY;

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

-- Customers policies
DROP POLICY IF EXISTS "admin_all_customers" ON webdo24_customers;
DROP POLICY IF EXISTS "customer_own_profile" ON webdo24_customers;
CREATE POLICY "admin_all_customers" ON webdo24_customers FOR ALL USING (is_admin());
CREATE POLICY "customer_own_profile" ON webdo24_customers FOR SELECT USING (user_id = auth.uid());

-- Projects policies
DROP POLICY IF EXISTS "admin_all_projects" ON webdo24_projects;
DROP POLICY IF EXISTS "customer_own_projects" ON webdo24_projects;
CREATE POLICY "admin_all_projects" ON webdo24_projects FOR ALL USING (is_admin());
CREATE POLICY "customer_own_projects" ON webdo24_projects FOR SELECT USING (
  customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
);

-- Briefs policies
DROP POLICY IF EXISTS "admin_all_briefs" ON webdo24_project_briefs;
DROP POLICY IF EXISTS "customer_own_briefs" ON webdo24_project_briefs;
CREATE POLICY "admin_all_briefs" ON webdo24_project_briefs FOR ALL USING (is_admin());
CREATE POLICY "customer_own_briefs" ON webdo24_project_briefs FOR SELECT USING (
  project_id IN (
    SELECT id FROM webdo24_projects
    WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
  )
);

-- Files policies
DROP POLICY IF EXISTS "admin_all_files" ON webdo24_project_files;
DROP POLICY IF EXISTS "customer_own_files" ON webdo24_project_files;
CREATE POLICY "admin_all_files" ON webdo24_project_files FOR ALL USING (is_admin());
CREATE POLICY "customer_own_files" ON webdo24_project_files FOR SELECT USING (
  project_id IN (
    SELECT id FROM webdo24_projects
    WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
  )
);

-- Pipeline runs policies
DROP POLICY IF EXISTS "admin_all_pipeline_runs" ON webdo24_pipeline_runs;
DROP POLICY IF EXISTS "customer_own_pipeline_runs" ON webdo24_pipeline_runs;
CREATE POLICY "admin_all_pipeline_runs" ON webdo24_pipeline_runs FOR ALL USING (is_admin());
CREATE POLICY "customer_own_pipeline_runs" ON webdo24_pipeline_runs FOR SELECT USING (
  project_id IN (
    SELECT id FROM webdo24_projects
    WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
  )
);

-- Events policies
DROP POLICY IF EXISTS "admin_all_events" ON webdo24_project_events;
DROP POLICY IF EXISTS "customer_own_events" ON webdo24_project_events;
CREATE POLICY "admin_all_events" ON webdo24_project_events FOR ALL USING (is_admin());
CREATE POLICY "customer_own_events" ON webdo24_project_events FOR SELECT USING (
  project_id IN (
    SELECT id FROM webdo24_projects
    WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
  )
);

-- Invoices policies
DROP POLICY IF EXISTS "admin_all_invoices" ON webdo24_invoices;
DROP POLICY IF EXISTS "customer_own_invoices" ON webdo24_invoices;
CREATE POLICY "admin_all_invoices" ON webdo24_invoices FOR ALL USING (is_admin());
CREATE POLICY "customer_own_invoices" ON webdo24_invoices FOR SELECT USING (
  customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
);

-- ============================================
-- 6. Storage bucket pro soubory
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('webdo24-files', 'webdo24-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY IF NOT EXISTS "webdo24-files-public-read"
ON storage.objects FOR SELECT
USING (bucket_id = 'webdo24-files');

CREATE POLICY IF NOT EXISTS "webdo24-files-auth-upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'webdo24-files' AND auth.role() = 'authenticated');
