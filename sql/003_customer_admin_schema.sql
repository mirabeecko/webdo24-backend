-- WEBDO24 LEAD MACHINE™ - Customer Admin Schema
-- Spusť v Supabase SQL Editoru

-- ============================================
-- 1. Tabulka poptávek (leads)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  message TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'whatsapp', 'email', 'form', 'phone')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'negotiation', 'done')),
  ai_reply TEXT,
  ai_reply_used BOOLEAN DEFAULT false,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_leads_project_id ON webdo24_leads(project_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_leads_status ON webdo24_leads(status);
CREATE INDEX IF NOT EXISTS idx_webdo24_leads_created_at ON webdo24_leads(created_at DESC);

-- Trigger pro updated_at
CREATE TRIGGER IF NOT EXISTS update_webdo24_leads_updated_at
  BEFORE UPDATE ON webdo24_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. Tabulka zpráv (messages)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES webdo24_leads(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'user', 'ai')),
  content TEXT NOT NULL,
  is_ai_suggestion BOOLEAN DEFAULT false,
  ai_action TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_messages_lead_id ON webdo24_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_messages_created_at ON webdo24_messages(created_at DESC);

-- ============================================
-- 3. Tabulka obsahu webu (website_content)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_website_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'textarea', 'image', 'phone', 'list')),
  content_value TEXT NOT NULL,
  is_published BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_webdo24_website_content_project_id ON webdo24_website_content(project_id);

CREATE TRIGGER IF NOT EXISTS update_webdo24_website_content_updated_at
  BEFORE UPDATE ON webdo24_website_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. Tabulka referencí (testimonials)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  text TEXT NOT NULL,
  image_url TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_testimonials_project_id ON webdo24_testimonials(project_id);

-- ============================================
-- 5. Tabulka služeb (services)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price TEXT,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webdo24_services_project_id ON webdo24_services(project_id);

-- ============================================
-- 6. Tabulka automatizací (automations)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES webdo24_customers(id) ON DELETE CASCADE,
  automation_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  template TEXT,
  settings JSONB DEFAULT '{}',
  UNIQUE(customer_id, automation_key)
);

CREATE INDEX IF NOT EXISTS idx_webdo24_automations_customer_id ON webdo24_automations(customer_id);

-- ============================================
-- 7. Tabulka návštěvnosti (analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS webdo24_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES webdo24_projects(id) ON DELETE CASCADE,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  form_submissions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, event_date)
);

CREATE INDEX IF NOT EXISTS idx_webdo24_analytics_project_id ON webdo24_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_webdo24_analytics_event_date ON webdo24_analytics(event_date DESC);

-- ============================================
-- 8. RLS Policies
-- ============================================
ALTER TABLE webdo24_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_website_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webdo24_analytics ENABLE ROW LEVEL SECURITY;

-- Leads: admin vše, customer svoje přes project
DROP POLICY IF EXISTS "admin_all_leads" ON webdo24_leads;
DROP POLICY IF EXISTS "customer_own_leads" ON webdo24_leads;
CREATE POLICY "admin_all_leads" ON webdo24_leads FOR ALL USING (is_admin());
CREATE POLICY "customer_own_leads" ON webdo24_leads FOR ALL USING (
  project_id IN (
    SELECT id FROM webdo24_projects
    WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
  )
);

-- Messages: admin vše, customer svoje přes lead
DROP POLICY IF EXISTS "admin_all_messages" ON webdo24_messages;
DROP POLICY IF EXISTS "customer_own_messages" ON webdo24_messages;
CREATE POLICY "admin_all_messages" ON webdo24_messages FOR ALL USING (is_admin());
CREATE POLICY "customer_own_messages" ON webdo24_messages FOR ALL USING (
  lead_id IN (
    SELECT id FROM webdo24_leads
    WHERE project_id IN (
      SELECT id FROM webdo24_projects
      WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
    )
  )
);

-- Website content: admin vše, customer svoje
DROP POLICY IF EXISTS "admin_all_website_content" ON webdo24_website_content;
DROP POLICY IF EXISTS "customer_own_website_content" ON webdo24_website_content;
CREATE POLICY "admin_all_website_content" ON webdo24_website_content FOR ALL USING (is_admin());
CREATE POLICY "customer_own_website_content" ON webdo24_website_content FOR ALL USING (
  project_id IN (
    SELECT id FROM webdo24_projects
    WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
  )
);

-- Testimonials: admin vše, customer svoje
DROP POLICY IF EXISTS "admin_all_testimonials" ON webdo24_testimonials;
DROP POLICY IF EXISTS "customer_own_testimonials" ON webdo24_testimonials;
CREATE POLICY "admin_all_testimonials" ON webdo24_testimonials FOR ALL USING (is_admin());
CREATE POLICY "customer_own_testimonials" ON webdo24_testimonials FOR ALL USING (
  project_id IN (
    SELECT id FROM webdo24_projects
    WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
  )
);

-- Services: admin vše, customer svoje
DROP POLICY IF EXISTS "admin_all_services" ON webdo24_services;
DROP POLICY IF EXISTS "customer_own_services" ON webdo24_services;
CREATE POLICY "admin_all_services" ON webdo24_services FOR ALL USING (is_admin());
CREATE POLICY "customer_own_services" ON webdo24_services FOR ALL USING (
  project_id IN (
    SELECT id FROM webdo24_projects
    WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
  )
);

-- Automations: admin vše, customer svoje přes customer_id
DROP POLICY IF EXISTS "admin_all_automations" ON webdo24_automations;
DROP POLICY IF EXISTS "customer_own_automations" ON webdo24_automations;
CREATE POLICY "admin_all_automations" ON webdo24_automations FOR ALL USING (is_admin());
CREATE POLICY "customer_own_automations" ON webdo24_automations FOR ALL USING (
  customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
);

-- Analytics: admin vše, customer svoje
DROP POLICY IF EXISTS "admin_all_analytics" ON webdo24_analytics;
DROP POLICY IF EXISTS "customer_own_analytics" ON webdo24_analytics;
CREATE POLICY "admin_all_analytics" ON webdo24_analytics FOR ALL USING (is_admin());
CREATE POLICY "customer_own_analytics" ON webdo24_analytics FOR SELECT USING (
  project_id IN (
    SELECT id FROM webdo24_projects
    WHERE customer_id IN (SELECT id FROM webdo24_customers WHERE user_id = auth.uid())
  )
);
