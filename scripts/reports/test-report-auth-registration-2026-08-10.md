# Test report — registrační tok (Supabase Auth)

- Datum: 2026-08-10
- Prostředí: cloud Supabase projekt `mljqltwcdqknezuqpisb` (dle .env.local webdo24-backend), testovací režim
- Rozsah: signUp, insert webdo24_customers, login, RLS izolace, úklid
- Výsledek: **2 kritické chyby (1 bezpečnostní), 3 vedlejší nálezy**

## Souhrn

| Krok | Výsledek | Poznámka |
|---|---|---|
| GET /auth/v1/settings | OK | email provider zapnutý, Google zapnutý |
| signUp (anon, role=customer) | OK | user vytvořen, confirmation vypnutý (identities=1) |
| insert webdo24_customers (registerAction scénář) | **FAIL** | 400 NOT NULL `phone` |
| insert webdo24_customers (service role) | OK | s polem `phone` projde (201) |
| login (signInWithPassword) | OK | session vrácena |
| SELECT vlastního profilu | **FAIL** | 0 řádků — customer záznam nikdy nevznikne |
| RLS — anon INSERT | **FAIL** | 201 — anon MŮŽE vkládat |
| RLS — anon SELECT cizí záznam | **FAIL** | 200, 1 řádek — anon VIDÍ cizí data |
| RLS — authenticated UPDATE cizí záznam | **FAIL** | 204 — uživatel B změnil záznam A |
| Úklid testovacích dat | OK | žádné zbytky |

## KRITICKÉ CHYBY

### K1. Registrace nevytvoří customer záznam (NOT NULL `phone`) — tok je rozbitý

`registerAction` (src/lib/actions/auth.ts:55-63) i klient (src/app/register/page.tsx:39-43)
posílají insert jen s `{user_id, name, email}`. Cloudové schéma má ale sloupec
`webdo24_customers.phone` NOT NULL bez defaultu:

```
HTTP 400: null value in column "phone" of relation "webdo24_customers" violates not-null constraint
```

Důsledky:
- Zákazník se zaregistruje (auth user vznikne, login funguje), ale profil v
  `webdo24_customers` NEVZNIKNE.
- `getCustomerId()` (src/lib/auth.ts:40-49) vrací null → dashboard/nastavení nefungují.
- Welcome email se nikdy nepošle (queueEmailToCustomer se volá jen když `customer?.id`).
- **Chyba je tichá**: `registerAction` vrací `{ success: true }` i při selhání insertu
  (řádek 72), žádný log, žádná indikace pro uživatele.

### K2. RLS na cloudu NEblokuje přístup k webdo24_customers (bezpečnostní díra)

Ověřeno reálnými requesty s anon klíčem (veřejný klíč z client-side kódu):

- ANON bez session: `INSERT` do webdo24_customers → **HTTP 201** (vytvoří řádek s cizím user_id)
- ANON bez session: `SELECT` cizích záznamů → **HTTP 200**, vidí všech **7 customers**,
  **4 projects**, **6 leads** (emaily, jména, telefony)
- Authenticated uživatel B: `UPDATE` záznamu uživatele A → **HTTP 204** (změnil name na "HACKED")
- Authenticated uživatel B: `SELECT` záznamu A → **HTTP 200**, 1 řádek

Politiky deklarované v repu (sql/001, 002: `customer_own_profile` SELECT,
`customer_own_profile_update` UPDATE, `admin_all_customers` ALL) na cloudu zjevně
nejsou aplikované, nebo je RLS na tabulkách vypnuté. Žádná z politik neobsahuje
INSERT pro anon/authenticated — přesto insert prošel, což potvrzuje, že RLS
na cloudu nehlídá nic.

Dopad: kdokoli s anon klíčem může číst a modifikovat data zákazníků a leadů.

## VEDLEJŠÍ NÁLEZY

### V1. Schema drift: cloud ≠ repo

OpenAPI (GET /rest/v1/ s service role) ukazuje NOT NULL na: `phone`, `company`,
`stripe_customer_id`, `stripe_subscription_id`, `subscription_status`,
`current_period_end`, `paid_months`, `ico`, `dic`, `address`, `note`,
`telegram_phone`, `telegram_connected`, `telegram_chat_id`, `user_id`.
V repu (sql/001_initial_schema.sql:5-17) jsou tyto sloupce nullable/bez NOT NULL.
Migrace v supabase/migrations/ žádné `SET NOT NULL` na tyto sloupce neobsahují →
tabulka na cloudu byla vytvořena jinak (starší schéma / ruční úprava) a repo s ní
neodpovídá.

### V2. Client-side insert (register/page.tsx) by selhal i s funkčním RLS

Registrační stránka dělá insert přímo z prohlížeče s anon klíčem. Ani s aplikovanými
politikami z repu neexistuje INSERT politika pro anon/authenticated → insert by selhal
na RLS. Správně má insert běžet na serveru (service role) nebo musí existovat
RLS politika pro registraci.

### V3. loginAction ručně nastavuje cookies

src/lib/actions/auth.ts:19-32 nastavuje `sb-access-token` a `sb-refresh-token` ručně.
`@supabase/ssr` createServerClient (src/lib/supabase/server.ts) čte standardní cookie
`sb-<ref>-auth-token` — ručně nastavené cookies nemusí být SSR klientem rozpoznané.
Vyžaduje ověření za běhu (login → getUser přes SSR), ale kód je nestandardní.

## Doporučené opravy

1. **K1**: Opravit schéma (sloupce `phone` a ostatní NOT NULL bez defaultu na nullable
   nebo s default `''`), NEBO posílat kompletní payload. Navíc: `registerAction` musí
   kontrolovat chybu insertu a vracet ji uživateli (nikdy tichý `success: true`).
   Insert dělat přes service role (createAdminClient), ne anon.
2. **K2**: Aplikovat na cloud chybějící RLS: `ENABLE ROW LEVEL SECURITY` na
   webdo24_customers (+ projects, leads, ...) a politiky z repu; přidat INSERT politiku
   pro registraci (např. `WITH CHECK (user_id = auth.uid())`) — nebo lépe zrušit
   client-side insert a dělat ho serverově.
3. **V1**: Sjednotit schéma (migrace `SET NOT NULL` vs repo) — zdroj pravdy v repu.
4. **V3**: Používat standardní SSR cookie handling z @supabase/ssr (setAll v
   createServerClient) místo ručního nastavování.

## Testovací data

Použity testovací emaily `*-test-<ts>@webdo24-test.cz`, po testu smazáni uživatelé
i customer řádky (ověřeno: 0 záznamů v customers, 0 users s doménou webdo24-test.cz).
Skripty: scripts/test-auth-registration.sh, scripts/test-auth-rls-detail.sh,
scripts/test-auth-rls-clean.sh
