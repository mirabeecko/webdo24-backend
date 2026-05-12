-- WEBDO24 LEAD MACHINE™ - Upsell Pro Pack
-- Migration: Add has_pro_pack to customers + upsell purchases table

-- ============================================
-- 1. Add has_pro_pack flag to customers
-- ============================================
ALTER TABLE webdo24_customers
ADD COLUMN IF NOT EXISTS has_pro_pack BOOLEAN DEFAULT false;

-- ============================================
-- 2. Track upsell purchases
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_upsell_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES webdo24_customers(id) ON DELETE CASCADE,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  amount INTEGER NOT NULL DEFAULT 90000,
  currency TEXT DEFAULT 'czk',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_upsell_purchases_customer_id ON webdo24_upsell_purchases(customer_id);

-- ============================================
-- 3. RLS
-- ============================================
ALTER TABLE webdo24_upsell_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_upsell_purchases" ON webdo24_upsell_purchases;
DROP POLICY IF EXISTS "customer_own_upsell_purchases" ON webdo24_upsell_purchases;

CREATE POLICY "admin_all_upsell_purchases" ON webdo24_upsell_purchases FOR ALL USING (is_admin());
CREATE POLICY "customer_own_upsell_purchases" ON webdo24_upsell_purchases FOR SELECT USING (
  customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
);
