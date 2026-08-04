-- WEBDO24 - Versioning, Change Requests, Upsell Engine, Audit Log
-- Migration: 006
-- Date: 2026-05-14
--
-- Adds the core "AI-edit + approve + publish + rollback" backbone:
--   * site_versions  – snapshot obsahu webu (draft/preview/live/archived)
--   * change_requests / change_actions – "Řekněte co chcete změnit"
--   * products / upsell_events – katalog služeb + tracking
--   * audit_log – kdo/co/kdy

-- ============================================
-- 1. SITE VERSIONS  (verzování + rollback)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_site_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  parent_version_id UUID REFERENCES webdo24_site_versions(id) ON DELETE SET NULL,

  -- celý web jako JSON snapshot:
  -- { sections: [...], theme: {...}, meta: {...}, content: {...} }
  snapshot JSONB NOT NULL DEFAULT '{}',

  -- kde se ve workflow nachází
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'preview', 'live', 'archived', 'failed')),

  -- urls
  build_artifact_url TEXT,
  preview_url TEXT,

  -- attribution
  created_by_type TEXT NOT NULL DEFAULT 'ai'
    CHECK (created_by_type IN ('ai', 'admin', 'customer', 'system')),
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- audit
  note TEXT,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_site_versions_project_status
  ON webdo24_site_versions(project_id, status);
CREATE INDEX IF NOT EXISTS idx_webdo24_site_versions_created_at
  ON webdo24_site_versions(created_at DESC);

-- jeden projekt = max 1 live verze v daný moment
CREATE UNIQUE INDEX IF NOT EXISTS idx_webdo24_site_versions_one_live
  ON webdo24_site_versions(project_id) WHERE status = 'live';

-- pointer z projektu na aktuální live verzi (pro rychlý lookup)
ALTER TABLE webdo24_projects
  ADD COLUMN IF NOT EXISTS current_version_id UUID
    REFERENCES webdo24_site_versions(id) ON DELETE SET NULL;

-- ============================================
-- 2. CHANGE REQUESTS  ("Řekněte co chcete změnit")
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- co napsal klient ("změň cenu na 219 Kč")
  raw_input TEXT NOT NULL,

  -- AI klasifikace
  category TEXT
    CHECK (category IN ('trivial', 'content', 'media', 'structure', 'design', 'page', 'heavy', 'unknown')),
  confidence NUMERIC(4,3),  -- 0.000–1.000

  -- workflow stav
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'classifying', 'planning', 'executing',
                      'preview_ready', 'approved', 'publishing',
                      'published', 'rejected', 'failed', 'escalated')),

  -- ekonomika
  ai_cost_cents INTEGER DEFAULT 0,
  iteration_count INTEGER DEFAULT 0,
  is_billable BOOLEAN DEFAULT false,

  -- propojení s verzí
  draft_version_id UUID REFERENCES webdo24_site_versions(id) ON DELETE SET NULL,
  published_version_id UUID REFERENCES webdo24_site_versions(id) ON DELETE SET NULL,

  -- timing
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_webdo24_change_requests_project_status
  ON webdo24_change_requests(project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webdo24_change_requests_user
  ON webdo24_change_requests(user_id, created_at DESC);

-- ============================================
-- 3. CHANGE ACTIONS  (atomické akce vygenerované plannerem)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_change_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_request_id UUID NOT NULL REFERENCES webdo24_change_requests(id) ON DELETE CASCADE,

  type TEXT NOT NULL
    CHECK (type IN ('update_text', 'update_color', 'update_image',
                    'add_section', 'remove_section', 'reorder_section',
                    'add_service', 'update_service', 'remove_service',
                    'add_testimonial', 'update_contact', 'update_seo',
                    'update_theme', 'custom')),

  -- konkrétní cesta v JSON snapshotu (např. "sections[2].fields.title")
  target_path TEXT,
  -- payload: { from: "189 Kč", to: "219 Kč" } nebo libovolný JSON
  payload JSONB NOT NULL DEFAULT '{}',

  applied_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_change_actions_request
  ON webdo24_change_actions(change_request_id);

-- ============================================
-- 4. PRODUCTS  (katalog upsell služeb)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_description TEXT,
  long_description TEXT,

  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CZK',
  billing_type TEXT NOT NULL DEFAULT 'one_time'
    CHECK (billing_type IN ('one_time', 'monthly', 'yearly')),

  category TEXT,             -- seo, content, design, integration, ...
  icon_key TEXT,             -- ikona v UI (lucide name)
  benefits JSONB DEFAULT '[]',
  stripe_price_id TEXT,

  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_products_active
  ON webdo24_products(active, sort_order);

CREATE TRIGGER update_webdo24_products_updated_at
  BEFORE UPDATE ON webdo24_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. UPSELL EVENTS  (impression/click/convert tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_upsell_events (
  id BIGSERIAL PRIMARY KEY,
  customer_id UUID REFERENCES webdo24_customers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES webdo24_products(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL
    CHECK (event_type IN ('impression', 'click', 'dismiss', 'convert')),

  -- kde se nabídka zobrazila
  context TEXT,                -- dashboard, sluzby, email, in_context_media, ...
  trigger_reason TEXT,         -- low_traffic, no_photos, season_spring, ...
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_upsell_events_customer
  ON webdo24_upsell_events(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webdo24_upsell_events_product_type
  ON webdo24_upsell_events(product_id, event_type);

-- ============================================
-- 6. AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES webdo24_customers(id) ON DELETE SET NULL,
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE SET NULL,

  action TEXT NOT NULL,        -- 'site.publish', 'site.rollback', 'change.create', ...
  entity TEXT,                 -- 'site_version', 'change_request', ...
  entity_id UUID,
  diff JSONB,                  -- před/po (volitelné, jen u důležitých akcí)
  ip INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_audit_log_customer_created
  ON webdo24_audit_log(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webdo24_audit_log_project_created
  ON webdo24_audit_log(project_id, created_at DESC);

-- ============================================
-- 7. RLS POLICIES
-- ============================================

-- helper – customer owns project?
CREATE OR REPLACE FUNCTION owns_project(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM webdo24_projects p
    JOIN webdo24_customers c ON c.id = p.customer_id
    WHERE p.id = p_project_id
      AND c.user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── site_versions ──
ALTER TABLE webdo24_site_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_site_versions" ON webdo24_site_versions;
DROP POLICY IF EXISTS "customer_read_site_versions" ON webdo24_site_versions;

CREATE POLICY "admin_all_site_versions"
  ON webdo24_site_versions FOR ALL USING (is_admin());

-- zákazník vidí jen svoje verze, NESMÍ je sám INSERTovat / UPDATovat
-- (mutace jdou přes server actions s service-role klientem)
CREATE POLICY "customer_read_site_versions"
  ON webdo24_site_versions FOR SELECT
  USING (owns_project(project_id));

-- ── change_requests ──
ALTER TABLE webdo24_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_change_requests" ON webdo24_change_requests;
DROP POLICY IF EXISTS "customer_own_change_requests_read" ON webdo24_change_requests;
DROP POLICY IF EXISTS "customer_own_change_requests_insert" ON webdo24_change_requests;

CREATE POLICY "admin_all_change_requests"
  ON webdo24_change_requests FOR ALL USING (is_admin());

CREATE POLICY "customer_own_change_requests_read"
  ON webdo24_change_requests FOR SELECT
  USING (owns_project(project_id));

CREATE POLICY "customer_own_change_requests_insert"
  ON webdo24_change_requests FOR INSERT
  WITH CHECK (owns_project(project_id) AND user_id = auth.uid());

-- ── change_actions ──
ALTER TABLE webdo24_change_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_change_actions" ON webdo24_change_actions;
DROP POLICY IF EXISTS "customer_read_change_actions" ON webdo24_change_actions;

CREATE POLICY "admin_all_change_actions"
  ON webdo24_change_actions FOR ALL USING (is_admin());

CREATE POLICY "customer_read_change_actions"
  ON webdo24_change_actions FOR SELECT
  USING (
    change_request_id IN (
      SELECT id FROM webdo24_change_requests
      WHERE owns_project(project_id)
    )
  );

-- ── products ──
ALTER TABLE webdo24_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_products" ON webdo24_products;
DROP POLICY IF EXISTS "anyone_read_active_products" ON webdo24_products;

CREATE POLICY "admin_all_products"
  ON webdo24_products FOR ALL USING (is_admin());

CREATE POLICY "anyone_read_active_products"
  ON webdo24_products FOR SELECT
  USING (active = true);

-- ── upsell_events ──
ALTER TABLE webdo24_upsell_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_upsell_events" ON webdo24_upsell_events;
DROP POLICY IF EXISTS "customer_own_upsell_events_read" ON webdo24_upsell_events;
DROP POLICY IF EXISTS "customer_own_upsell_events_insert" ON webdo24_upsell_events;

CREATE POLICY "admin_all_upsell_events"
  ON webdo24_upsell_events FOR ALL USING (is_admin());

CREATE POLICY "customer_own_upsell_events_read"
  ON webdo24_upsell_events FOR SELECT
  USING (
    customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
  );

CREATE POLICY "customer_own_upsell_events_insert"
  ON webdo24_upsell_events FOR INSERT
  WITH CHECK (
    customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
  );

-- ── audit_log ──
ALTER TABLE webdo24_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_audit_log" ON webdo24_audit_log;
DROP POLICY IF EXISTS "customer_read_own_audit_log" ON webdo24_audit_log;

CREATE POLICY "admin_all_audit_log"
  ON webdo24_audit_log FOR ALL USING (is_admin());

CREATE POLICY "customer_read_own_audit_log"
  ON webdo24_audit_log FOR SELECT
  USING (
    customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
  );

-- ============================================
-- 8. SEED – základní katalog produktů (upsell)
-- ============================================
INSERT INTO webdo24_products (slug, name, short_description, price_cents, currency, billing_type, category, icon_key, sort_order)
VALUES
  ('seo-balicek',   'SEO balíček',            'Optimalizace pro Google, aby vás zákazníci našli.',                     199000, 'CZK', 'monthly',  'seo',         'Search',    10),
  ('blog-ai',       'Blog s AI články',       'Pravidelné AI články pro Váš obor. Zvýšení návštěvnosti.',              149000, 'CZK', 'monthly',  'content',     'FileText',  20),
  ('foto-balicek',  'Profi fotky',            'Sada AI a stock fotek na míru Vašemu oboru.',                            99000, 'CZK', 'one_time', 'media',       'Image',     30),
  ('google-firma',  'Google profil firmy',    'Založení a optimalizace profilu na Google Maps.',                        59000, 'CZK', 'one_time', 'marketing',   'MapPin',    40),
  ('rezervace',     'Rezervační systém',      'Online rezervace pro vaše zákazníky 24/7.',                             149000, 'CZK', 'monthly',  'integration', 'Calendar',  50),
  ('vicejazyk',     'Anglická verze webu',    'Kompletní překlad a vícejazyčná verze.',                                399000, 'CZK', 'one_time', 'content',     'Globe',     60),
  ('reklama-google','Google reklamy',         'Nastavení a správa Google Ads kampaní.',                                249000, 'CZK', 'monthly',  'marketing',   'Megaphone', 70),
  ('email-profi',   'Profi e-mail @firma.cz', 'Vlastní e-mailové schránky na Vaší doméně.',                             29000, 'CZK', 'monthly',  'integration', 'Mail',      80)
ON CONFLICT (slug) DO NOTHING;
