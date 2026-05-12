# WEBDO24 LEAD MACHINE™ — Komponenty a Flow

> Detailní popis chování každé obrazovky, stavů a interakcí.

---

## Komponentní knihovna

### `DashboardCard`
```
Props:
- title: string           // „Nové poptávky"
- value: number | string  // 2
- icon: LucideIcon        // Inbox
- trend?: "up" | "down" | "neutral"
- trendValue?: string     // „+1 oproti včerejšku"
- href?: string           // kam vede kliknutí
- color: "blue" | "green" | "amber" | "slate"
```

Chování:
- Celá karta je klikatelná (href)
- Hover: scale(1.01), shadow-md
- Active: scale(0.99)
- Trend šipka = zelená (↑), červená (↓), šedá (→)

### `LeadCard`
```
Props:
- id: string
- name: string
- phone: string
- message: string        // max 3 řádky
- source: "web" | "whatsapp" | "email" | "form"
- status: "new" | "contacted" | "negotiation" | "done"
- createdAt: Date
- avatar?: string        // fallback: iniciály
```

Chování:
- Desktop: drag & drop mezi sloupci
- Mobil: swipe left/right nebo tlačítko „Posunout dál"
- Long press: kontextové menu (Zavolat, Napsat, Smazat)
- Kliknutí: otevře detail v draweru/bottom sheetu

### `MessageBubble`
```
Props:
- sender: "customer" | "me" | "ai"
- content: string
- timestamp: Date
- status?: "sent" | "delivered" | "read"
```

Chování:
- Zákazník: bílé pozadí, vlevo
- Já: modré pozadí, vpravo
- AI návrh: fialové pozadí, vpravo, označení „Návrh“
- Klik na AI návrh: „Použít“ / „Upravit“ / „Zahodit“

### `AiButton`
```
Props:
- action: "reply" | "improve" | "generate" | "translate"
- context?: string      // text, na který reagujeme
- onResult: (text: string) => void
```

Chování:
- Ikona ✨ + text akce
- Loading stav: „Chvilku...“ místo „Generuji..."
- Výsledek: expanduje se pod tlačítkem
- Nikdy neodesílá automaticky

### `EditableField`
```
Props:
- value: string
- onSave: (value: string) => void
- multiline?: boolean
- validate?: (value: string) => boolean
- placeholder?: string
```

Chování:
- Klik = inline editace (contentEditable nebo input)
- Escape = zrušit
- Enter (single line) = uložit
- Ctrl+Enter (multiline) = uložit
- Blur = uložit (s animací „Uloženo ✅“)
- Validace = červený okraj + text chyby

### `ToggleCard`
```
Props:
- title: string
- description: string
- enabled: boolean
- onToggle: (enabled: boolean) => void
- preview?: string      // náhled textu automatizace
```

Chování:
- Přepínač vpravo (iOS styl)
- Zapnuto = zelená barva přepínače
- Vypnuto = šedá barva
- Klik na kartu = toggle
- Klik na „Upravit text“ = rozbalí se textarea

---

## Uživatelské toky (User Flows)

### Flow 1: Nová poptávka (nejčastější)

```
Zákazník odešle formulář
        ↓
Push notifikace na mobil majitele
        ↓
Majitel klepne na notifikaci
        ↓
Otevře se CRM → karta je v „Nové"
        ↓
Majitel klepne na kartu
        ↓
Drawer: zpráva + telefon
        ↓
[ Zavolat ] nebo [ ✨ Napiš odpověď ]
        ↓
Když AI odpověď: „Dobrý den...“
        ↓
[ Použít ] → otevře se editor
        ↓
[ Odeslat ]
        ↓
Karta se posune do „Kontaktováno"
        ↓
Toast: „Odpověď odeslána ✅“
```

**Čas:** 15 sekund od notifikace do odpovědi.

### Flow 2: Editace webu

```
Majitel klikne „Můj web“
        ↓
Živý náhled jeho webu (mobilní/desktop toggle)
        ↓
Klikne na nadpis
        ↓
Inline editor: text se zvýrazní
        ↓
Píše nový text
        ↓
Klikne mimo nebo Enter
        ↓
Auto-save (toast: „Uloženo ✅“)
        ↓
„Uložit změny“ → publikace
```

**Čas:** 30 sekund na změnu textu.

### Flow 3: Přidání reference

```
Majitel klikne „Můj web“
        ↓
Klikne „Spravovat reference“
        ↓
Seznam existujících (swipe = smazat)
        ↓
[ + Přidat referenci ]
        ↓
Formulář: Jméno, Hodnocení, Text, Fotka
        ↓
[ ✨ Vylepši text ] (volitelné)
        ↓
[ Publikovat ]
        ↓
Reference je na webu do 5 sekund
```

### Flow 4: Rychlá odpověď (dashboard)

```
Dashboard → poslední zpráva
        ↓
Klik na zprávu
        ↓
Rozbalí se quick reply
        ↓
[ 👍 Děkuji, ozvu se ]
[ 📅 Kdy se hodí? ]
[ 💰 Pošlu cenovku ]
[ ✨ Vlastní odpověď ]
        ↓
Klik → odešle se
```

---

## Stavy obrazovek

### Dashboard — stavy

| Stav | Obsah |
|------|-------|
| Prázdný (0 poptávek) | „Zatím žádné poptávky. Sdílejte svůj web!“ + ilustrace + tlačítko „Kopírovat odkaz“ |
| Normální (1-10) | Standardní karty, poslední zprávy |
| Hodně (10+) | „10+ nových“ místo přesného čísla, badge |
| Offline | „Jste offline. Změny se uloží, až budete online.“ |
| Loading | Skeleton cards (3 ks), skeleton zprávy (2 ks) |

### CRM — stavy

| Stav | Obsah |
|------|-------|
| Prázdný sloupec | „Přetáhněte sem poptávku“ nebo „Zatím prázdné“ |
| S kartami | Standardní pipeline |
| Hledání | Full-text search nad jménem/zprávou |
| Detail otevřen | Bottom sheet (mobil) / Sidebar (desktop) |
| Volání | Native tel: link, zobrazení „Volá se...“ |

### Web editor — stavy

| Stav | Obsah |
|------|-------|
| Náhled | Živý web, klikatelná pole označena jemným rámečkem |
| Editace | Aktivní pole má modrý rámeček, kurzor bliká |
| Ukládání | Text „Ukládám...“ vedle pole, pak „Uloženo ✅“ |
| Chyba | Červený rámeček, text „Zkontrolujte telefon“ |
| Nepublikováno | Badge „Nepublikováno“ + tlačítko „Publikovat“ |

---

## Chybové hlášky (human-friendly)

Nikdy technické. Vždy lidské.

| Technická chyba | Uživatelská hláška |
|-----------------|-------------------|
| 500 Internal Server Error | „Chvilku to trvá. Zkuste to za moment.“ |
| Network Error | „Jste offline. Změny se uloží, až budete zpět.“ |
| Validation Failed | „Zkontrolujte telefon — vypadá to, že chybí číslice.“ |
| Timeout | „Server si dal chvilku pauzu. Zkuste to znovu.“ |
| Auth Failed | „Zkontrolujte email. Poslali jsme nový odkaz.“ |
| AI Error | „Asistent si teď dává pauzu. Zkuste to za chvíli.“ |
| File Too Large | „Fotka je moc velká. Zkuste menší — do 5 MB.“ |

---

## Responsivní breakpointy

| Breakpoint | Zařízení | Layout |
|------------|----------|--------|
| < 640px | Mobil | Single column, bottom nav, bottom sheets |
| 640-1024px | Tablet | Single column, sidebar collapsible |
| > 1024px | Desktop | Sidebar fixed, pipeline grid, modals |

---

## PWA požadavky

- `manifest.json` s ikonami, theme color
- Service worker pro offline read-only režim
- Push notifikace (Supabase Realtime → Push API)
- Add to Home Screen prompt po 3. návštěvě
- Background sync pro odpovědi odeslané offline
