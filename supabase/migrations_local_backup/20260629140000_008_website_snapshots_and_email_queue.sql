-- WEBDO24 - Website snapshots + Email queue
-- Migration: 008
-- Date: 2026-06-29
--
-- Fixes missing table referenced by src/lib/actions/web-admin.ts
-- and adds an email queue for transactional/notification emails.

-- ============================================
-- 1. WEBSITE SNAPSHOTS (manual backups before publish)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_website_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  snapshot_json JSONB NOT NULL DEFAULT '{}',
  is_auto BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_website_snapshots_project_id
  ON webdo24_website_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_website_snapshots_created_at
  ON webdo24_website_snapshots(created_at DESC);

ALTER TABLE webdo24_website_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_website_snapshots" ON webdo24_website_snapshots;
DROP POLICY IF EXISTS "customer_own_website_snapshots" ON webdo24_website_snapshots;

CREATE POLICY "admin_all_website_snapshots"
  ON webdo24_website_snapshots FOR ALL USING (is_admin());

CREATE POLICY "customer_own_website_snapshots"
  ON webdo24_website_snapshots FOR ALL USING (
    project_id IN (
      SELECT id FROM webdo24_projects
      WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- 2. EMAIL QUEUE (transactional / notification emails)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- recipient
  customer_id UUID REFERENCES webdo24_customers(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  to_name TEXT,

  -- email content
  template_key TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT,
  text_body TEXT,

  -- context for tracking / debugging
  metadata JSONB DEFAULT '{}',

  -- sending lifecycle
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  provider_response JSONB,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  scheduled_for TIMESTAMPTZ DEFAULT now(),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_email_queue_status_scheduled
  ON webdo24_email_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_webdo24_email_queue_customer
  ON webdo24_email_queue(customer_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS update_webdo24_email_queue_updated_at
  BEFORE UPDATE ON webdo24_email_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE webdo24_email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_email_queue" ON webdo24_email_queue;
DROP POLICY IF EXISTS "customer_read_own_email_queue" ON webdo24_email_queue;

CREATE POLICY "admin_all_email_queue"
  ON webdo24_email_queue FOR ALL USING (is_admin());

CREATE POLICY "customer_read_own_email_queue"
  ON webdo24_email_queue FOR SELECT USING (
    customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
  );

-- ============================================
-- 3. CUSTOMER EMAIL PREFERENCES
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_customer_email_prefs (
  customer_id UUID PRIMARY KEY REFERENCES webdo24_customers(id) ON DELETE CASCADE,
  marketing_enabled BOOLEAN DEFAULT true,
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE webdo24_customer_email_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_customer_email_prefs" ON webdo24_customer_email_prefs;
DROP POLICY IF EXISTS "customer_own_email_prefs" ON webdo24_customer_email_prefs;

CREATE POLICY "admin_all_customer_email_prefs"
  ON webdo24_customer_email_prefs FOR ALL USING (is_admin());

CREATE POLICY "customer_own_email_prefs"
  ON webdo24_customer_email_prefs FOR ALL USING (
    customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
  );
