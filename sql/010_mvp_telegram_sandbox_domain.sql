-- Webdo24 MVP: Telegram, Sandbox, Custom Domain
-- Migration 010

-- 1) Telegram settings for customers
ALTER TABLE webdo24_customers
  ADD COLUMN IF NOT EXISTS telegram_phone TEXT,
  ADD COLUMN IF NOT EXISTS telegram_connected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- 2) Sandbox activation per project
ALTER TABLE webdo24_projects
  ADD COLUMN IF NOT EXISTS sandbox_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sandbox_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_domain_verification_token TEXT;

-- 3) Update suggestions table (periodic AI proposals)
CREATE TABLE IF NOT EXISTS webdo24_update_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES webdo24_customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'improvement',
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed', 'applied')),
  ai_cost_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ
);

CREATE INDEX idx_webdo24_update_suggestions_project ON webdo24_update_suggestions(project_id);
CREATE INDEX idx_webdo24_update_suggestions_status ON webdo24_update_suggestions(status);

ALTER TABLE webdo24_update_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_suggestions" ON webdo24_update_suggestions
  FOR ALL USING (is_admin());

CREATE POLICY "customer_own_suggestions" ON webdo24_update_suggestions
  FOR SELECT USING (
    customer_id IN (
      SELECT id FROM webdo24_customers WHERE user_id = auth.uid()
    )
  );
