-- WEBDO24 LEAD MACHINE™ - Email Routing (Cloudflare)
-- Spusť v Supabase SQL Editoru

-- ============================================
-- Tabulka žádostí o email routing
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_email_routing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES webdo24_customers(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  zone_id TEXT,
  email_prefix TEXT NOT NULL,
  custom_email TEXT NOT NULL,
  destination_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'waiting_verification', 'active', 'error')),
  n8n_response JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_email_routing_customer_id ON webdo24_email_routing_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_email_routing_status ON webdo24_email_routing_requests(status);

-- Trigger pro updated_at
CREATE TRIGGER IF NOT EXISTS update_webdo24_email_routing_updated_at
  BEFORE UPDATE ON webdo24_email_routing_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE webdo24_email_routing_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_email_routing" ON webdo24_email_routing_requests;
DROP POLICY IF EXISTS "customer_own_email_routing" ON webdo24_email_routing_requests;
CREATE POLICY "admin_all_email_routing" ON webdo24_email_routing_requests FOR ALL USING (is_admin());
CREATE POLICY "customer_own_email_routing" ON webdo24_email_routing_requests FOR ALL USING (
  customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
);
