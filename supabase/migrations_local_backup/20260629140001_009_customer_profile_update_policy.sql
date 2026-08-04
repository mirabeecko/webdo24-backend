-- WEBDO24 - Allow customers to update their own profile
-- Migration: 009
-- Date: 2026-06-29

-- Customers could only read their profile; this adds UPDATE so they can edit
-- name, company, phone, ico, dic, address from the settings page.

DROP POLICY IF EXISTS "customer_own_profile_update" ON webdo24_customers;

CREATE POLICY "customer_own_profile_update"
  ON webdo24_customers FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
