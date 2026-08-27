-- ============================================
-- 016: Website Connection / WebDo24 Connector
--
-- Trvalá produktová schopnost „Připojit web".
-- REUSE: webdo24_projects (Website), webdo24_leads (Lead),
--        webdo24_content_fields (Content Schema),
--        webdo24_site_versions (Content Version),
--        webdo24_audit_log (Audit).
--
-- Zpětně kompatibilní: jen ADD COLUMN (s DEFAULT) + nové tabulky.
-- Žádné mazání ani přejmenování existujících sloupců.
-- Rollback: DROP nových tabulek + DROP COLUMN (viz dole).
-- ============================================

-- ── 1. Website (webdo24_projects) — rozšíření o veřejný identifikátor
--       a stav připojení. site_id = veřejný unikátní id (např. site_7e29ac19),
--       NIKOLI databázové UUID.
ALTER TABLE webdo24_projects ADD COLUMN IF NOT EXISTS site_id TEXT;
ALTER TABLE webdo24_projects ADD COLUMN IF NOT EXISTS connection_status TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE webdo24_projects ADD COLUMN IF NOT EXISTS connection_method TEXT;
ALTER TABLE webdo24_projects ADD COLUMN IF NOT EXISTS framework TEXT;
ALTER TABLE webdo24_projects ADD COLUMN IF NOT EXISTS repository_url TEXT;
ALTER TABLE webdo24_projects ADD COLUMN IF NOT EXISTS repository_branch TEXT;
ALTER TABLE webdo24_projects ADD COLUMN IF NOT EXISTS local_path TEXT;
ALTER TABLE webdo24_projects ADD COLUMN IF NOT EXISTS connector_version TEXT;
ALTER TABLE webdo24_projects ADD COLUMN IF NOT EXISTS content_connected BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE webdo24_projects ADD COLUMN IF NOT EXISTS forms_connected BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE webdo24_projects ADD COLUMN IF NOT EXISTS tracking_connected BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE webdo24_projects ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE webdo24_projects ADD COLUMN IF NOT EXISTS last_health_check_at TIMESTAMPTZ;
ALTER TABLE webdo24_projects ADD COLUMN IF NOT EXISTS allowed_domains JSONB NOT NULL DEFAULT '[]';

CREATE UNIQUE INDEX IF NOT EXISTS idx_webdo24_projects_site_id
  ON webdo24_projects(site_id) WHERE site_id IS NOT NULL;

-- Zpětně doplň site_id existujícím projektům (bez kolize s novými).
UPDATE webdo24_projects
SET site_id = 'site_' || encode(substr(md5(id::text), 1, 4), 'hex')
WHERE site_id IS NULL;

-- ── 2. Website Connection Run (každé spuštění průvodce) ──
CREATE TABLE IF NOT EXISTS webdo24_website_connection_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  current_step TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  result TEXT,
  error TEXT,
  connector_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wcr_website ON webdo24_website_connection_runs(website_id);

-- ── 3. Website Connection Step (kroky runu) ──
CREATE TABLE IF NOT EXISTS webdo24_website_connection_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES webdo24_website_connection_runs(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  message TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_wcs_run ON webdo24_website_connection_steps(run_id);

-- ── 4. Website Form Registry (formuláře nalezené na webu) ──
CREATE TABLE IF NOT EXISTS webdo24_website_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_path TEXT,
  fields_schema JSONB NOT NULL DEFAULT '[]',
  is_connected BOOLEAN NOT NULL DEFAULT false,
  last_submission_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(website_id, form_id)
);
CREATE INDEX IF NOT EXISTS idx_wwf_website ON webdo24_website_forms(website_id);

-- ── 5. Lead (webdo24_leads) — rozšíření o kontext webu, formuláře a idempotenci ──
ALTER TABLE webdo24_leads ADD COLUMN IF NOT EXISTS site_id TEXT;
ALTER TABLE webdo24_leads ADD COLUMN IF NOT EXISTS form_id TEXT;
ALTER TABLE webdo24_leads ADD COLUMN IF NOT EXISTS submission_id TEXT;
ALTER TABLE webdo24_leads ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE webdo24_leads ADD COLUMN IF NOT EXISTS page_url TEXT;
ALTER TABLE webdo24_leads ADD COLUMN IF NOT EXISTS landing_page TEXT;
ALTER TABLE webdo24_leads ADD COLUMN IF NOT EXISTS referrer TEXT;
ALTER TABLE webdo24_leads ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE webdo24_leads ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE webdo24_leads ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE webdo24_leads ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE webdo24_leads ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE webdo24_leads ADD COLUMN IF NOT EXISTS gclid TEXT;
ALTER TABLE webdo24_leads ADD COLUMN IF NOT EXISTS fbclid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_webdo24_leads_submission
  ON webdo24_leads(submission_id) WHERE submission_id IS NOT NULL;

-- ── RLS (stejný vzor jako zbytek projektu: admin_all / customer_own) ──
ALTER TABLE webdo24_website_connection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_website_connection_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_website_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_website_connection_runs" ON webdo24_website_connection_runs;
CREATE POLICY "admin_all_website_connection_runs" ON webdo24_website_connection_runs FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "admin_all_website_connection_steps" ON webdo24_website_connection_steps;
CREATE POLICY "admin_all_website_connection_steps" ON webdo24_website_connection_steps FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "admin_all_website_forms" ON webdo24_website_forms;
CREATE POLICY "admin_all_website_forms" ON webdo24_website_forms FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "customer_own_website_forms" ON webdo24_website_forms;
CREATE POLICY "customer_own_website_forms" ON webdo24_website_forms FOR ALL USING (
  website_id IN (SELECT id FROM webdo24_projects WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid()))
);

-- ============================================
-- ROLLBACK (při potřebě vrátit migraci):
--
-- DROP TABLE webdo24_website_connection_steps;
-- DROP TABLE webdo24_website_connection_runs;
-- DROP TABLE webdo24_website_forms;
-- ALTER TABLE webdo24_leads DROP COLUMN site_id, form_id, submission_id, is_test, page_url, landing_page, referrer, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid;
-- ALTER TABLE webdo24_projects DROP COLUMN site_id, connection_status, connection_method, framework, repository_url, repository_branch, local_path, connector_version, content_connected, forms_connected, tracking_connected, last_sync_at, last_health_check_at, allowed_domains;
-- ============================================
