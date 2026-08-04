-- ============================================
-- Google Audit Agent Tables
-- ============================================

CREATE TABLE IF NOT EXISTS webdo24_audit_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  ga4_property_id TEXT,
  gtm_account_id TEXT,
  gtm_container_id TEXT,
  search_console_site_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_audit_projects_domain
  ON webdo24_audit_projects(domain);
CREATE INDEX IF NOT EXISTS idx_webdo24_audit_projects_created_at
  ON webdo24_audit_projects(created_at DESC);

CREATE TABLE IF NOT EXISTS webdo24_audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES webdo24_audit_projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  score NUMERIC,
  summary JSONB,
  raw_result JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_audit_runs_project_id
  ON webdo24_audit_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_audit_runs_status
  ON webdo24_audit_runs(status);
CREATE INDEX IF NOT EXISTS idx_webdo24_audit_runs_created_at
  ON webdo24_audit_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS webdo24_audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES webdo24_audit_runs(id) ON DELETE CASCADE,
  area TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL DEFAULT 'Finding',
  problem TEXT,
  impact TEXT,
  recommendation TEXT,
  severity TEXT NOT NULL DEFAULT 'green'
    CHECK (severity IN ('red', 'yellow', 'green')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_audit_findings_run_id
  ON webdo24_audit_findings(run_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_audit_findings_severity
  ON webdo24_audit_findings(severity);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE webdo24_audit_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_audit_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_audit_projects" ON webdo24_audit_projects;
DROP POLICY IF EXISTS "admin_all_audit_runs" ON webdo24_audit_runs;
DROP POLICY IF EXISTS "admin_all_audit_findings" ON webdo24_audit_findings;

CREATE POLICY "admin_all_audit_projects"
  ON webdo24_audit_projects FOR ALL USING (is_admin());

CREATE POLICY "admin_all_audit_runs"
  ON webdo24_audit_runs FOR ALL USING (is_admin());

CREATE POLICY "admin_all_audit_findings"
  ON webdo24_audit_findings FOR ALL USING (is_admin());
