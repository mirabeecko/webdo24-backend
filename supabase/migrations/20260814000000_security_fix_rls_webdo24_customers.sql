-- WebDo24 — SECURITY FIX: RLS na webdo24_customers
-- ============================================================
-- Datum:      2026-08-14
-- Root cause: RLS byl na tabulce webdo24_customers VYPNUTÝ
--             (tabulka vznikla mimo migrace, RLS se nikdy nezapnul).
-- Dopad:      anon MŮŽE vkládat, číst i měnit CIZÍ záznamy.
-- Důkaz:      scripts/test-auth-rls-clean.sh → 5 bezpečnostních FAILů
--             (2026-08-14, cloud projekt mljqltwcdqknezuqpisb).
-- Fix:        ENABLE ROW LEVEL SECURITY + policy vlastníka záznamu.
-- Nasazení:   supabase db push  (vyžaduje supabase login / PAT token)
-- Po nasazení: bash scripts/test-auth-rls-clean.sh → očekáváno 7/7 PASS.

-- 1) Zapnout RLS
ALTER TABLE webdo24_customers ENABLE ROW LEVEL SECURITY;

-- 2) SELECT: zákazník vidí jen svůj záznam (user_id = auth.uid())
DROP POLICY IF EXISTS "customer_select_own" ON webdo24_customers;
CREATE POLICY "customer_select_own"
  ON webdo24_customers FOR SELECT
  USING (user_id = auth.uid());

-- 3) INSERT: registrace (src/app/register/page.tsx) vkládá jen vlastní záznam
--    (user_id = data.user.id); WITH CHECK zabrání vložení cizího user_id.
DROP POLICY IF EXISTS "customer_insert_own" ON webdo24_customers;
CREATE POLICY "customer_insert_own"
  ON webdo24_customers FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 4) UPDATE: existující policy z migrace 009, idempotentně drop+create
DROP POLICY IF EXISTS "customer_own_profile_update" ON webdo24_customers;
CREATE POLICY "customer_own_profile_update"
  ON webdo24_customers FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5) DELETE: záměrně ŽÁDNÁ policy pro anon/authenticated —
--    mazání pouze přes service role (admin klient), která RLS bypassuje.

-- 6) Vedlejší nález z test reportu (2026-08-10): registrace padala na
--    NOT NULL phone (register vkládá jen user_id/name/email).
--    DROP NOT NULL je idempotentní — pokud už sloupec nullable je, nic se nestane.
ALTER TABLE webdo24_customers ALTER COLUMN phone DROP NOT NULL;
