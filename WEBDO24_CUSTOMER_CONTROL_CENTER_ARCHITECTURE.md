# WebDo24 — Customer Control Center: Architektura

Verze: 1.0 · 2026-08-08
Status: návrh k implementaci (Phase 0 dokončena)

> Princip: zákazník řekne **CO** chce změnit → WebDo24 zajistí **JAK** se změna
> bezpečně projeví na jeho webu. Jediná cesta do produkce:
> `GUI / AI / WebDo24 pracovník → API → ChangeSet → Validation → Preview → Approval → Publish → Audit`.

---

## 0. Klíčová rozhodnutí (TL;DR)

| # | Rozhodnutí | Volba | Důvod |
|---|---|---|---|
| 1 | Publikování (§34) | **Runtime content + version pointer** (varianta A, hybrid) | Zákaznické weby už dnes renderuje tato Next.js aplikace jako dynamické SSR stránky z DB. Build-time rebuild by znamenal novou deploy infrastrukturu, která neexistuje a pro V1 nic nepřináší. |
| 2 | Content model | **Content Registry** (ContentField/ContentValue) jako kanonický model; `website_content` key-value se migruje a deprecatuje | Dnes existují dva paralelní modely (flat key-value vs. SiteSnapshot JSONB) — Registry je sjednocení s draft/published hodnotami a validací. |
| 3 | Versioning | Znovupoužít `webdo24_site_versions` jako WebsiteVersion | Backbone (1 live per project, parent chain, draft→preview→live) už existuje včetně RLS a akcí. |
| 4 | Preview | **Signed preview token** v query parametru stávajícího rendereru `/{slug}` | Žádná externí preview URL od n8n; preview je first-class URL naší aplikace, funguje i pro přímé editace. |
| 5 | Média | Nová `webdo24_media_assets` + Storage cesty `{customer_id}/{project_id}/...` | Dnešní `webdo24-files` bucket je sdílený a veřejný bez scopingu a usage trackingu. |
| 6 | Multitenancy | `customer_id` + RLS všude; `webdo24_customer_memberships` pro role | Dnes 1 user = 1 customer = 1 projekt (`.single()` helpery). Memberships odblokují týmy i více projektů bez přepisu auth. |
| 7 | Požadavky | `webdo24_change_requests` přežije jako CustomerRequest (rozšířit o `source`, `attachments`) | Flow s AI klasifikací, n8n a e-maily už funguje — neduplikovat. |

---

## 1. Současný stav projektu (Phase 0 — Discovery)

### 1.1 Stack a infrastruktura

- **Aplikace:** Next.js 16.2.4 (App Router, `output: 'standalone'`, webpack build), React 19.2.4, Tailwind CSS v4 (CSS-first config v `globals.css`), TypeScript 5. Dev/start na portu **3001**.
- **DB/Auth/Storage:** Supabase Cloud (Postgres, Auth email+password, Storage bucket `webdo24-files`). RLS zapnuté na všech `webdo24_*` tabulkách, helper `is_admin()` (user_metadata.role = 'admin').
- **Hosting:** VPS `/var/www/webdo24-backend`, PM2 (`pm2/ecosystem.config.js`) nebo systemd, deploy přes `scripts/deploy.sh` (git pull → npm ci → build → pm2 restart). Caddy terminuje TLS:
  - `login.webdo24.cz` → aplikace (zákaznický + admin portál) — **odpovídá vrstvě A (Customer Dashboard)**
  - `web.webdo24.cz` → veřejné weby zákazníků — **odpovídá vrstvě C (Customer Website)**
  - ⚠️ **Nesrovnalost:** `caddy/Caddyfile` proxyguje na port **3002**, PM2/systemd/package.json běží na **3001**. Pravděpodobně zastaralý Caddyfile — ověřit a sjednotit před Phase 3.
- **Vercel:** `.vercel/` link z května 2026, ale bez configu a mimo deploy proces → považovat za mrtvé.
- **Integrace:** Stripe (checkout, webhook, portal, hosting subscriptions), n8n self-hosted (generování webů, QA, e-mail fronta, change-request execution), Google service account (audit agent), Telegram (MVP, jen DB pole).

### 1.2 Jak dnes fungují weby zákazníků

1. Brief → `webdo24_projects` + `webdo24_project_briefs` → admin spustí `POST /api/pipeline/run` → n8n vygeneruje web → callback uloží `preview_url`, status `generated`.
2. „Deploy“ (`POST /api/deploy/project`) **jen překlopí status na `deployed`** — žádný reálný deploy mechanismus neexistuje (README to má jako TODO).
3. Veřejný web renderuje `src/app/[slug]/page.tsx` (`force-dynamic`) z tabulek `webdo24_website_content` (key-value: hero_title, phone, …), `webdo24_services`, `webdo24_testimonials`. URL: `web.webdo24.cz/{slug}`.
4. „Publikování“ z editoru = `revalidatePath('/{slug}')` — protože je stránka dynamická, obsah je živý okamžitě. **Přímé editace v `/web/editor` zapisují rovnou do produkce** (žádný draft/preview pro ruční editace).
5. Verzovací backbone z `sql/006` (`webdo24_site_versions`, draft→preview→live, rollback) **existuje, ale `[slug]` renderer ho nečte** — čte syrové tabulky. Dva paralelní content modely.
6. AI změnové požadavky (`webdo24_change_requests` + `change_actions`, klasifikátor, n8n webhooky, preview/approve) fungují a jsou předobrazem ChangeSet flow.
7. Vlastní domény (`custom_domain`, verification token) a sandbox URL jsou **jen DB pole + UI** — routing, verifikace ani Caddy wildcard neexistují.

### 1.3 Co už existuje (NEDUPLIKOVAT)

| Oblast | Stav |
|---|---|
| Zákazníci, projekty, briefy, faktury | `webdo24_customers`, `webdo24_projects`, `webdo24_invoices` (sql/001–002) |
| Jednoduchý CMS editor | `/web/editor` + `webdo24_website_content`, `services`, `testimonials` (sql/003) |
| Verzování + rollback | `webdo24_site_versions` + `src/lib/actions/site-versions.ts` (sql/006) |
| Snapshoty | `webdo24_website_snapshots` (max 4, auto před publikací, sql/008) |
| Change-request pipeline | `change_requests` + `change_actions` (14 atomických operací), n8n integrace |
| Leads CRM + zprávy | `webdo24_leads`, `webdo24_messages`, `/zpravy` |
| Analytika | `webdo24_analytics` (page_views/visitors/submissions per den) |
| Upsell / katalog služeb | `webdo24_products` (8 seed produktů), `webdo24_upsell_events` |
| Audit log | `webdo24_audit_log` (action, entity, diff JSONB, ip) |
| E-mail fronta | `webdo24_email_queue` + worker endpoint |
| Zákaznický portál | `(app)/` route group: dashboard, web, editor, pozadavky, zpravy, fakturace, nastaveni |

### 1.4 Gapy a dluhy, které architektura řeší

1. **Dva content modely** (key-value `website_content` vs. `SiteSnapshot`/`SiteConfig` JSONB) → sjednotit do Content Registry.
2. **Přímé editace obchází preview/publish** → veškeré změny přes ChangeSet.
3. **Žádná Media Library** — jen metadata souborů v `project_files`, sdílený veřejný bucket, žádné usage trackování, žádné varianty.
4. **Dva zákaznické portály** (`/customer/*` legacy light vs. `(app)/*`) a tři nesoudržná témata → konsolidace na `(app)`.
5. **Broken route:** adresář `src/app/(app/)/sluzby/` je doslova pojmenovaný `(app/)` → `/sluzby` 404, přestože navigace na něj odkazuje.
6. **Schema drift:** `stripe_customer_id`, `subscription_status`, `current_period_end` na customers a `zone_id` na projects používá kód, ale žádná migrace je nevytváří. `webdo24_hosting_subscriptions` nemá RLS.
7. **Žádný middleware** — `src/lib/supabase/middleware.ts` existuje, ale není zapojený; auth se řeší v každém layoutu zvlášť.
8. **1 user = 1 customer = 1 projekt** — `.single()` helpery, žádné členství/role/týmy.
9. **Mrtvý kód:** `DashboardView.tsx`, `EmailRoutingView.tsx`, `AuthGuard`, `/master` (duplikuje admin dashboard).
10. Dokumenty `docs/admin-*.md` („LEAD MACHINE™“) popisují jednodušší vizi, částečně implementovanou; tento dokument ji **nabourává v části content modelu** (Registry + ChangeSet), ale přebírá její UX principy („web se nedá rozbít“, mobilní priorita, AI jako asistent, nikdy autopilot).

---

## 2. Navrhovaná architektura

```
┌─────────────────────────────────────────────────────────────────┐
│ A. Customer Dashboard          login.webdo24.cz                 │
│    Next.js (app) route group — Přehled, Můj web, Obsah, Média,  │
│    Branding, Kontakty, Poptávky, Statistiky, Služby, Rozšíření, │
│    Požadavky, Fakturace, Nastavení                              │
└──────────────┬──────────────────────────────────────────────────┘
               │ server actions + route handlers (žádná business
               │ logika v komponentách)
┌──────────────▼──────────────────────────────────────────────────┐
│ B. Backend API                   stejná Next.js app, /api/v1/*  │
│    auth → tenant guard → RBAC → validace (zod) → doménové služby│
│    Jediný vstup pro GUI, AI agenty i WebDo24 pracovníky         │
└──────┬───────────────┬───────────────┬───────────────┬──────────┘
       │               │               │               │
┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│ D. Content  │ │ E. Publish  │ │ F. AI Layer │ │ Media       │
│ Layer       │ │ Layer       │ │ (n8n / AI   │ │ Library     │
│ Content     │ │ version     │ │  SDK)       │ │ Supabase    │
│ Registry    │ │ pointer +   │ │ návrhy →    │ │ Storage +   │
│ + ChangeSet │ │ revalidate  │ │ ChangeSet   │ │ varianty    │
│ + audit     │ │ + verify    │ │ (nikdy      │ │ + usage     │
│             │ │             │ │  autopilot) │ │             │
└──────┬──────┘ └──────┬──────┘ └─────────────┘ └─────────────┘
       │               │
┌──────▼───────────────▼──────────────────────────────────────────┐
│ C. Customer Website          web.webdo24.cz/{slug} (+ domény)   │
│    Renderer čte PUBLISHED content dle Website Contract v1,      │
│    editable místa označená data-content-id (inline editing)     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Vrstvy

- **A — Customer Dashboard:** existující `(app)/` route group, rozšířená o nové sekce. Server components čtou přes doménové služby, mutace přes server actions. Žádné technické pojmy v UI.
- **B — Backend API:** API-first. Doménové služby v `src/lib/ccc/` (Customer Control Center), tenké server actions v `src/lib/actions/ccc-*.ts`, route handlers pro externí klienty/webhooky. **Stejnou operaci volá GUI, AI i WebDo24 pracovník — jedna cesta.**
- **C — Customer Website:** `src/app/[slug]/` renderer přepsaný na Website Contract; později per-customer templates, ale vždy nad stejným kontraktem.
- **D — Content Layer:** Content Registry (§3.2) + ChangeSet engine (§3.4). Jediný zdroj pravdy pro editovatelný obsah.
- **E — Publishing Layer:** překlopení `current_version_id` / published hodnot + `revalidatePath` + post-publish verification (§5, §6, §36 master promptu).
- **F — AI Layer:** n8n/AI SDK návrhy textů a obrázků. Výstup AI je vždy jen ChangeItem v DRAFT — nikdy přímý zápis. AI není podmínkou fungování CMS.

### 2.2 Jediná cesta do produkce (§22)

```
GUI editace ──┐
AI agent ─────┼──► createChangeItems() ──► ChangeSet(DRAFT)
WebDo24 admin─┘         (src/lib/ccc/changesets.ts)
                              │
                        validate()  ── validační pravidla z Registry
                              │
                        preview()   ── signed preview token (§6)
                              │
                        approve()   ── dle role (OWNER/ADMIN, nebo WebDo24)
                              │
                        publish()   ── atomicky: published_value ← draft,
                                       nová WebsiteVersion, audit, notifikace
                              │
                        verify()    ── post-publish kontrola (§5.3)
                              │
                    PUBLISHED / PUBLISH_FAILED (+ retry/rollback)
```

---

## 3. Datový model

Konvence zůstává: prefix `webdo24_`, RLS všude, `customer_id` na každé tenantované entitě, `updated_at` trigger. Nové tabulky přijdou jako `sql/011_customer_control_center.sql` (+ kopie do `supabase/migrations/`).

### 3.1 Mapování na existující entity (§23)

| Entita (master prompt) | Realizace |
|---|---|
| User | `auth.users` (beze změny) |
| Customer | `webdo24_customers` (beze změny) |
| CustomerMembership | **nová** `webdo24_customer_memberships` |
| Project | `webdo24_projects` (beze změny) |
| Website | V1 = 1:1 s project (sloupce na projects); připraveno oddělení |
| Domain | V1 = sloupce `custom_domain*` na projects; dedikovaná tabulka až s routingem |
| Page / PageSection | **nové** `webdo24_pages`, sekce jako `section_id` v Registry |
| ContentField / ContentValue | **nové** `webdo24_content_fields`, `webdo24_content_values` |
| MediaAsset | **nová** `webdo24_media_assets` |
| BrandProfile / CompanyProfile | **nové** `webdo24_brand_profiles`, `webdo24_company_profiles` |
| ChangeSet / ChangeItem | **nové** `webdo24_changesets`, `webdo24_changeset_items` |
| WebsiteVersion | existující `webdo24_site_versions` (doplnit `changeset_id`) |
| Publication | **nová** `webdo24_publications` |
| CustomerRequest | existující `webdo24_change_requests` (+ `source`, `attachments`) |
| ServiceCatalogItem | existující `webdo24_products` |
| CustomerService / Subscription | **nová** `webdo24_customer_services`; `webdo24_hosting_subscriptions` zůstává billing detail |
| Lead / FormSubmission | existující `webdo24_leads` (+ `webdo24_form_submissions` později) |
| AuditLog | existující `webdo24_audit_log` |
| Notification | **nová** `webdo24_notifications` |
| Připraveno (§23 rozšiřitelnost) | AIConversation, AIAction, Agent, Automation, Invoice ✓, Payment ✓ (Stripe), AnalyticsConnection, ExternalIntegration — až v Phase 5/6 |

### 3.2 Content Registry — jádro

```sql
-- Stránky webu (V1: předdefinované, ne page builder)
create table webdo24_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references webdo24_projects(id) on delete cascade,
  customer_id uuid not null references webdo24_customers(id),
  slug text not null,                  -- 'home', 'o-nas', 'sluzby', 'kontakt'
  title text not null,
  seo_title text, seo_description text,
  status text not null default 'published' check (status in ('draft','published','archived')),
  sort_order int not null default 0,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (project_id, slug)
);

-- Definice editovatelného pole (schema, ne hodnota)
create table webdo24_content_fields (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references webdo24_projects(id) on delete cascade,
  customer_id uuid not null references webdo24_customers(id),
  page_id uuid references webdo24_pages(id) on delete cascade,  -- null = globální
  field_key text not null,             -- 'homepage.hero.title', 'company.phone'
  section_key text,                    -- 'hero', 'services', 'footer'
  field_type text not null check (field_type in
    ('text','textarea','rich_text','number','boolean','url','email','phone',
     'image','gallery','logo','video','file','color','select','repeater','cta')),
  label text not null,                 -- 'Hlavní nadpis' (česky, pro UI)
  validation jsonb default '{}',       -- {max_length, pattern, required, options[]}
  sort_order int not null default 0,
  schema_version int not null default 1,
  unique (project_id, field_key)
);

-- Hodnoty: published vs draft. Historie přes publications + site_versions.
create table webdo24_content_values (
  field_id uuid primary key references webdo24_content_fields(id) on delete cascade,
  published_value jsonb,               -- to, co je na webu
  published_at timestamptz,
  updated_at timestamptz default now()
  -- draft_value NENÍ tady — draft žije výhradně v changeset_items,
  -- čímž je vynucená jediná cesta do produkce (§22)
);
```

Identifikátory polí dle §2 master promptu: `homepage.hero.title`, `homepage.services.heading`, `company.phone`, `branding.primary_logo` apod. Renderer i editor adresují pole přes `field_key` + `data-content-id` v HTML.

### 3.3 Globální profily

```sql
create table webdo24_company_profiles (   -- §11: jediný zdroj kontaktů
  project_id uuid primary key references webdo24_projects(id) on delete cascade,
  customer_id uuid not null references webdo24_customers(id),
  company_name text, ico text, dic text,
  street text, city text, postal_code text, country text default 'Česká republika',
  email text, phone text, secondary_phone text,
  facebook text, instagram text, linkedin text, youtube text,
  opening_hours jsonb,                   -- {po: "8:00–17:00", ...}
  google_maps_url text,
  updated_at timestamptz default now()
);

create table webdo24_brand_profiles (     -- §10: centrální branding
  project_id uuid primary key references webdo24_projects(id) on delete cascade,
  customer_id uuid not null references webdo24_customers(id),
  logo_asset_id uuid,                    -- → media_assets (hlavní logo)
  logo_light_asset_id uuid,
  logo_dark_asset_id uuid,
  favicon_asset_id uuid,
  icon_asset_id uuid,
  primary_color text, secondary_color text,
  updated_at timestamptz default now()
);
```

Změna telefonu = jedna ChangeItem na `company.phone` → renderer všude čte centrální hodnotu (Acceptance TEST C).

### 3.4 ChangeSet engine

```sql
create table webdo24_changesets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references webdo24_projects(id) on delete cascade,
  customer_id uuid not null references webdo24_customers(id),
  title text not null,                   -- 'Aktualizace homepage — srpen 2026'
  status text not null default 'draft' check (status in
    ('draft','validated','preview_ready','approved',
     'publishing','published','publish_failed','cancelled')),
  source text not null default 'gui' check (source in ('gui','ai','webdo24','api')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table webdo24_changeset_items (
  id uuid primary key default gen_random_uuid(),
  changeset_id uuid not null references webdo24_changesets(id) on delete cascade,
  field_id uuid not null references webdo24_content_fields(id),
  old_value jsonb,                       -- snapshot published_value při vytvoření
  new_value jsonb not null,              -- draft hodnota
  item_type text not null default 'content' check (item_type in
    ('content','media','branding','company','seo','page')),
  created_at timestamptz default now(),
  unique (changeset_id, field_id)
);

create table webdo24_publications (      -- §6: auditní záznam publikace
  id uuid primary key default gen_random_uuid(),
  changeset_id uuid not null references webdo24_changesets(id),
  project_id uuid not null references webdo24_projects(id),
  customer_id uuid not null references webdo24_customers(id),
  site_version_id uuid references webdo24_site_versions(id),
  published_by uuid references auth.users(id),
  items_snapshot jsonb not null,         -- [{field_key, old, new}]
  verification jsonb,                    -- výsledek post-publish checku
  status text not null check (status in ('published','failed','rolled_back')),
  is_rollback_of uuid references webdo24_publications(id),
  created_at timestamptz default now()
);
```

Stavový automat (§4): `draft → validated → preview_ready → approved → publishing → published`, chyba → `publish_failed` (s retry/rollback). Rollback = **nový** ChangeSet s prohozenými old/new (§7 — historie se nikdy nemaže).

### 3.5 Media Library (§8, §9)

```sql
create table webdo24_media_assets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references webdo24_customers(id),
  project_id uuid not null references webdo24_projects(id) on delete cascade,
  category text not null default 'photo' check (category in
    ('photo','logo','gallery','product','document','video')),
  filename text not null,
  mime_type text not null,
  storage_path text not null,            -- {customer_id}/{project_id}/{asset_id}/{filename}
  original_url text not null,
  optimized_url text, thumbnail_url text,
  width int, height int, file_size int,
  alt_text text,
  source text not null default 'upload' check (source in ('upload','ai','stock')),
  parent_asset_id uuid references webdo24_media_assets(id),  -- verzování (§8)
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
```

- **Verzování:** výměna obrázku vytvoří nový asset s `parent_asset_id`; původní se nikdy nepřepisuje (TEST B/6).
- **Usage (§9):** odvozeno z `content_fields` typu image/gallery/logo — dotaz „kde je asset použitý“ = join přes `content_values.published_value->>'asset_id'` + `changeset_items` (draft použití). Index: `create index on webdo24_content_values ((published_value->>'asset_id')) where published_value ? 'asset_id';`
- **Varianty:** optimalizace (WebP, thumbnail) přes Supabase Image Transformations; V1 bez cropu (crop UI v Phase 3+).
- Storage cesty `{customer_id}/{project_id}/...` + Storage RLS per customer (náprava dnešního sdíleného bucketu).

### 3.6 Služby a notifikace

```sql
create table webdo24_customer_services (  -- §18: Moje služby
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references webdo24_customers(id),
  product_id uuid not null references webdo24_products(id),
  status text not null default 'active' check (status in
    ('active','trialing','past_due','cancelled','available')),  -- available = upsell
  price_cents int, next_billing_at timestamptz,
  stripe_subscription_id text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (customer_id, product_id)
);

create table webdo24_notifications (      -- §37: notification center
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references webdo24_customers(id),
  user_id uuid references auth.users(id),
  type text not null,                    -- 'published','publish_failed','request_done','new_lead','billing'
  title text not null, body text,
  link text, read_at timestamptz,
  created_at timestamptz default now()
);
```

### 3.7 Memberships a role (§24, §25)

```sql
create table webdo24_customer_memberships (
  customer_id uuid not null references webdo24_customers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in
    ('owner','admin','editor','viewer')),  -- webdo24 role zůstávají v user_metadata
  invited_by uuid references auth.users(id),
  created_at timestamptz default now(),
  primary key (customer_id, user_id)
);
```

RBAC matrix (vynuceno serverově v `src/lib/ccc/guard.ts`, ne v UI):

| Akce | OWNER | ADMIN | EDITOR | VIEWER | WEBDO24_* |
|---|---|---|---|---|---|
| Vytvářet ChangeSety | ✓ | ✓ | ✓ | — | ✓ |
| Nahrávat média | ✓ | ✓ | ✓ | — | ✓ |
| Publikovat | ✓ | ✓ | — | — | ✓ |
| Rollback | ✓ | ✓ | — | — | ✓ |
| Spravovat uživatele/služby | ✓ | — | — | — | ✓ (admin) |

V1 migrace: pro každého existujícího zákazníka vytvořit membership `owner` z `customers.user_id`.

---

## 4. WebDo24 Website Contract v1 (§32, §33)

Každý zákaznický web musí splňovat kontrakt, aby byl řiditelný z Control Center. Kontrakt definuje **význam obsahu, nikoliv design**.

```jsonc
{
  "webdo24_schema_version": 1,
  "globals": {
    "company":   "webdo24_company_profiles → company.* field_keys",
    "branding":  "webdo24_brand_profiles → branding.* field_keys",
    "navigation": "pages[published] ordered by sort_order",
    "seo":        "pages.seo_title / seo_description + projekt-level defaults",
    "social":     "company.social.*"
  },
  "pages": {
    "home": {
      "sections": {
        "hero":     ["eyebrow","title","subtitle","primary_button_label","primary_button_url","hero_image"],
        "services": ["heading","description","items[] (repeater: title,description,price,image)"],
        "benefits": ["heading","items[]"],
        "references":["heading","items[]"],
        "faq":      ["heading","items[]"],
        "cta":      ["title","subtitle","button_label","button_url"]
      }
    },
    "o-nas":   { "sections": { "...": "..." } },
    "sluzby":  { "sections": { "...": "..." } },
    "kontakt": { "sections": { "...": "..." } }
  }
}
```

Pravidla:

1. **Sémantické klíče** (§33): `services.items[0].title` ✓, `blue_box_1_text` ✗. Design rozhoduje template webu.
2. **Editable binding (§30):** renderer obalí editovatelné místo `data-content-id="homepage.hero.title"` (+ `data-content-type`). To je stabilní spojení DOM ↔ `content_fields.field_key` pro budoucí inline editing; v V1 ho využívá preview overlay (zobrazení „co se změní“ přímo na stránce).
3. **Globální objekty** se nikdy neduplikují do stránek — telefon/logo/adresa se renderují výhradně z `company.*` / `branding.*`.
4. **Preview mechanismus (§6):** renderer akceptuje `?__wd24_preview=<token>` a `?__wd24_cs=<changeset_id>`; ověří signed token a překryje published hodnoty draft hodnotami z ChangeSetu.
5. **Version compatibility:** každý web/šablona deklaruje `webdo24_schema_version`; Control Center umí webu nabídnout jen operace, které jeho verze podporuje.
6. **Lead contract:** formuláře posílají na stávající `POST /api/leads/create` (beze změny).

TypeScript kontrakt: `src/types/website-contract.ts` (nový, sjednotí dnešní rozkolisené `SiteSnapshot` v `types/index.ts` a `SiteConfig` v `types/site-config.ts` → oba deprecatovat ve prospěch jednoho `WebsiteContract` typu).

---

## 5. Publishing workflow (§6, §34, §35, §36)

### 5.1 Rozhodnutí: runtime content (varianta A) s hybridem

- **Obsahové změny (text, média, kontakty, branding, SEO):** runtime — `content_values.published_value` se atomicky přepíše v jedné transakci spolu s vytvořením `publications` záznamu, nové `site_versions` (status `live`) a audit logu. Viditelnost: okamžitá (stránka je `force-dynamic`) + `revalidatePath('/{slug}')` pro jistotu cache.
- **Strukturální změny (nová stránka, nová sekce, změna šablony):** přes stávající AI/n8n change-request pipeline → nová `site_versions` s jiným snapshotem/šablonou → stejný approve/publish mechanismus. To je hybrid: „build“ = vytvoření nové verze snapshotu, ne rebuild aplikace.
- **Trade-offy:** runtime čtení z DB přidává ~1 dotaz navíc na request (řešitelné cache s tag-invalidací později); odpadá celá deploy infrastruktura, atomicita a okamžitý rollback jsou zdarma. Pro weby s traffic řádu stovek–tisíců návštěv/den (realita WebDo24 klientů) je to správná volba. Build-time export zůstává otevřený jako Phase 6+ pro per-customer statické weby — Contract je na to připraven (published snapshot je serializovatelný).

### 5.2 Publish transakce (`src/lib/ccc/publish.ts`)

```
BEGIN
  1. guard: role může publikovat, changeset.status = 'approved'
  2. lock changeset (SELECT ... FOR UPDATE)
  3. pro každý item:
     - re-validace new_value proti content_fields.validation
     - UPDATE content_values SET published_value = new_value
       (company/branding itemy → update profilových tabulek)
  4. INSERT site_versions (snapshot published stavu, status 'live',
     parent = předchozí live; stará live → 'archived')
  5. UPDATE projects.current_version_id
  6. INSERT publications (items_snapshot: field_key, old, new)
  7. UPDATE changesets SET status = 'publishing'
  8. INSERT audit_log ('WEBSITE_PUBLISHED', diff)
COMMIT
→ revalidatePath('/{slug}'), revalidatePath('/')
→ post-publish verification (5.3)
→ changeset 'published' | 'publish_failed'; notifikace zákazníkovi
```

### 5.3 Post-publish verification (§36)

Po commitu (mimo transakci): server-side fetch `https://web.webdo24.cz/{slug}?__wd24_health=1`:

1. HTTP 200 a stránka dostupná,
2. stránka obsahuje `data-content-version` = nové `site_version_id` (renderer vypisuje do `<meta>`),
3. pro média: HEAD na `optimized_url` nového assetu = 200.

Výsledek do `publications.verification`. Teprve poté `PUBLISHED`. Při selhání → `PUBLISH_FAILED` + notifikace + nabídka retry/rollback. Nikdy „200 z API = publikováno“.

### 5.4 Rollback (§7)

`POST /api/v1/publications/{id}/rollback` → vytvoří nový ChangeSet (source `gui`, title „Vrácení změny z {datum}“) s old/new prohozenými, automaticky ho protlačí approve→publish (rollback je privilegovaná operace, ale **stále projde stejnou trasou** a vytvoří novou verzi — historie se nemaže). UI: Historie změn → [Vrátit změnu].

---

## 6. Preview workflow (§5)

1. `POST /api/v1/changesets/{id}/preview`:
   - validace všech itemů → status `validated`,
   - vygeneruje signed token: HMAC(changeset_id + project_id + expiry 24h, `PREVIEW_TOKEN_SECRET`),
   - uloží expiry, status → `preview_ready`,
   - vrátí `preview_url = https://web.webdo24.cz/{slug}?__wd24_cs={id}&__wd24_preview={token}`.
2. Renderer `src/app/[slug]/page.tsx`: pokud query obsahuje token → server-side ověření HMAC + expiry + status changesetu → načte draft hodnoty z `changeset_items` a **překryje** published při renderu. Přidá nevýrazný preview bar („Náhled nepublikovaných změn — [Publikovat] [Zahodit]“ viditelný jen v tomto režimu).
3. Responsivní náhled (§5): preview iframe v dashboardu s přepínačem desktop/tablet/mobile (šířky 1280/768/390) — žádná device emulace, jen viewport šířka.
4. Žádné externí n8n preview URL pro content změny; n8n preview zůstává jen pro strukturální pipeline verze.

---

## 7. Media architecture

- **Upload:** `POST /api/v1/media` (multipart) → MIME whitelist (`image/jpeg|png|webp|svg`, `application/pdf`; video Phase 5+), limit 10 MB, server-side validace (magic bytes, ne jen Content-Type), sanitizace filename → Storage `{customer_id}/{project_id}/{asset_id}/original.ext`.
- **Varianty:** Supabase Image Transformations (`?width=…&format=webp`) — `optimized_url`/`thumbnail_url` jako transform URL, žádné předgenerování v V1.
- **Výměna v poli:** nahraje asset → ChangeItem typu `media` na `field_id` (new_value `{asset_id, url, alt}`) → preview → publish přepíše odkaz; původní asset zůstává (parent řetězec).
- **Logo (§10):** sekce „Vzhled značky“ edituje `webdo24_brand_profiles`; doporučení SVG/PNG/WebP; preview hlavičky/patičky/mobilu = preview token na `/`, `/kontakt` + mobile viewport; renderer čte logo výhradně z `branding.*`.
- **Storage RLS:** nové policies — čtení veřejné jen pro assety publikované na živém webu (V1 pragmaticky: bucket veřejný read jako dnes, ale cesty scoped per customer/project a zápis jen owner/admin role; plné signed-read v Phase 6).

---

## 8. Bezpečnost (§38)

1. **Auth:** Supabase Auth (beze změny) + zapojit `src/lib/supabase/middleware.ts` jako root `middleware.ts` (session refresh + host routing později). Uzavřít TODO z discovery.
2. **Tenant isolation:** všechny nové tabulky mají `customer_id` + RLS:
   ```sql
   create policy customer_read on webdo24_content_fields for select
     using (is_admin() or customer_id in
       (select customer_id from webdo24_customer_memberships
        where user_id = auth.uid()));
   ```
   Mutace protected tabulek (content_values, publications) pouze přes service role v doménových službách — stejný vzor jako dnes u `site_versions`.
3. **RBAC:** `src/lib/ccc/guard.ts` — `requireCapability(userId, customerId, 'publish'|'edit'|'manage')`, voláno na vstupu každé akce. Role z memberships; `webdo24_admin/support` z user_metadata.
4. **Rate limiting:** upload/preview/publish endpointy — Upstash Ratelimit (doporučení už v `docs/admin-implementation.md`) nebo jednoduchý DB token-bucket v V1.
5. **Upload:** viz §7 (whitelist, magic bytes, 10 MB, žádné SVG s `<script>` — SVG sanitizace nebo blokovat SVG v V1).
6. **Preview tokeny:** HMAC signed, 24h expiry, single-purpose; žádné deployment secrets klientovi.
7. **Audit:** `webdo24_audit_log` — rozšířit akce o `CONTENT_EDITED`, `MEDIA_UPLOADED`, `CHANGESET_CREATED/APPROVED`, `WEBSITE_PUBLISHED`, `ROLLBACK`, `SERVICE_CHANGED`, `USER_INVITED`, `AI_CONTENT_GENERATED`, `AI_ACTION_ACCEPTED` (§26). Každý záznam: actor, tenant, entity, diff, ip, user_agent.
8. **CSRF/XSS:** server actions (SameSite cookies) + sanitizace rich_text vstupů (DOMPurify server-side) + CSP na rendereru (už částečně v Caddyfile pro `web.`).
9. **Schema drift cleanup:** doplnit migraci pro `stripe_customer_id`, `subscription_status`, `current_period_end`, `zone_id` a RLS pro `webdo24_hosting_subscriptions` (součást sql/011).

---

## 9. API (§31)

API-first: doménové služby → server actions (dashboard) + route handlers (externí klienti, AI, n8n). Prefix `/api/v1/` pro nové, stávající endpointy zůstávají.

```
GET    /api/v1/websites/{projectId}                    stav webu (ONLINE, ssl, last_publish)
GET    /api/v1/websites/{projectId}/pages
GET    /api/v1/pages/{pageId}/content                  registry pole + published hodnoty
POST   /api/v1/changesets                              {title, items:[{field_key, new_value}]}
GET    /api/v1/changesets/{id}                         vč. diffu (§16)
POST   /api/v1/changesets/{id}/validate
POST   /api/v1/changesets/{id}/preview                 → preview_url
POST   /api/v1/changesets/{id}/approve
POST   /api/v1/changesets/{id}/publish
POST   /api/v1/publications/{id}/rollback
GET    /api/v1/publications?projectId=                 historie změn
POST   /api/v1/media                                   upload (multipart)
GET    /api/v1/media?projectId=&category=
GET    /api/v1/media/{id}/usage                        kde je asset použitý
GET    /api/v1/company-profile / PATCH (→ vytvoří ChangeSet!)
GET    /api/v1/brand-profile  / PATCH (→ ChangeSet)
GET    /api/v1/services                                katalog + stavy (Moje služby)
POST   /api/v1/customer-services/{id}/upgrade          → Stripe checkout (reuse)
GET    /api/v1/leads (existuje jako akce; doplnit HTTP)
POST   /api/v1/customer-requests                       = stávající change_requests + attachments
GET    /api/v1/notifications / POST .../read
```

Důležité: i „jednoduché“ operace (PATCH company profile) **interně vytvářejí ChangeSet** — jediná cesta (§22). AI vrstva (§13, §21) volá stejné endpointy; její výstup je jen návrh `new_value` + diff UI („Původní | Navrhovaný“ → Použít návrh → DRAFT).

---

## 10. Implementační fáze

| Fáze | Obsah | Výstup / test |
|---|---|---|
| **0 — Discovery** ✓ | tento dokument | schválená architektura |
| **1 — Core domain** | sql/011 (tabulky §3, RLS, drift cleanup), `src/types/website-contract.ts`, `src/lib/ccc/{guard,registry,changesets}.ts`, memberships seed, fix route `(app/)/sluzby` | migrace projde na lokálním Supabase; typy kompilují |
| **2 — Content API** | `src/lib/ccc/{publish,preview,media}.ts`, route handlers §9, validace zod, post-publish verification, rollback | API testy: draft→preview→publish→rollback na seed projektu |
| **3 — Customer Dashboard** | nové sekce `(app)`: Obsah (editor nad Registry), Média, Vzhled značky, Kontaktní údaje, Historie změn, Přehled (stav služby dle §17), Notifikace; sjednocení tématu; konsolidace `/customer/*` → redirect | ruční průchod GUI |
| **4 — Website Contract** | přepis `[slug]` rendereru na Registry + Contract + `data-content-id` + preview token + health check; migrace obsahu `website_content` → Registry | **Acceptance TEST A–E (§41)** na demo webu `truhlarstvi-drevorez` |
| **5 — AI** | ✨ Upravit pomocí AI (diff UI), AI obrázky → Media Library, chat interface (§21) → ChangeSet | AI návrh nikdy nepublikuje sám |
| **6 — Services** | Moje služby plně, Marketplace (§19) nad `products`, CustomerRequest attachments, custom domains routing (Caddy wildcard + middleware), build-time export varianta | E2E upgrade flow |

---

## 11. Soubory a moduly (vytvořit / změnit)

**Nové:**

```
sql/011_customer_control_center.sql
supabase/migrations/<ts>_customer_control_center.sql
src/types/website-contract.ts
src/lib/ccc/guard.ts            — RBAC + tenant guard
src/lib/ccc/registry.ts         — čtení/zápis Registry, field_key adresace
src/lib/ccc/changesets.ts       — CRUD, validate, diff builder
src/lib/ccc/preview.ts          — HMAC tokeny, preview overlay data
src/lib/ccc/publish.ts          — publish transakce + verification + rollback
src/lib/ccc/media.ts            — upload, varianty, usage
src/lib/ccc/notifications.ts
src/app/api/v1/...              — route handlers dle §9
src/components/ccc/             — ContentEditor, MediaLibrary, DiffView,
                                  PreviewFrame (desktop/tablet/mobile),
                                  ChangeHistory, BrandingForm, CompanyForm
src/middleware.ts               — zapojit supabase/middleware.ts
```

**Změněné:**

```
src/app/[slug]/page.tsx         — renderer nad Registry + Contract + preview
src/app/(app)/web/editor/       — přepnutí z web.ts na ccc akce
src/lib/actions/web.ts          — deprecate → proxy na ccc/registry (během Phase 3)
src/components/app/AppLayout.tsx — navigace dle §28
sql/ + supabase/migrations/     — sjednocení zdroje pravdy (doplnit chybějící)
caddy/Caddyfile                 — fix port 3002→3001 (ověřit na VPS!)
```

**K odstranění / redirect (Phase 3):** `src/app/customer/*` (→ `(app)`), `src/app/master`, `DashboardView.tsx`, `EmailRoutingView.tsx`, `AuthGuard.tsx`, přejmenovat `src/app/(app/)/` → `src/app/(app)/sluzby/`.

---

## 12. Migrační strategie existujících webů

1. **Sql/011** vytvoří nové tabulky; existující data se nemigrují destruktivně — `website_content` zůstává read-only fallback.
2. **Migrační skript** `scripts/migrate-content-to-registry.ts`:
   - pro každý projekt vytvoří `webdo24_pages` (home, o-nas, sluzby, kontakt dle šablony),
   - zmapuje `website_content.section_key` → `field_key` dle mapping tabulky (`hero_title → homepage.hero.title`, `phone → company.phone`, …),
   - přenese `services`/`testimonials` → repeater hodnoty,
   - vytvoří `company_profiles` z projektových kontaktů, `brand_profiles` defaults,
   - vytvoří memberships (owner),
   - vše idempotentní (rerun-safe), dry-run mód.
3. **Renderer** v Phase 4 čte Registry; pokud projekt nemá Registry záznamy → fallback na `website_content` (postupná migrace, žádný big bang).
4. **První migrovaný web:** demo `truhlarstvi-drevorez` → na něm Acceptance TEST A–E, teprve potom ostatní projekty.
5. **Závěrečná deprecace** `website_content` až po úspěšné migraci všech projektů (Phase 6).

---

## Příloha A — Kontrolní otázky (§43) a jak jim architektura odpovídá

1. *1 zákazník?* — V1 cílí přesně na něj (1:1 project↔website, memberships s jedním ownerem).
2. *1 000 zákazníků?* — tenant scoping všude, indexy na `customer_id`/`project_id`, runtime model škáluje se Supabase; storage cesty per customer.
3. *Ovladatelné GUI?* — Phase 3 dashboard; žádné technické pojmy (žádný Git/deploy/JSON v UI).
4. *Spustitelné AI agentem?* — AI volá stejné `/api/v1` endpointy; její výstup = ChangeSet source `ai`.
5. *Audit?* — `publications` + `audit_log` povinně v každé publish transakci.
6. *Rollback?* — nová verze přes stejnou trasu, historie se nemaže.
7. *Nemůže zákazník rozbít produkci?* — edituje jen validovaná pole Registry; žádný HTML/layout; publish až po preview; verification + rollback.
8. *Složitost skrytá?* — UI mluví o „nadpisu, fotce, telefonu“; ChangeSet/version/deploy zůstávají interní.
