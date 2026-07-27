-- MIL-138.1: webdo24_hosting_subscriptions table
-- Stores hosting/maintenance subscription data from Stripe

CREATE TABLE IF NOT EXISTS webdo24_hosting_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_email TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  product TEXT NOT NULL CHECK (product IN ('hosting', 'maintenance', 'bundle')),
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  amount INTEGER,
  currency TEXT DEFAULT 'czk',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_hosting_subs_customer ON webdo24_hosting_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_hosting_subs_product ON webdo24_hosting_subscriptions(product);
CREATE INDEX IF NOT EXISTS idx_hosting_subs_status ON webdo24_hosting_subscriptions(status);
