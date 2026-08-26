-- ============================================
-- 015: Email (SMTP), formuláře a nabídky
-- Pro zákaznický prodejní modul:
--   1. webdo24_email_settings — SMTP nastavení zákazníka (odesílání vlastním mailem)
--   2. webdo24_forms          — formuláře postavené v backendu (builder)
--   3. webdo24_quotes         — nabídky s položkami (generátor, okamžitý součet)
-- ============================================

-- ── 1. Email (SMTP) settings ──
CREATE TABLE IF NOT EXISTS webdo24_email_settings (
  customer_id UUID PRIMARY KEY REFERENCES webdo24_customers(id) ON DELETE CASCADE,
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  smtp_secure TEXT NOT NULL DEFAULT 'tls' CHECK (smtp_secure IN ('tls','ssl','none')),
  smtp_user TEXT,
  smtp_pass TEXT,
  from_name TEXT,
  from_email TEXT,
  signature_html TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE webdo24_email_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_email_settings" ON webdo24_email_settings;
DROP POLICY IF EXISTS "customer_own_email_settings" ON webdo24_email_settings;
CREATE POLICY "admin_all_email_settings" ON webdo24_email_settings FOR ALL USING (is_admin());
CREATE POLICY "customer_own_email_settings" ON webdo24_email_settings FOR ALL USING (
  customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
);

-- ── 2. Formuláře (builder) ──
CREATE TABLE IF NOT EXISTS webdo24_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES webdo24_customers(id) ON DELETE CASCADE,
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]',
  submit_button TEXT DEFAULT 'Odeslat',
  success_message TEXT DEFAULT 'Děkujeme, formulář byl odeslán.',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webdo24_forms_customer ON webdo24_forms(customer_id);

ALTER TABLE webdo24_forms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_forms" ON webdo24_forms;
DROP POLICY IF EXISTS "customer_own_forms" ON webdo24_forms;
CREATE POLICY "admin_all_forms" ON webdo24_forms FOR ALL USING (is_admin());
CREATE POLICY "customer_own_forms" ON webdo24_forms FOR ALL USING (
  customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
);

-- ── 3. Nabídky (generátor) ──
CREATE TABLE IF NOT EXISTS webdo24_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES webdo24_customers(id) ON DELETE CASCADE,
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  number TEXT,
  title TEXT NOT NULL DEFAULT 'Nabídka',
  client_name TEXT,
  client_email TEXT,
  valid_until TEXT,
  note TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  vat_rate INTEGER NOT NULL DEFAULT 21,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webdo24_quotes_customer ON webdo24_quotes(customer_id);

ALTER TABLE webdo24_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_quotes" ON webdo24_quotes;
DROP POLICY IF EXISTS "customer_own_quotes" ON webdo24_quotes;
CREATE POLICY "admin_all_quotes" ON webdo24_quotes FOR ALL USING (is_admin());
CREATE POLICY "customer_own_quotes" ON webdo24_quotes FOR ALL USING (
  customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
);
