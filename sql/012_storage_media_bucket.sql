-- WEBDO24 - Storage bucket pro Media Library (CCC, architektura §7)
-- Migration: 012
-- Date: 2026-08-08
--
-- Bucket webdo24-files v projektu chyběl (legacy upload route na něj
-- odkazoval, ale nikdy nebyl vytvořený). V1: veřejný read (jako dosud),
-- cesty scoped per customer/project, zápis jen přes service role.
--
-- POZOR: storage.buckets se nemigruje přes db push u všech verzí CLI –
-- bucket byl vytvořen přes Storage API (admin.storage.createBucket)
-- dne 2026-08-08 a tento soubor slouží jako záznam/idempotentní doplněk.

INSERT INTO storage.buckets (id, name, public)
VALUES ('webdo24-files', 'webdo24-files', true)
ON CONFLICT (id) DO NOTHING;
