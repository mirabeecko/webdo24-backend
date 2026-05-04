# Webdo24 Backend

Kompletní backend a administrační systém pro Webdo24.cz - službu pro tvorbu webů do 24 hodin pomocí AI pipeline.

## Funkce

- **Autentizace**: Přihlášení a registrace přes Supabase Auth s rolemi admin/customer
- **Správa zákazníků**: Evidence zákazníků s kontaktními údaji
- **Správa projektů**: Vytváření, sledování stavu a správa webových projektů
- **Zadání projektu**: Detailní formulář pro zadání požadavků na web
- **Soubory**: Nahrávání loga, fotek a dokumentů přes Supabase Storage
- **Pipeline integrace**: Spouštění AI pipeline přes n8n webhooky
- **QA kontrola**: Automatizovaná kontrola kvality
- **Deploy**: Nasazení webu na produkci
- **Admin dashboard**: Přehledné rozhraní pro správu všech projektů, zákazníků a faktur
- **Fakturace**: Vytváření a správa faktur s označováním jako zaplacené
- **Zákaznický portál**: Prostor pro zákazníky ke správě svých projektů
- **Toast notifikace**: Přehledné zpětné vazby při akcích
- **Pipeline detail**: Modal s JSON input/output pro debugování AI pipeline

## Technologie

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS
- Supabase (databáze, auth, storage)
- n8n webhooky pro AI pipeline
- Caddy reverse proxy

## Instalace

```bash
npm install
```

## Konfigurace

1. Zkopíruj `.env.example` do `.env.local`:
```bash
cp .env.example .env.local
```

2. Vyplň všechny proměnné prostředí:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
N8N_PIPELINE_WEBHOOK_URL=https://your-n8n-instance/webhook/pipeline
N8N_QA_WEBHOOK_URL=https://your-n8n-instance/webhook/qa
APP_URL=https://webdo24.cz
ADMIN_EMAIL=admin@webdo24.cz
```

## Supabase nastavení

### 1. Vytvoření projektu

- Jdi na [Supabase Dashboard](https://supabase.com/dashboard)
- Vytvoř nový projekt
- Zkopíruj URL a API klíče do `.env.local`

### 2. SQL migrace

Otevři SQL Editor v Supabase Dashboard a spusť obsah souboru `sql/001_initial_schema.sql`.

Tím se vytvoří všechny tabulky s prefixem `webdo24_`:
- `webdo24_customers`
- `webdo24_projects`
- `webdo24_project_briefs`
- `webdo24_project_files`
- `webdo24_pipeline_runs`
- `webdo24_project_events`
- `webdo24_invoices`

### 3. Storage bucket

Vytvoř bucket `webdo24-files` v Storage sekci s veřejným přístupem pro čtení.

### 4. RLS politiky

RLS politiky jsou součástí SQL migrace. Ověř, že jsou aktivní v Table Editor → jednotlivé tabulky → Policies.

## Vývoj

```bash
npm run dev
```

Aplikace běží na `http://localhost:3001`.

## Testovací data

```bash
npm run seed
```

Vytvoří:
- 1 admin uživatele (`admin@webdo24.cz` / `Admin123!`)
- 1 zákazníka (`customer@webdo24.cz` / `Customer123!`)
- 2 projekty
- 1 pipeline run

## Build a produkce

```bash
npm run build
npm start
```

Pro standalone build:
```bash
npm run build
# Výstup je v .next/standalone/
```

### PM2 (doporučeno)

```bash
# Vytvoř složku pro logy
mkdir -p logs

# První spuštění
npm run pm2:start

# Správa
npm run pm2:restart
npm run pm2:stop
npm run pm2:logs
```

## Nasazení na VPS s Caddy

### 1. Přenos souborů na VPS

```bash
rsync -avz --exclude node_modules --exclude .next ./ user@vps:/var/www/webdo24-backend/
```

### 2. Instalace závislostí a build na VPS

```bash
cd /var/www/webdo24-backend
npm install
npm run build
```

### 3. Caddy konfigurace

Zkopíruj `caddy/Caddyfile` do `/etc/caddy/Caddyfile` nebo `/etc/caddy/conf.d/webdo24.cz`:

```caddyfile
webdo24.cz {
    reverse_proxy localhost:3001
    encode gzip zstd
    tls admin@webdo24.cz
}
```

Restartuj Caddy:
```bash
sudo systemctl reload caddy
```

### 4. Systemd služba (volitelné)

Vytvoř `/etc/systemd/system/webdo24.service`:

```ini
[Unit]
Description=Webdo24 Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/webdo24-backend
ExecStart=/usr/bin/node /var/www/webdo24-backend/.next/standalone/server.js
Restart=on-failure
Environment=NODE_ENV=production
EnvironmentFile=/var/www/webdo24-backend/.env.local

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable webdo24
sudo systemctl start webdo24
```

## n8n integrace

### Pipeline webhook

Endpoint: `POST /api/pipeline/run`

Odesílá na `N8N_PIPELINE_WEBHOOK_URL` JSON:
```json
{
  "project_id": "uuid",
  "pipeline_run_id": "uuid",
  "pipeline_type": "A|B|C",
  "data": { "project": {}, "brief": {}, "files": [] },
  "callback_url": "https://webdo24.cz/api/pipeline/callback"
}
```

### Callback

n8n musí odpovědět na `POST /api/pipeline/callback`:
```json
{
  "project_id": "uuid",
  "pipeline_run_id": "uuid",
  "status": "success|failed",
  "output_json": {},
  "preview_url": "https://...",
  "error_message": "..."
}
```

### QA webhook

Endpoint: `POST /api/qa/run`

Odesílá na `N8N_QA_WEBHOOK_URL` JSON:
```json
{
  "project_id": "uuid",
  "preview_url": "https://...",
  "brief": {},
  "project": {},
  "callback_url": "https://webdo24.cz/api/pipeline/callback"
}
```

## Struktura projektu

```
webdo24-backend/
├── src/
│   ├── app/
│   │   ├── admin/           # Admin rozhraní
│   │   ├── customer/        # Zákaznický portál
│   │   ├── api/             # API endpointy
│   │   ├── login/           # Přihlášení
│   │   └── register/        # Registrace
│   ├── components/
│   │   ├── admin/           # Admin komponenty
│   │   ├── auth/            # Auth guard
│   │   ├── customer/        # Customer komponenty
│   │   └── ui/              # UI komponenty (Toast, Dialog)
│   ├── lib/
│   │   ├── supabase/        # Supabase klienti
│   │   ├── auth.ts          # Autentizační utility
│   │   └── utils.ts         # Pomocné funkce
│   └── types/
│       └── index.ts         # TypeScript definice
├── sql/
│   └── 001_initial_schema.sql
├── scripts/
│   └── seed.ts
├── pm2/
│   └── ecosystem.config.js
├── systemd/
│   └── webdo24.service
├── caddy/
│   └── Caddyfile
└── .env.example
```

## Bezpečnost

- RLS politiky na všech tabulkách
- Customer vidí jen svoje projekty (ověřeno přes customer_id → user_id)
- Admin vidí všechno
- API endpointy kontrolují autentizaci a role
- Supabase Storage ověřuje vlastnictví projektu před uploadem

## Co zbývá pro produkci

- [ ] Nastavit reálné n8n webhooky a ověřit callbacky
- [ ] Implementovat reálný deploy proces (FTP, SSH, Vercel, Netlify)
- [ ] Přidat emailové notifikace (např. přes Resend/Supabase Edge Functions)
- [ ] Přidat platební bránu (GoPay, Stripe, Braintree)
- [x] Základní správa faktur (TODO: platební brána, PDF export)
- [ ] Přidat notifikace v reálném čase (WebSockets / Supabase Realtime)
- [ ] Vylepšit validaci formulářů (Zod + React Hook Form)
- [ ] Přidat testy (Jest, Playwright)
- [ ] Přidat rate limiting na API
- [ ] Přidat audit log pro admin akce
- [ ] Implementovat vícejazyčnost admin rozhraní
- [ ] Přidat dark mode
- [ ] Nastavit CI/CD pipeline
- [ ] Monitoring a logování (Sentry, LogRocket)

## Licence

Proprietární - Webdo24.cz
