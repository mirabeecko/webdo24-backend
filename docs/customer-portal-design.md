# WebDo24 — Zákaznický portál (do24.cz): Návrh UX a implementace

Verze: 1.0 · 2026-08-10
Status: návrh k implementaci — čeká na OWNER approval
Rozsah: čistě zákaznický pohled („kde je můj web a co mám dělat"), nikoli CMS/studio

> Tento dokument doplňuje `WEBDO24_CUSTOMER_CONTROL_CENTER_ARCHITECTURE.md` (content
> vrstva, ChangeSet, publikování). Portál je vrstva A (Customer Dashboard) v uživatelsky
> čisté, mobilní-first podobě: zákazník sleduje **svůj projekt** (6 fází) a komunikuje
> s týmem. Neřeší editaci obsahu webu — to zůstává ve studiu `(app)`.

---

## 0. Princip (TL;DR)

Zákazník si portál nečte — portál mu odpovídá na 4 otázky:

1. **V jaké fázi je můj web?** → progress bar 6 fází, vždy viditelný
2. **Co se právě děje?** → status text lidsky + ETA + timeline
3. **Co ode mě potřebujete?** → checklist „Co od tebe potřebujeme" + badge „čeká na tebe"
4. **Co mám udělat teď?** → přesně jedno velké primární tlačítko

Vše ostatní (zprávy, dokumenty, profil) je sekundární a vizuálně potlačené.
Jediná obrazovka, která rozhoduje o úspěchu portálu, je **Detail projektu** — vše
ostatní se navrhuje kolem ní.

---

## 1. Information Architecture

### 1.1 Mapa stránek (route group `(portal)`)

```
src/app/(portal)/
  layout.tsx                      ← auth guard + navigace + badge nepřečtených
  page.tsx                        ← /  DASHBOARD (seznam projektů)
  projekt/[id]/page.tsx           ← /projekt/[id]  DETAIL PROJEKTU (jádro)
  projekt/[id]/podklady/page.tsx  ← /projekt/[id]/podklady  UPLOAD + CHECKLIST
  projekt/[id]/preview/page.tsx   ← /projekt/[id]/preview    NÁHLED + FEEDBACK
  projekt/[id]/predani/page.tsx   ← /projekt/[id]/predani    PŘEDÁNÍ + UPSEL
  zpravy/page.tsx                 ← /zpravy   vlákna komunikace
  zpravy/[threadId]/page.tsx      ← /zpravy/[id]  detail vlákna
  dokumenty/page.tsx              ← /dokumenty  faktury, smlouva, návody
  profil/page.tsx                 ← /profil   kontakty, fakturace, notifikace
```

Mobilní cesty zůstávají stejné (žádné m.[domain] — responsivní jedna aplikace).

### 1.2 Navigace

**Desktop (top bar, vždy viditelný):**
`Logo do24 · Moje projekty · Zprávy (badge) · Dokumenty · Profil · Odhlásit`

**Mobil (bottom tab bar, vždy viditelný):**
`Projekty · Zprávy (badge) · Dokumenty · Profil` — 4 položky max, palec dosáhne.
Logo zůstává nahoře jako úzká hlavička (jen název projektu na detailu).

- Badge nepřečtených = COUNT z `webdo24_notifications WHERE read_at IS NULL` (tabulka
  už existuje — jen doplnit `notification_type` pro zprávy, viz §6).
- Aktivní položka zvýrazněná; focus states povinné (a11y).

### 1.3 Proč takhle

- **4 položky místo 6:** „Odhlásit" na mobilu patří do profilu, ne do tab baru.
- **Žádné „Nový projekt" v nav:** je to akce, ne sekce → patří na dashboard jako CTA.
- **Podklady/Preview/Předání nejsou v nav:** jsou to podstránky projektu, vždy
  přístupné z detailu. Navigace musí zůstat stabilní a krátká.

---

## 2. Detail projektu — `/projekt/[id]` (nejdůležitější obrazovka)

### 2.1 Wireframe (desktop 2/3 + 1/3; mobil = sloupec, postranní panel → „Detaily" sekce dole)

```
┌────────────────────────────────────────────────────────────────────────┐
│ [do24]  Moje projekty │ Zprávy(2) │ Dokumenty │ Profil │        [odhlásit] │
├───────────────────────────────────────────────────────┬──────────────────┤
│ ← Zpět na projekty                                    │                  │
│                                                       │  DETaily         │
│  Název projektu              [● Výroba]               │  ┌────────────┐  │
│                                                       │  │ Balíček    │  │
│  1●Objednáno → 2●Podklady → 3●Výroba → 4○Preview      │  │ Start      │  │
│  → 5○Úpravy → 6○Předáno                               │  │ Cena       │  │
│                                                       │  │ Platba     │  │
│  ┌─────────────────────────────────────────────────┐  │  └────────────┘  │
│  │ AKTUÁLNÍ STATUS                                │  │                  │
│  │ Právě vyrábíme tvůj web.                       │  │  KONTAKT         │
│  │ Odhad dokončení: dnes do 18:00                 │  │  ┌────────────┐  │
│  │ [eta pruh: zbývá ~4 h]                         │  │  │ Napsat zpr.│  │
│  └─────────────────────────────────────────────────┘  │  │ tel/email  │  │
│                                                       │  └────────────┘  │
│  ┌─────────────────────────────────────────────────┐  │                  │
│  │ CO OD TEBE POTŘEBUJEME   (2/4 hotovo)           │  │  DOKUMENTY      │
│  │ ☑ Logo                      ✓ nahráno           │  │  ┌────────────┐  │
│  │ ☑ Texty na stránky          ✓ nahráno           │  │  │ Faktura pdf│  │
│  │ ☐ Fotky                     [Nahrát]            │  │  │ Smlouva    │  │
│  │ ☐ Kontaktní údaje           [Doplnit]           │  │  └────────────┘  │
│  │ [ Nahrát chybějící podklady ]  ← primární CTA   │  └──────────────────┘
│  └─────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────┐
│  │ AKCE                                           │
│  │ [ Zobrazit preview ]   (sekundární, jen pokud)  │
│  │ [ Napsat zprávu ]      (sekundární)             │
│  └─────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────┐
│  │ TIMELINE                                       │
│  │ ● 10:42  Podklady přijaty — začínáme vyrábět    │
│  │ ● 09:15  Platba přijata (Stripe · 14 900 Kč)    │
│  │ ● 09:14  Objednávka vytvořena                   │
│  └─────────────────────────────────────────────────┘
```

### 2.2 Obsah shora dolů (pořadí = priorita, na mobilu beze změny)

| Blok | Obsah | Poznámka |
|---|---|---|
| Hlavička | název + status badge | badge barvou dle fáze |
| Progress bar | 6 fází, aktuální zvýrazněná, hotové zelené | vždy viditelný, i při scrollu na mobilu (sticky) |
| Aktuální status | lidský text + ETA + pruh „zbývá X h" | ETA jen u fází 3–5 |
| Co od tebe potřebujeme | checklist s progressem | jen pokud existují chybějící položky; jinak „Vše máme ✓" |
| Akce | 1 primární + max 2 sekundární | dle stavového automatu §5 |
| Timeline | obráceně chronologicky, max 20, „Zobrazit vše" | z audit_log + zpráv |
| Detaily (desktop sidebar / mobil dole) | balíček, cena, datum, kontakt, dokumenty | statická data, žádná akce |

### 2.3 Progress bar — specifikace

- 6 kroků: `Objednáno · Podklady · Výroba · Preview · Úpravy · Předáno`
- Stavy kroku: `hotový (zelený + ✓) · aktuální (modrý, pulsující tečka) · budoucí (šedý)`
- **„Úpravy" (5) se chová zvlášť:** u první iterace (fáze 1→4 poprvé) se nezobrazuje
  jako budoucí krok aktivně — zobrazí se až ve chvíli, kdy zákazník požádá o úpravy.
  Jinak zákazník vidí 6 kroků hned a „Úpravy" působí jako povinná zastávka.
  → Implementace: krok 5 dostane stav `skrytý/neaktivní` do prvního `needs_revision`.
- Čísla 1–6 se zobrazují (lepší orientace při sdílení screenshotu: „jsem ve fázi 3").
- Progress % na dashboard kartě = `(index aktuální fáze - 1) / 6 * 100` + 0 pro fázi 1,
  100 pro Předáno. (Neplést s % checklistu — to je jiná metrika.)

### 2.4 Status texty (lidsky, žádné IN_PROGRESS)

| Fáze | Status text | ETA |
|---|---|---|
| 1 Objednáno | „Objednávka přijata. Čekáme na potvrzení platby." | — |
| 2 Podklady | „Čekáme na tvé podklady." | — |
| 3 Výroba | „Právě vyrábíme tvůj web." | `eta` (dnes do HH:MM) |
| 4 Preview | „Web je hotový, mrkni na něj a dej vědět." | — |
| 5 Úpravy | „Zapracováváme tvé připomínky." | `eta` |
| 6 Předáno | „Web je tvůj. Vše najdeš v Předání." | — |

Všechny texty v `src/lib/portal/status-texts.ts` — jedna funkce `getPhase(projectStatus)`,
jeden zdroj pravdy pro celý portál (viz §5.1).

---

## 3. Podklady — `/projekt/[id]/podklady`

### 3.1 Wireframe (mobil)

```
┌──────────────────────────────────┐
│ ← Zpět na projekt                │
│ PODKLADY                         │
│ 3 ze 4 položek hotovo  [█████░░] │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ ☑ Logo               ✓ OK    │ │
│ │   logo.png · komentář: ...   │ │
│ │ ☑ Texty na stránky    ✓ OK   │ │
│ │ ☐ Fotky              [Nahrát]│ │
│ │ ☐ Kontaktní údaje    [Doplnit]│ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  ┌────────────────────────┐  │ │
│ │  │  Přetáhni sem soubory  │  │ │
│ │  │  nebo klepni pro výběr  │  │ │
│ │  └────────────────────────┘  │ │
│ │  (drag & drop + input file)  │ │
│ └──────────────────────────────┘ │
│                                  │
│ [ Odeslat podklady ]  ← primární │
│  „Vše hotovo? Pošli nám to a     │
│   začneme vyrábět."              │
└──────────────────────────────────┘
```

### 3.2 Checklist — zdroj položek a stavů

**Žádná nová tabulka.** Položky = statická definice v kódu
(`src/lib/portal/checklist.ts`), stav se odvozuje z existujících dat:

| Položka | Nahráno, když… | Zdroj |
|---|---|---|
| Logo | existuje `media_assets` category `logo` | `webdo24_media_assets` |
| Texty na stránky | `project_files` má .doc/.docx/.pdf/.txt NEBO brief obsahuje texty | `webdo24_project_files` |
| Fotky | ≥1 `media_assets` category `photo` | `webdo24_media_assets` |
| Kontaktní údaje | brief.contacts není prázdný | `webdo24_project_briefs` |
| (pokud balíček obsahuje) | reference, otevírací doba, ceník… | dle balíčku |

- Stav položky: `Čeká · Nahráno · Schváleno` („Schváleno" = WebDo24 je potvrdil,
  viz §3.4).
- Upload: stávající `POST /api/upload` + media pipeline (magic bytes, MIME whitelist,
  limit 10 MB) — **znovupoužít, nepsat nový**.
- Komentář k souboru: textové pole u každé nahrané položky → uložit do
  `webdo24_project_files.comment` (sloupec doplnit migrací, nebo `media_assets.alt_text`
  nezneužívat — lepší nový sloupec `note`).

### 3.3 „Odeslat podklady"

- Povoleno, jen když je checklist kompletní (jinak tlačítko disabled + tooltip
  „Chybí: Fotky, Kontaktní údaje").
- Akce = `PATCH /api/projects/[id]/update {status: 'waiting_for_materials' → 'ready_for_generation'}`,
  audit záznam `MATERIALS_SUBMITTED`, notifikace týmu (email), zákazníkovi potvrzení
  „Díky, podklady máme. Začínáme vyrábět." + změna fáze na Výroba.
- Po odeslání jsou položky checklistu zamčené (jen čtení + komentáře). Změna podkladů
  ve fázi Výroba = jen přes zprávu (s upozorněním, že to může posunout ETA).

### 3.4 Schválení podkladů týmem

Interní akce (admin UI, ne portál): tým označí položku „Schváleno" → zákazník vidí
zelený ✓ a klid. Pokud tým najde problém (špatný formát loga), napíše komentář →
položka se vrátí na „Čeká" + badge „čeká na tebe" + notifikace. Tím portál nahrazuje
email „poslali jste nám špatné logo".

---

## 4. Preview + Feedback — `/projekt/[id]/preview`

### 4.1 Wireframe (mobil)

```
┌──────────────────────────────────┐
│ ← Zpět na projekt                │
│ PREVIEW · verze 2                │
│                                  │
│ ┌──────────────────────────────┐ │
│ │   Náhled webu (iframe)       │ │
│ │   [web.webdo24.cz/slug]      │ │
│ │                              │ │
│ └──────────────────────────────┘ │
│ [ Otevřít v novém okně ]         │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ CO SI O TOM MYSLÍŠ?          │ │
│ │ ┌──────────────────────────┐ │ │
│ │ │ textarea: „Co změnit…"   │ │ │
│ │ └──────────────────────────┘ │ │
│ │ [📎 přiložit screenshot]     │ │
│ │                              │ │
│ │ [ Schválit web ]  (zelená)   │ │
│ │ [ Chci úpravy ]   (modrá)    │ │
│ └──────────────────────────────┘ │
│                                  │
│ HISTORIE VERZÍ                   │
│ ● v2 · dnes 11:20 · aktuální     │
│ ○ v1 · dnes 10:05 · [zobrazit]   │
└──────────────────────────────────┘
```

### 4.2 Mechanika

- **Preview:** existující renderer `web.webdo24.cz/{slug}` v iframe + odkaz
  „Otevřít v novém okně" (mobil). Pokud projekt používá preview token
  (signed token z CCC architektury §6), iframe dostane
  `?__wd24_cs=…&__wd24_preview=…` — nic nového, jen UI obal.
- **Verze preview:** číslování v1, v2… odvozené z `webdo24_site_versions`
  (každá nová verze po úpravách = další číslo). Historie = seznam verzí s datem,
  klik → otevře danou verzi (pokud verze existuje jako snapshot; jinak odkaz na
  aktuální preview s poznámkou „starší verze už není dostupná").
- **Feedback:** textarea (povinné jen u „Chci úpravy") + příloha screenshotu
  (upload přes stávající pipeline). Odeslání:
  - „Chci úpravy" → `POST /api/customer/projects/[id]/revision` (existuje!) +
    uložení textu feedbacku (nový endpoint `feedback` nebo rozšířit revision o body),
    status → `needs_revision`, notifikace týmu, zákazníkovi „Díky, zapracujeme."
  - „Schválit web" → `POST /api/customer/projects/[id]/approve` (existuje!) +
    potvrzovací dialog („Schválením se web stane ostrým. Souhlasíš?"),
    status → `approved` → fáze 6 Předáno.
- **Více kol:** po `needs_revision` → tým zapracuje → nová verze → status
  `generated`/`qa_check` → zákazník zase vidí Preview. Feedback formulář ukáže
  „Připomínky z předchozího kola" (read-only) — zákazník vidí, že je tým četl.
- **Omezení kol:** 2 kola úprav zdarma (součást balíčku), 3. kolo = nabídka
  rozšíření (upsell v Předání, ne blokace práce).

### 4.3 Empty state

Pokud žádná verze preview neexistuje (fáze < Preview): stránka se přesměruje na
detail projektu s tím, že tlačítko „Zobrazit preview" se nezobrazuje. (Žádná
prázdná stránka — sekce Akce na detailu se řídí fází, viz §5.)

---

## 5. Stavy projektu a přechody (stavový automat)

### 5.1 Mapování existujících DB statusů → 6 fází portálu

**Klíčové rozhodnutí: nepřidáváme nový stavový model.** DB statusy
`webdo24_projects.status` zůstávají zdrojem pravdy; portál je jen **mapovací
vrstva** `getPhase(status)`:

| DB status | Fáze portálu | Primární CTA | Sekundární akce |
|---|---|---|---|
| `draft`, `submitted` | 1 Objednáno | (čeká na platbu — nic) | Napsat zprávu |
| `waiting_for_materials` | 2 Podklady | Nahrát podklady → `/podklady` | Napsat zprávu |
| `ready_for_generation`, `generating` | 3 Výroba | Napsat zprávu | — |
| `generated`, `qa_check` | 4 Preview | Zobrazit preview → `/preview` | Napsat zprávu |
| `needs_revision` | 5 Úpravy | (čeká na tým — žádné CTA) | Napsat zprávu |
| `approved`, `deployed` | 6 Předáno | Přejít na předání → `/predani` | Zobrazit web (nové okno) |
| `archived` | — (karta označena „Archivováno", neaktivní) | — | — |

Výjimka (lidské vnímání): `generated`/`qa_check` zobrazuje fázi **4 Preview**, ale
progress bar ukazuje fázi 3 jako hotovou a fázi 4 jako aktuální — zákazník čeká na
schválení, ne na výrobu. Stejně tak `needs_revision` = fáze 5 aktuální.

### 5.2 Přechody (kdo a co je spouští)

```
objednávka (Stripe webhook, platba OK)
   └─ submitted ──► waiting_for_materials          [automaticky po platbě]
zákazník odešle podklady (portál, §3.3)
   └─ waiting_for_materials ──► ready_for_generation  [portál akce]
tým spustí pipeline (admin / n8n)
   └─ ready_for_generation ──► generating ──► generated
QA (admin, n8n)                              ┌─────┐
   └─ generated ──► qa_check ──► generated   │ cyklus úprav
zákazník „Chci úpravy" (portál)              │  (max 2 kola)
   └─ qa_check/generated ──► needs_revision ─┘
tým zapracuje (admin: „verze hotová")
   └─ needs_revision ──► qa_check ──► generated
zákazník „Schválit web" (portál)
   └─ generated/qa_check ──► approved ──► deployed  [deploy = stávající /api/deploy]
```

- **Všechny přechody logovat** do `webdo24_audit_log` (akce `PROJECT_STATUS_CHANGED`,
  diff `{from, to}`) — timeline na detailu se z toho staví. Dnes se status mění
  napřímo bez auditu → doplnit do stávajících update route.
- Každý přechod → notifikace zákazníkovi (`webdo24_notifications`): jen milníky
  (platba, preview ready, schváleno, předáno) + připomínky. Zbytek komunikace žije
  v portálu, ne v emailu.

### 5.3 ETA

- Sloupec `eta timestamptz` na `webdo24_projects` (nová migrace `sql/013`).
- Nastavuje tým při přechodu do Výroby / Úprav: `now() + zbývající čas do 24h SLA`.
- Portál zobrazuje „dnes do 18:00" / „zítra do 09:00" + pruh „zbývá ~4 h".
- Pokud ETA chybí → žádný pruh, jen status text (žádný vymyšlený čas).

---

## 6. Ostatní obrazovky

### 6.1 Dashboard — `/`

- Karty projektů (max 6 na stránku, řazení: aktivní první): název, status badge,
  progress %, poslední aktivita (z audit_log/timeline), badge „čeká na tebe" pokud
  fáze ∈ {Podklady, Preview}.
- Primární CTA „Nový projekt" → stávající `/customer/new-project` (přesměrovat do
  `(portal)` varianty; proces objednávky už existuje).
- Empty state: „Zatím nemáš žádný projekt" + velké CTA „Objednat web do 24 hodin"
  → landing/checkout. (+ ikona, krátký popis 24h záruky — důvěra.)

### 6.2 Zprávy — `/zpravy`, `/zpravy/[id]`

- Reuse existujícího `webdo24_messages` (leads CRM) — nový typ vlákna `project_thread`
  (`project_id` + `thread_id`). Portál ukazuje jen vlákna svého customera.
- Vstup z detailu projektu: „Napsat zprávu" → `/zpravy/[projectId]` (thread auto-vytvořen).
- Badge nepřečtených: `webdo24_notifications` typu `message` (nová notifikace při
  každé zprávě týmu). Alternativa: COUNT z messages — ale notifikace už existuje,
  použít ji (jeden zdroj).
- UI: bubliny (zákazník vpravo, tým vlevo), textarea dole, Enter = odeslat,
  Shift+Enter = nový řádek. Žádné emoji reakce, žádné attachments v V1 (odkaz na
  soubor = stačí napsat název; soubory patří do Podkladů).

### 6.3 Dokumenty — `/dokumenty`

- Faktury: z `webdo24_invoices` (PDF generované — existuje invoice pipeline).
- Smlouva/objednávka: PDF z objednávky (V1: odkaz na existující soubor v media
  category `document`, případně generovaný PDF).
- Návody: statické markdown stránky („Jak spravovat web", „Jak platit hosting") —
  renderované z `public/guides/*.md` nebo DB.
- Přístupové údaje: **až po Předáno** — jinak sekce skrytá (RLS/UI podmínka na fázi).
- Empty state: „Zatím tu nic není. Faktury se tu objeví po první platbě."

### 6.4 Profil — `/profil`

- Kontaktní údaje (z `webdo24_customers` — editace přes existující
  `api/customer/profile` route).
- Fakturační údaje (company, IČO, DIČ, adresa — do `webdo24_company_profiles`, pokud
  existuje, jinak customers).
- Nastavení notifikací: email / SMS / push — V1 jen email (checkboxy uložené do
  `customers.notification_prefs jsonb`, nový sloupec migrací). SMS/push = budoucí,
  UI zobrazí disabled stavy s „brzy".

### 6.5 Předání — `/projekt/[id]/predani`

- Fáze 6: přístupové údaje (admin URL z `projects.production_url` + credentials
  z `project_files`/media `document`; hesla nikdy plaintext v UI — „zobrazit/
  skrýt" + kopírovat).
- Návod „Jak web spravovat" (odkaz do Dokumentů).
- Informace o doméně (`projects.domain`, DNS status dle `custom_domain*` sloupců).
- Stažení dokumentů (faktura, smlouva).
- Upsell (nenásilný, karta „Možná se hodí"): hosting, SEO, údržba, další stránky →
  `webdo24_products` + stávající Stripe checkout (existuje `api/customer-services/upgrade`).

---

## 7. Komponentová struktura

```
src/components/portal/
  PortalLayout.tsx        ← top nav (desktop) / bottom tab (mobil) + badge
  ProjectCard.tsx         ← karta na dashboardu (progress %, badge „čeká na tebe")
  ProgressSteps.tsx       ← 6 fází; props: current, hiddenSteps
  StatusBadge.tsx         ← barevný badge fáze
  StatusCard.tsx          ← „Aktuální status" + ETA pruh
  Checklist.tsx           ← položky + stavy + tlačítka [Nahrát]
  ChecklistItem.tsx
  UploadZone.tsx          ← drag & drop + input file + progress uploadu
  FileComment.tsx         ← komentář k souboru
  Timeline.tsx            ← z audit_log + zpráv; props: events[]
  FeedbackForm.tsx        ← textarea + screenshot + 2 CTA (Schválit / Úpravy)
  VersionHistory.tsx      ← v1..vn preview verzí
  HandoverCard.tsx        ← přístupy + návod + upsell
  MessageThread.tsx       ← vlákno zpráv (bubliny)
  EmptyState.tsx          ← ikona + titulek + text + CTA (jeden pro celý portál)
  ConfirmDialog.tsx       ← potvrzení „Schválit web" (a11y: focus trap, Esc)
```

Konvence:
- **Server components** pro čtení (stránky, Timeline, Checklist read-only), **client
  komponenty jen tam, kde je interakce** (UploadZone, FeedbackForm, MessageThread,
  ConfirmDialog, ProgressSteps — kvůli animaci ne, animace jde CSS).
- Data fetching: server pages volají `src/lib/portal/*.ts` doménové funkce
  (žádná business logika v komponentách), mutace = server actions
  (`src/lib/actions/portal-*.ts`).
- Styling: Tailwind v4 (existující `globals.css`), design tokeny — primární
  `#2563eb` (modrá, odvozená od do24.cz brandu), success `#16a34a`,
  warning `#d97706`, neutrální šedi. Dark mode: portál v V1 jen light (zákazníci
  ne-techničtí, konzistence), systémové dark necháme studiu.

---

## 8. UX rozhodnutí a zdůvodnění (shrnutí)

| Rozhodnutí | Proč |
|---|---|
| 1 CTA na obrazovku | Ne-technický uživatel nesmí přemýšlet „kam kliknout". Sekundární akce šedé/outline. |
| Detail projektu = jedna stránka, vše vidět bez klikání | Scroll > navigace. Zákazník na mobilu vidí stav, checklist i akci jedním prstem. |
| Postranní panel → dolní sekce na mobilu | Drawer schovává obsah; sekce dole je přirozená (Apple/Google vzor) a nevyžaduje gesto. |
| Bottom tab bar na mobilu | Palec, ne hlavička. 4 položky = limit kognitivní zátěže. |
| Statusy lidsky, ETA vždy | „do 24 h" je hlavní slib značky — každá hodina bez ETA = dotaz. |
| Žádná nová tabulka pro checklist | Odvozovat z existujících dat = méně kódu, méně driftu, checklist nikdy „nelže". |
| Mapovací vrstva statusů, ne nový stavový model | DB statusy řídí n8n/Stripe/admin pipeline — portál je musí jen správně ukázat. |
| Badge z notifikací, ne z dotazu na zprávy | Jeden zdroj pravdy pro „je něco nového", škáluje na SMS/email. |
| Potvrzovací dialog u Schválit | Schválení = právní + finanční milník (konec SLA). Omyl by stál hodiny. |
| 2 kola úprav v balíčku, 3. = upsell | Jasný rámec bez blokace; upsell přichází až v Předání, ne při práci. |
| A11y: focus, kontrast, semantika | Zákonný požadavek (novela §, přístupnost webů) + ne-techničtí uživatelé často stárnoucí populace. |

---

## 9. Doporučení pro implementaci (pořadí prací)

**Phase A — kostra + Detail (2–3 dny):**
1. `sql/013_portal.sql`: `eta` na projects, `notification_prefs` na customers,
   `note` na project_files, notifikace typu `message`/`milestone`; audit akce
   `PROJECT_STATUS_CHANGED` do stávajících update route.
2. `src/lib/portal/{phases,status-texts,checklist,timeline}.ts` + `getPhase()`.
3. Route group `(portal)` + `PortalLayout` (nav, badge) + redirect `/customer` → `/portal`.
4. Detail projektu: ProgressSteps, StatusCard, Checklist, Timeline, sidebar.
5. Dashboard s kartami + empty state.

**Phase B — akce (2–3 dny):**
6. Podklady: UploadZone, Checklist interakce, „Odeslat podklady" (server action).
7. Preview: iframe + VersionHistory + FeedbackForm (napojit na existující
   approve/revision API, rozšířit o text feedbacku).
8. Zprávy: thread view nad `webdo24_messages`, badge.

**Phase C — dokončení (1–2 dny):**
9. Předání + upsell (reuse Stripe checkout).
10. Dokumenty (faktury, návody), Profil (prefs).
11. Notifikační emaily u milníků (existuje `webdo24_email_queue` + worker).
12. Testy: mobilní průchod celého cyklu (objednávka → předání), a11y (Tab, kontrast,
    VO), empty states všech sekcí.

Celkem ~5–8 pracovních dní na jednoho vývojáře. Preview + feedback + podklady
tvoří 70 % hodnoty — dělat jako první po kostře.

---

## 10. Edge cases (a jak je portál řeší)

| Situace | Chování portálu |
|---|---|
| Zákazník nezaplatil | Fáze 1, žádné CTA, banner „Čekáme na platbu" + odkaz na checkout (Stripe session znovupoužitelná). |
| Zákazník nic nenahrál (fáze 2, 24 h+) | Po 24 h notifikace/připomínka (email + in-app): „Podklady nám zatím nedorazily." Dalších 48 h → tým kontaktuje telefonicky (interní úkol). SLA se počítá od přijetí podkladů — portál to ukáže explicitně, aby zákazník nepsal „kde je web". |
| Nahrál jen část podkladů | Checklist ukazuje konkrétní chybějící položky; „Odeslat" disabled do kompletace. Žádná „částečná" objednávka se nespouští. |
| Špatný formát souboru | Upload zóna chybu pojmenuje („Podporujeme JPG, PNG, PDF…") a soubor odmítne client-side + server-side (magic bytes). |
| Soubor > 10 MB | Okamžitá chyba s návodem („zmenšete obrázek / pošlete přes náš chat"). |
| Dlouho nereaguje na preview (fáze 4) | 24 h → připomínka; 72 h → tým zavolá. Projekt se automaticky nearchivuje, ale interní SLA se pozastaví. |
| Více kol feedbacku | 2 kola zdarma; 3. kolo → v Předání nabídka „Balíček úprav navíc" (upsell), nikdy zablokování práce. |
| Feedback bez textu | „Chci úpravy" vyžaduje text (validace); „Schválit" text nevyžaduje. |
| ETA propadla (24 h nestíháme) | Interní proces: tým posune ETA + zákazník dostane notifikaci předem („Posouváme dokončení na zítra 09:00, omlouváme se") — nikdy tichý propad. |
| Starší verze preview nedostupná | Verze zůstává v seznamu, ale klik → „Tahle verze už není dostupná, aktuální najdeš nahoře." |
| Zákazník schválí omylem | Dialog potvrzení + 24 h okno „Vrátit schválení" (pouze pokud nedošlo k deploy). |
| Deploy selže | Status zůstane `approved`, banner „Web se nám nepodařilo zprovoznit, pracujeme na tom" + interní alert; žádný `deployed` bez ověření (stejný princip jako verification v CCC). |
| Zákazník má 2+ projektů | Dashboard karty, detail má „Přepnout projekt" v hlavičce (dropdown). |
| Archivovaný projekt | Karta šedá, badge „Archivováno", detail read-only, žádné CTA. |
| Nový zákazník, 0 projektů | Empty state s CTA na objednávku (24 h záruka jako důvěryhodný prvek). |
| Přihlášený, ale membership zrušen | Layout redirect na login/„účet deaktivován" (RLS stejně vrátí prázdno — UI musí říct proč). |
| Notifikace badge > 99 | Zobrazit „99+". |
| Upload probíhá, zákazník odejde | Upload běží na serveru (server action), po dokončení notifikace; client-side stav „Nahrává se…" s možností pokračovat. |

---

## 11. Otevřené otázky k potvrzení (OWNER)

1. Doména portálu: `login.webdo24.cz` (existující) vs. samostatné `portal.do24.cz`?
   (Návrh: zůstat na login.webdo24.cz, do24.cz je marketingová doména.)
2. „Nový projekt" v portálu = plný checkout proces (Stripe) už v V1, nebo jen
   kontaktní formulář?
3. Feedback „Chci úpravy" — text se má dostat do n8n/AI pipeline automaticky, nebo
   jen jako zpráva týmu? (Návrh: V1 zpráva + notifikace, automatizace Phase 2.)
4. Přístupové údaje v Předání — chceme V1 opravdu credentials, nebo jen odkaz na
   admin + návod? (Bezpečnost: hesla raději přes „zobrazit" + kopírovat, ne plaintext
   v DOM.)
5. Jazyk: portál jen čeština, nebo i slovenská verze (i18n) v V1?
