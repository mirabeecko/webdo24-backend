-- WEBDO24 - Customer Control Center: Core Domain (Phase 1)
-- Migration: 011
-- Date: 2026-08-08
--
-- Adds the canonical content + change model from
-- WEBDO24_CUSTOMER_CONTROL_CENTER_ARCHITECTURE.md (§3):
--   * pages / content_fields / content_values  – Content Registry
--   * company_profiles / brand_profiles        – globální profily
--   * changesets / changeset_items / publications – ChangeSet engine
--   * media_assets                             – Media Library
--   * customer_services / notifications        – služby a notifikace
--   * customer_memberships                     – role (owner/admin/editor/viewer)
-- Plus: schema drift cleanup (Stripe sloupce, zone_id), RLS pro
-- webdo24_hosting_subscriptions a seed memberships z customers.user_id.
--
-- Idempotentní: vše IF NOT EXISTS / DROP ... IF EXISTS, rerun-safe.

-- ============================================
-- 0. Předpoklady (existují z sql/001 – vytvořit jen pokud chybí)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END;
$$;

-- ============================================
-- 1. MEMBERSHIPS  (§3.7 – role; zakládá tenant přístup pro RLS)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_customer_memberships (
  customer_id UUID NOT NULL REFERENCES webdo24_customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (customer_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_webdo24_customer_memberships_user
  ON webdo24_customer_memberships(user_id);

-- Helper – je aktuální uživatel členem zákazníka? (SECURITY DEFINER: obchází
-- RLS memberships, aby policies na ostatních tabulkách nerekurzovaly)
CREATE OR REPLACE FUNCTION is_customer_member(p_customer_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM webdo24_customer_memberships
    WHERE customer_id = p_customer_id
      AND user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- 2. CONTENT REGISTRY  (§3.2)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES webdo24_customers(id),
  slug TEXT NOT NULL,                  -- 'home', 'o-nas', 'sluzby', 'kontakt'
  title TEXT NOT NULL,
  seo_title TEXT,
  seo_description TEXT,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_webdo24_pages_project ON webdo24_pages(project_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_pages_customer ON webdo24_pages(customer_id);

DROP TRIGGER IF EXISTS update_webdo24_pages_updated_at ON webdo24_pages;
CREATE TRIGGER update_webdo24_pages_updated_at
  BEFORE UPDATE ON webdo24_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS webdo24_content_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES webdo24_customers(id),
  page_id UUID REFERENCES webdo24_pages(id) ON DELETE CASCADE,  -- null = globální
  field_key TEXT NOT NULL,             -- 'homepage.hero.title', 'company.phone'
  section_key TEXT,                    -- 'hero', 'services', 'footer'
  field_type TEXT NOT NULL
    CHECK (field_type IN (
      'text', 'textarea', 'rich_text', 'number', 'boolean', 'url', 'email',
      'phone', 'image', 'gallery', 'logo', 'video', 'file', 'color',
      'select', 'repeater', 'cta'
    )),
  label TEXT NOT NULL,                 -- 'Hlavní nadpis' (česky, pro UI)
  validation JSONB DEFAULT '{}',       -- {max_length, pattern, required, options[]}
  sort_order INTEGER NOT NULL DEFAULT 0,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_webdo24_content_fields_project
  ON webdo24_content_fields(project_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_content_fields_customer
  ON webdo24_content_fields(customer_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_content_fields_page
  ON webdo24_content_fields(page_id);

DROP TRIGGER IF EXISTS update_webdo24_content_fields_updated_at ON webdo24_content_fields;
CREATE TRIGGER update_webdo24_content_fields_updated_at
  BEFORE UPDATE ON webdo24_content_fields
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Hodnoty: jen published. Draft žije výhradně v changeset_items (§22).
CREATE TABLE IF NOT EXISTS webdo24_content_values (
  field_id UUID PRIMARY KEY REFERENCES webdo24_content_fields(id) ON DELETE CASCADE,
  published_value JSONB,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS update_webdo24_content_values_updated_at ON webdo24_content_values;
CREATE TRIGGER update_webdo24_content_values_updated_at
  BEFORE UPDATE ON webdo24_content_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Usage index pro Media Library (§3.5): "kde je asset použitý"
CREATE INDEX IF NOT EXISTS idx_webdo24_content_values_asset_usage
  ON webdo24_content_values ((published_value->>'asset_id'))
  WHERE published_value ? 'asset_id';

-- ============================================
-- 3. GLOBÁLNÍ PROFILY  (§3.3)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_company_profiles (
  project_id UUID PRIMARY KEY REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES webdo24_customers(id),
  company_name TEXT,
  ico TEXT,
  dic TEXT,
  street TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Česká republika',
  email TEXT,
  phone TEXT,
  secondary_phone TEXT,
  facebook TEXT,
  instagram TEXT,
  linkedin TEXT,
  youtube TEXT,
  opening_hours JSONB,                 -- {po: "8:00–17:00", ...}
  google_maps_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_company_profiles_customer
  ON webdo24_company_profiles(customer_id);

DROP TRIGGER IF EXISTS update_webdo24_company_profiles_updated_at ON webdo24_company_profiles;
CREATE TRIGGER update_webdo24_company_profiles_updated_at
  BEFORE UPDATE ON webdo24_company_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS webdo24_brand_profiles (
  project_id UUID PRIMARY KEY REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES webdo24_customers(id),
  logo_asset_id UUID,                  -- → media_assets (hlavní logo)
  logo_light_asset_id UUID,
  logo_dark_asset_id UUID,
  favicon_asset_id UUID,
  icon_asset_id UUID,
  primary_color TEXT,
  secondary_color TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_brand_profiles_customer
  ON webdo24_brand_profiles(customer_id);

DROP TRIGGER IF EXISTS update_webdo24_brand_profiles_updated_at ON webdo24_brand_profiles;
CREATE TRIGGER update_webdo24_brand_profiles_updated_at
  BEFORE UPDATE ON webdo24_brand_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. CHANGESET ENGINE  (§3.4)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_changesets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES webdo24_customers(id),
  title TEXT NOT NULL,                 -- 'Aktualizace homepage — srpen 2026'
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'validated', 'preview_ready', 'approved',
      'publishing', 'published', 'publish_failed', 'cancelled'
    )),
  source TEXT NOT NULL DEFAULT 'gui'
    CHECK (source IN ('gui', 'ai', 'webdo24', 'api')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_changesets_project ON webdo24_changesets(project_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_changesets_customer ON webdo24_changesets(customer_id);

DROP TRIGGER IF EXISTS update_webdo24_changesets_updated_at ON webdo24_changesets;
CREATE TRIGGER update_webdo24_changesets_updated_at
  BEFORE UPDATE ON webdo24_changesets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS webdo24_changeset_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changeset_id UUID NOT NULL REFERENCES webdo24_changesets(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES webdo24_content_fields(id),
  old_value JSONB,                     -- snapshot published_value při vytvoření
  new_value JSONB NOT NULL,            -- draft hodnota
  item_type TEXT NOT NULL DEFAULT 'content'
    CHECK (item_type IN ('content', 'media', 'branding', 'company', 'seo', 'page')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (changeset_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_webdo24_changeset_items_changeset
  ON webdo24_changeset_items(changeset_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_changeset_items_field
  ON webdo24_changeset_items(field_id);

CREATE TABLE IF NOT EXISTS webdo24_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changeset_id UUID NOT NULL REFERENCES webdo24_changesets(id),
  project_id UUID NOT NULL REFERENCES webdo24_projects(id),
  customer_id UUID NOT NULL REFERENCES webdo24_customers(id),
  site_version_id UUID REFERENCES webdo24_site_versions(id) ON DELETE SET NULL,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  items_snapshot JSONB NOT NULL,       -- [{field_key, old, new}]
  verification JSONB,                  -- výsledek post-publish checku
  status TEXT NOT NULL CHECK (status IN ('published', 'failed', 'rolled_back')),
  is_rollback_of UUID REFERENCES webdo24_publications(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_publications_changeset
  ON webdo24_publications(changeset_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_publications_project
  ON webdo24_publications(project_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_publications_customer
  ON webdo24_publications(customer_id);

-- WebsiteVersion ↔ ChangeSet (§3.1): doplnit changeset_id na site_versions
ALTER TABLE webdo24_site_versions
  ADD COLUMN IF NOT EXISTS changeset_id UUID
    REFERENCES webdo24_changesets(id) ON DELETE SET NULL;

-- ============================================
-- 5. MEDIA LIBRARY  (§3.5)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES webdo24_customers(id),
  project_id UUID NOT NULL REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'photo'
    CHECK (category IN ('photo', 'logo', 'gallery', 'product', 'document', 'video')),
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,          -- {customer_id}/{project_id}/{asset_id}/{filename}
  original_url TEXT NOT NULL,
  optimized_url TEXT,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  alt_text TEXT,
  source TEXT NOT NULL DEFAULT 'upload'
    CHECK (source IN ('upload', 'ai', 'stock')),
  parent_asset_id UUID REFERENCES webdo24_media_assets(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_media_assets_customer
  ON webdo24_media_assets(customer_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_media_assets_project
  ON webdo24_media_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_media_assets_parent
  ON webdo24_media_assets(parent_asset_id);

-- ============================================
-- 6. SLUŽBY A NOTIFIKACE  (§3.6)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_customer_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES webdo24_customers(id),
  product_id UUID NOT NULL REFERENCES webdo24_products(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled', 'available')),
  price_cents INTEGER,
  next_billing_at TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_webdo24_customer_services_customer
  ON webdo24_customer_services(customer_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_customer_services_product
  ON webdo24_customer_services(product_id);

DROP TRIGGER IF EXISTS update_webdo24_customer_services_updated_at ON webdo24_customer_services;
CREATE TRIGGER update_webdo24_customer_services_updated_at
  BEFORE UPDATE ON webdo24_customer_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS webdo24_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES webdo24_customers(id),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,                  -- 'published','publish_failed','request_done','new_lead','billing'
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_notifications_customer
  ON webdo24_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_notifications_user
  ON webdo24_notifications(user_id);

-- ============================================
-- 7. SCHEMA DRIFT CLEANUP  (§1.4/6, §8.9)
-- ============================================
ALTER TABLE webdo24_customers
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

ALTER TABLE webdo24_projects
  ADD COLUMN IF NOT EXISTS zone_id TEXT;

-- ============================================
-- 8. RLS POLICIES
-- ============================================
-- Vzor (§8): admin má plný přístup přes is_admin(), zákazník přes
-- membership. Protected tabulky (content_values, publications,
-- changeset_items) jsou pro zákazníka SELECT-only – mutace jdou přes
-- service role v doménových službách (stejně jako site_versions v sql/006).

-- ── memberships ──
ALTER TABLE webdo24_customer_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_memberships" ON webdo24_customer_memberships;
DROP POLICY IF EXISTS "customer_read_own_memberships" ON webdo24_customer_memberships;

CREATE POLICY "admin_all_memberships"
  ON webdo24_customer_memberships FOR ALL USING (is_admin());

-- uživatel vidí svoje členství (tenant resolution); správa rolí přes service role
CREATE POLICY "customer_read_own_memberships"
  ON webdo24_customer_memberships FOR SELECT
  USING (user_id = auth.uid());

-- ── pages ──
ALTER TABLE webdo24_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_pages" ON webdo24_pages;
DROP POLICY IF EXISTS "customer_read_pages" ON webdo24_pages;
DROP POLICY IF EXISTS "customer_write_pages" ON webdo24_pages;

CREATE POLICY "admin_all_pages"
  ON webdo24_pages FOR ALL USING (is_admin());

CREATE POLICY "customer_read_pages"
  ON webdo24_pages FOR SELECT
  USING (is_customer_member(customer_id));

CREATE POLICY "customer_write_pages"
  ON webdo24_pages FOR ALL
  USING (is_customer_member(customer_id))
  WITH CHECK (is_customer_member(customer_id));

-- ── content_fields ──
ALTER TABLE webdo24_content_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_content_fields" ON webdo24_content_fields;
DROP POLICY IF EXISTS "customer_read_content_fields" ON webdo24_content_fields;
DROP POLICY IF EXISTS "customer_write_content_fields" ON webdo24_content_fields;

CREATE POLICY "admin_all_content_fields"
  ON webdo24_content_fields FOR ALL USING (is_admin());

CREATE POLICY "customer_read_content_fields"
  ON webdo24_content_fields FOR SELECT
  USING (is_customer_member(customer_id));

CREATE POLICY "customer_write_content_fields"
  ON webdo24_content_fields FOR ALL
  USING (is_customer_member(customer_id))
  WITH CHECK (is_customer_member(customer_id));

-- ── content_values ── (protected: mutace jen přes service role)
ALTER TABLE webdo24_content_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_content_values" ON webdo24_content_values;
DROP POLICY IF EXISTS "customer_read_content_values" ON webdo24_content_values;

CREATE POLICY "admin_all_content_values"
  ON webdo24_content_values FOR ALL USING (is_admin());

CREATE POLICY "customer_read_content_values"
  ON webdo24_content_values FOR SELECT
  USING (
    field_id IN (
      SELECT id FROM webdo24_content_fields
      WHERE is_customer_member(customer_id)
    )
  );

-- ── company_profiles ──
ALTER TABLE webdo24_company_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_company_profiles" ON webdo24_company_profiles;
DROP POLICY IF EXISTS "customer_read_company_profiles" ON webdo24_company_profiles;
DROP POLICY IF EXISTS "customer_write_company_profiles" ON webdo24_company_profiles;

CREATE POLICY "admin_all_company_profiles"
  ON webdo24_company_profiles FOR ALL USING (is_admin());

CREATE POLICY "customer_read_company_profiles"
  ON webdo24_company_profiles FOR SELECT
  USING (is_customer_member(customer_id));

CREATE POLICY "customer_write_company_profiles"
  ON webdo24_company_profiles FOR ALL
  USING (is_customer_member(customer_id))
  WITH CHECK (is_customer_member(customer_id));

-- ── brand_profiles ──
ALTER TABLE webdo24_brand_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_brand_profiles" ON webdo24_brand_profiles;
DROP POLICY IF EXISTS "customer_read_brand_profiles" ON webdo24_brand_profiles;
DROP POLICY IF EXISTS "customer_write_brand_profiles" ON webdo24_brand_profiles;

CREATE POLICY "admin_all_brand_profiles"
  ON webdo24_brand_profiles FOR ALL USING (is_admin());

CREATE POLICY "customer_read_brand_profiles"
  ON webdo24_brand_profiles FOR SELECT
  USING (is_customer_member(customer_id));

CREATE POLICY "customer_write_brand_profiles"
  ON webdo24_brand_profiles FOR ALL
  USING (is_customer_member(customer_id))
  WITH CHECK (is_customer_member(customer_id));

-- ── changesets ── (zákazník čte a zakládá drafty; změny stavu přes service role)
ALTER TABLE webdo24_changesets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_changesets" ON webdo24_changesets;
DROP POLICY IF EXISTS "customer_read_changesets" ON webdo24_changesets;
DROP POLICY IF EXISTS "customer_insert_changesets" ON webdo24_changesets;

CREATE POLICY "admin_all_changesets"
  ON webdo24_changesets FOR ALL USING (is_admin());

CREATE POLICY "customer_read_changesets"
  ON webdo24_changesets FOR SELECT
  USING (is_customer_member(customer_id));

CREATE POLICY "customer_insert_changesets"
  ON webdo24_changesets FOR INSERT
  WITH CHECK (is_customer_member(customer_id) AND created_by = auth.uid());

-- ── changeset_items ── (protected: mutace jen přes service role)
ALTER TABLE webdo24_changeset_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_changeset_items" ON webdo24_changeset_items;
DROP POLICY IF EXISTS "customer_read_changeset_items" ON webdo24_changeset_items;

CREATE POLICY "admin_all_changeset_items"
  ON webdo24_changeset_items FOR ALL USING (is_admin());

CREATE POLICY "customer_read_changeset_items"
  ON webdo24_changeset_items FOR SELECT
  USING (
    changeset_id IN (
      SELECT id FROM webdo24_changesets
      WHERE is_customer_member(customer_id)
    )
  );

-- ── publications ── (protected: mutace jen přes service role)
ALTER TABLE webdo24_publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_publications" ON webdo24_publications;
DROP POLICY IF EXISTS "customer_read_publications" ON webdo24_publications;

CREATE POLICY "admin_all_publications"
  ON webdo24_publications FOR ALL USING (is_admin());

CREATE POLICY "customer_read_publications"
  ON webdo24_publications FOR SELECT
  USING (is_customer_member(customer_id));

-- ── media_assets ──
ALTER TABLE webdo24_media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_media_assets" ON webdo24_media_assets;
DROP POLICY IF EXISTS "customer_read_media_assets" ON webdo24_media_assets;
DROP POLICY IF EXISTS "customer_write_media_assets" ON webdo24_media_assets;

CREATE POLICY "admin_all_media_assets"
  ON webdo24_media_assets FOR ALL USING (is_admin());

CREATE POLICY "customer_read_media_assets"
  ON webdo24_media_assets FOR SELECT
  USING (is_customer_member(customer_id));

CREATE POLICY "customer_write_media_assets"
  ON webdo24_media_assets FOR ALL
  USING (is_customer_member(customer_id))
  WITH CHECK (is_customer_member(customer_id));

-- ── customer_services ── (billing detail: mutace přes service role / Stripe webhook)
ALTER TABLE webdo24_customer_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_customer_services" ON webdo24_customer_services;
DROP POLICY IF EXISTS "customer_read_customer_services" ON webdo24_customer_services;

CREATE POLICY "admin_all_customer_services"
  ON webdo24_customer_services FOR ALL USING (is_admin());

CREATE POLICY "customer_read_customer_services"
  ON webdo24_customer_services FOR SELECT
  USING (is_customer_member(customer_id));

-- ── notifications ── (zákazník čte a označuje přečtené; tvorba přes service role)
ALTER TABLE webdo24_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_notifications" ON webdo24_notifications;
DROP POLICY IF EXISTS "customer_read_notifications" ON webdo24_notifications;
DROP POLICY IF EXISTS "customer_update_notifications" ON webdo24_notifications;

CREATE POLICY "admin_all_notifications"
  ON webdo24_notifications FOR ALL USING (is_admin());

CREATE POLICY "customer_read_notifications"
  ON webdo24_notifications FOR SELECT
  USING (is_customer_member(customer_id));

CREATE POLICY "customer_update_notifications"
  ON webdo24_notifications FOR UPDATE
  USING (is_customer_member(customer_id))
  WITH CHECK (is_customer_member(customer_id));

-- ── hosting_subscriptions ── (drift cleanup §8.9: tabulka existuje z
--    supabase/migrations/20260727 bez RLS; vazba přes customer_email)
ALTER TABLE webdo24_hosting_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_hosting_subscriptions" ON webdo24_hosting_subscriptions;
DROP POLICY IF EXISTS "customer_read_own_hosting_subscriptions" ON webdo24_hosting_subscriptions;

CREATE POLICY "admin_all_hosting_subscriptions"
  ON webdo24_hosting_subscriptions FOR ALL USING (is_admin());

CREATE POLICY "customer_read_own_hosting_subscriptions"
  ON webdo24_hosting_subscriptions FOR SELECT
  USING (
    customer_email IN (
      SELECT c.email
      FROM webdo24_customers c
      WHERE c.user_id = auth.uid()
         OR c.id IN (
           SELECT customer_id FROM webdo24_customer_memberships
           WHERE user_id = auth.uid()
         )
    )
  );

-- ============================================
-- 9. SEED – memberships pro existující zákazníky (§3.7 V1 migrace)
-- ============================================
INSERT INTO webdo24_customer_memberships (customer_id, user_id, role)
SELECT id, user_id, 'owner'
FROM webdo24_customers
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;
