# WEBDO24 LEAD MACHINE™ — Návrh administrace

> **Filozofie:** *„Neřešte techniku. Jen sledujte zákazníky.“*

---

## 1. Hlavní Dashboard

### Co uvidí uživatel po přihlášení

Dashboard = **přehledná nástěnka**, ne technický panel. Uživatel musí mít okamžitý pocit: *„Mám všechno pod kontrolou.“*

#### Layout: „Karty přehledu“

```
┌─────────────────────────────────────────┐
│  👋 Dobré ráno, Jirko!                  │
│  Dnes máte 2 nové poptávky 🔥           │
├─────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ NOVÉ    │ │ NÁVŠTĚVY│ │ WEB STAV│   │
│  │   2     │ │  47     │ │   ✅    │   │
│  │ poptávky│ │ dnes    │ │ aktivní │   │
│  └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────┤
│  📬 POSLEDNÍ ZPRÁVY                     │
│  ┌─────────────────────────────────┐   │
│  │ Anna Nováková — před 10 min    │   │
│  │ „Dobrý den, chtěla bych..."     │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ Petr Svoboda — před 2 hodinami │   │
│  │ „Kolik stojí oprava..."         │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  ⚡ RYCHLÉ AKCE                         │
│  [ Napsat nabídku ] [ Přidat referenci ]│
└─────────────────────────────────────────┘
```

#### Pravidla dashboardu

| Pravidlo | Proč |
|----------|------|
| Maximálně 6 karet | Více = chaos, méně = prázdné |
| Velká čísla, malé popisky | Člověk čte nejdřív čísla |
| Zelená = dobré, oranžová = pozor, červená = akce | Instinktivní barvy |
| Poslední zprávy jako chat bubliny | Všichni znají WhatsApp |
| Žádné grafy, pokud to není nutné | Řemeslník nepotřebuje Analytics |
| Přihlášení = max 2 sekundy | Když to trvá dlouho, nepoužívají to |

#### Karty dashboardu (přednastavené)

1. **Nové poptávky** — velké číslo, kliknutí = seznam
2. **Návštěvy webu** — dnes/tento týden, jednoduchá šipka ↑↓
3. **Stav webu** — zelená ikona + text „Vše funguje“
4. **Nepřečtené zprávy** — počet + poslední 2 náhledy
5. **Reference** — počet/aktuální hodnocení hvězdičkami
6. **Rychlé akce** — max 2 tlačítka podle kontextu

---

## 2. Menu administrace

### Struktura: 5 položek maximum

```
┌─────────────────────┐
│  🏠 Dashboard       │  ← domů, vždy dostupný
├─────────────────────┤
│  👥 Zákazníci       │  ← CRM + poptávky
├─────────────────────┤
│  🌐 Můj web         │  ← editace webu
├─────────────────────┤
│  💬 Zprávy          │  ← komunikace
├─────────────────────┤
│  ⚙️ Nastavení       │  ← profil, notifikace, AI
└─────────────────────┘
```

> **Zlaté pravidlo:** Pokud funkce nepatří do těchto 5 sekcí, nepatří do administrace.

#### Dashboard
- **Co tam je:** Přehled všeho důležitého
- **Co tam děláš:** Prohlížíš, klikáš na rychlé akce
- **Co tam NENÍ:** Žádné nastavení, žádné formuláře

#### Zákazníci
- **Co tam je:** Seznam všech poptávek, kontaktů, stavů
- **Co tam děláš:** Přesouváš kartičky, píšeš poznámky, voláš
- **Co tam NENÍ:** Excel, filtry, exporty, tagy, segmentace

#### Můj web
- **Co tam je:** Živý náhled webu + editační módy
- **Co tam děláš:** Klikáš na text/fotku a měníš ji
- **Co tam NENÍ:** Drag & drop builder, šablony, CSS, HTML

#### Zprávy
- **Co tam je:** Všechny komunikační kanály na jednom místě
- **Co tam děláš:** Čteš a odpovídáš jako ve WhatsApp
- **Co tam NENÍ:** E-mailový klient, přílohy, podpisy

#### Nastavení
- **Co tam je:** Profil, notifikace, zapnutí AI, účet
- **Co tam děláš:** Zapínáš/vypínáš přepínače
- **Co tam NENÍ:** Nic technického, žádné API, žádné integrace

---

## 3. CRM / Poptávky

### Filozofie: „Digitální nástěnka s lístečky“

Uživatel musí vidět své poptávky jako na fyzické nástěnce v dílně. Žádné tabulky jako Excel.

#### Pipeline (výchozí 4 sloupce)

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│   🆕 NOVÉ    │  📞 KONTAKT  │   🤝 DOMLUVA │    ✅ HOTOVÉ │
│              │   ZVÁNO      │              │              │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ ┌──────────┐ │ ┌──────────┐ │              │ ┌──────────┐ │
│ │ Anna N.  │ │ │ Petr S.  │ │              │ │ Milan K. │ │
│ │ „Dobrý   │ │ │ „Kolik   │ │              │ │ „Děkuji, │ │
│ │ den..."  │ │ │ stojí..."│ │              │ │ vše OK"  │ │
│ │ 📱       │ │ │ 📧       │ │              │ │ ⭐⭐⭐⭐⭐  │ │
│ │ před 5m  │ │ │ včera    │ │              │ │ včera    │ │
│ └──────────┘ │ └──────────┘ │              │ └──────────┘ │
├──────────────┤              │              │              │
│ ┌──────────┐ │              │              │              │
│ │ Jana H.  │ │              │              │              │
│ │ „Potřebu-│ │              │              │              │
│ │ ji..."   │ │              │              │              │
│ │ 📱       │ │              │              │              │
│ │ před 2h  │ │              │              │              │
│ └──────────┘ │              │              │              │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

#### Karta poptávky (jednoduchá)

```
┌─────────────────────┐
│ Anna Nováková       │
│ 📱 777 123 456      │
│                     │
│ „Dobrý den, chtěla  │
│ bych se zeptat na   │
│ cenu rekonstrukce...│
│                     │
│ [ Označit jako      │
│   kontaktováno ]    │
│                     │
│ [ Napsat ] [ Zavolat]│
└─────────────────────┘
```

#### Co je na kartě
- Jméno (velké)
- Telefon (jedno kliknutí = volání)
- Zpráva (max 3 řádky)
- Zdroj (web/formulář/WhatsApp)
- Čas přijetí
- **Jedno hlavní tlačítko akce**

#### Co na kartě NENÍ
- Email (skrytý, rozbalí se)
- Adresa (skrytá)
- Tagy, štítky, priority
- Poznámky (rozbalí se)
- Historie (kliknutí = detail)

#### Přesun mezi sloupci
- **Desktop:** Drag & drop
- **Mobil:** Swipe doleva/doprava nebo tlačítko „Posunout dál“
- **Vždy:** Zvukové potvrzení (jemné „tick“)

---

## 4. Editace webu

### Filozofie: „Klikni a piš. Klikni a nahraď. Hotovo.“

Největší strašák uživatele: *„Rozbiju si web.“*
Musíme garantovat: **Web se nedá rozbít.**

#### Režimy editace

**Režim 1: Živý náhled (výchozí)**
```
┌─────────────────────────────────────┐
│  🔗 webdo24.cz/vase-firma           │
│                                     │
│  ┌─────────────────────────────┐   │
│  │   [ Vaše firma ]            │   │  ← klik = upravíš
│  │   [ Klikni a změň text ]    │   │  ← klik = upravíš
│  │                             │   │
│  │   [ 📷 Klikni a nahraď ]   │   │  ← klik = nahrazení
│  │                             │   │
│  │   [ 📞 777 123 456 ]        │   │  ← klik = upravíš
│  └─────────────────────────────┘   │
│                                     │
│  [ 💾 Uložit změny ]                │
└─────────────────────────────────────┘
```

**Pravidla živého náhledu:**
- Kliknutí na text = inline editace (jako ve Wordu)
- Kliknutí na fotku = výběr z galerie/nahrání
- Nemůžeš smazat sekci
- Nemůžeš přidat sekci
- Nemůžeš změnit barvy
- Nemůžeš změnit layout
- **Můžeš jen měnit obsah, ne formu**

**Režim 2: Správce obsahu**
Pro uživatele, kteří potřebují přidat referenci nebo službu:

```
┌─────────────────────────────────────┐
│  ➕ Přidat referenci                │
│                                     │
│  Jméno zákazníka: [____________]   │
│  Hodnocení:        ⭐⭐⭐⭐⭐          │
│  Text:             [____________]   │
│  [ 📷 Přidat fotku ]                │
│                                     │
│  [ 💾 Publikovat ]                  │
└─────────────────────────────────────┘
```

#### Co může uživatel měnit

| Může měnit | Nemůže měnit |
|------------|--------------|
| Texty nadpisů | Fonty |
| Texty odstavců | Barvy |
| Telefon, email, adresa | Layout |
| Fotky (z galerie) | Strukturu |
| Reference (přidávat) | Menu |
| Služby (přidávat/odebírat) | SEO, kódy |
| Ceník (ceny, popisky) | Animace |

#### Ochrana před rozbitím

1. **Žádné mazání sekcí** — vždy jen skrýt/ukázat
2. **Žádné změny layoutu** — vždy jen obsah
3. **Automatický backup** — každá změna = verze
4. **Tlačítko „Vrátit zpět“** — vždy viditelné
5. **Preview režim** — „Jak to uvidí zákazník“
6. **Validace telefonu** — kontrola formátu
7. **Kontrola prázdných polí** — varování před uložením

---

## 5. AI Funkce

### Filozofie: „Máte osobního asistenta, ne robot.“

AI nesmí působit jako technologie. Musí působit jako **chytrý kolega**, který ti pomůže.

#### Umístění AI v administraci

AI není samostatná sekce. AI je **všude, kde to dává smysl**.

**V CRM — u poptávky:**
```
┌─────────────────────────┐
│ Anna Nováková           │
│ „Dobrý den, kolik..."   │
│                         │
│ [ ✨ Napiš odpověď ]    │  ← AI tlačítko
└─────────────────────────┘
```

**Kliknutí na „✨ Napiš odpověď“:**
```
┌─────────────────────────┐
│ ✨ Návrh odpovědi:      │
│                         │
│ „Dobrý den Anno,        │
│ děkuji za zájem. Cena   │
│ se odvíjí od rozsahu... │
│ Mohli bychom se sejít?" │
│                         │
│ [ Použít ] [ Upravit ]  │
└─────────────────────────┘
```

**V editaci webu — u textu:**
```
[ Klikni na text ]
  ↓
[ ✨ Vylepši text ]      ← AI tlačítko
[ ✨ Přepiš formálně ]    ← AI tlačítko
[ ✨ Zkrátit ]            ← AI tlačítko
```

**V dashboardu — rychlé akce:**
```
⚡ RYCHLÉ AKCE
[ ✨ Napiš nabídku ]
[ ✨ Vytvoř FB příspěvek ]
[ ✨ Odpověz na poslední zprávu ]
```

#### AI příkazy (jedno kliknutí)

| Tlačítko | Co udělá |
|----------|----------|
| ✨ Napiš odpověď | Navrhne odpověď na základě zprávy zákazníka |
| ✨ Vylepši text | Upraví text webu, aby působil profesionálněji |
| ✨ Napiš nabídku | Vytvoří cenovou nabídku z poptávky |
| ✨ FB příspěvek | Vytvoří příspěvek z aktuální služby/reference |
| ✨ Připomeň se | Navrhne text připomínky zákazníkovi |
| ✨ Přelož do EN | Přeloží text (pro turistické firmy) |

#### Jak AI komunikuje

- **Nikdy** neukazujeme „Generuji...“ nebo „AI pracuje...“
- **Vždy:** „Chvilku...“ nebo „Mám nápad 💡“
- **Vždy:** Návrh je ihned vidět, uživatel rozhodne
- **Nikdy:** AI neodesílá nic automaticky bez potvrzení

---

## 6. Mobilní verze

### Filozofie: „Telefon je primární zařízení.“

Řemeslník nemá počítač v dílně. Má telefon v kapse.

#### Mobilní priorita

**Dashboard na mobilu:**
```
┌─────────────────┐
│ 👋 Jirko, 2    │
│ nové poptávky!  │
├─────────────────┤
│ ┌─────────────┐ │
│ │ 📬 2 nové   │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │ 👁️ 47 návštěv│ │
│ └─────────────┘ │
├─────────────────┤
│ 📬 POSLEDNÍ     │
│ Anna N. — před  │
│ 5 min: „Dobrý   │
│ den, chtěla..." │
├─────────────────┤
│ Petr S. — před  │
│ 2h: „Kolik..."  │
├─────────────────┤
│ [ ✉️ Napsat     │
│   odpověď ]     │
└─────────────────┘
```

#### Co je prioritní na mobilu

| Priorita | Proč |
|----------|------|
| Notifikace poptávek | Okamžitá reakce = konverze |
| Rychlá odpověď | Jedno kliknutí = odpověď/telefon |
| Pipeline swipe | Přesunout poptávku = swipe |
| Telefonní čísla | Kliknutí = okamžité volání |
| Zvukové upozornění | Slyší to i v hluku dílny |

#### Co skrýt na mobilu

- Návštěvnost (zobrazeno jen při swipe)
- Nastavení (v menu)
- Editace webu (skryto, dostupné přes „Plná verze“)
- Grafy, statistiky
- Dlouhé texty (zkrácené náhledy)

#### Mobilní zkratky

- **Pull-to-refresh** na dashboardu
- **Swipe left/right** na kartě = změna stavu
- **Long press** na telefon = volání
- **Shake** = zpětná vazba/bug report
- **Bottom sheet** místo popupů

---

## 7. Automatizace

### Filozofie: „Nastav jednou, zapomeň navždy.“

Automatizace musí být **přednastavené přepínače**, ne workflow builder.

#### Panel automatizací (v Nastavení)

```
┌─────────────────────────────────────┐
│  🤖 AUTOMATIZACE                    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📩 Automatická odpověď      │   │
│  │                             │   │
│  │ „Děkujeme za poptávku.      │   │
│  │ Ozveme se do 2 hodin."      │   │
│  │                             │   │
│  │ [ ✅ Zapnuto ]              │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🔔 Upozornění na poptávku   │   │
│  │                             │   │
│  │ SMS + Push notifikace       │   │
│  │                             │   │
│  │ [ ✅ Zapnuto ]              │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ⏰ Připomínka zákazníkovi   │   │
│  │                             │   │
│  │ Po 24h bez odpovědi         │   │
│  │                             │   │
│  │ [ ⬜ Vypnuto ]              │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ⭐ Žádost o hodnocení       │   │
│  │                             │   │
│  │ Po dokončení zakázky        │   │
│  │                             │   │
│  │ [ ✅ Zapnuto ]              │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

#### Výchozí nastavení (po registraci)

| Automatizace | Výchozí stav | Proč |
|--------------|--------------|------|
| Potvrzení poptávky | ✅ Zapnuto | Zákazník ví, že to dorazilo |
| Upozornění majitele | ✅ Zapnuto | Nesmíme zapomenout |
| Připomínka zákazníkovi | ⬜ Vypnuto | Až po první zkušenosti |
| Žádost o hodnocení | ✅ Zapnuto | Reference jsou zlato |
| AI odpověď | ⬜ Vypnuto | Musíme nejdřív vysvětlit |
| FB příspěvek z reference | ⬜ Vypnuto | Volitelné |

#### Každá automatizace = jeden přepínač

- Žádné „nastavení podmínek“
- Žádné „výběr triggerů“
- Žádné „delay nastavení“
- Jedno tlačítko: Zapnuto/Vypnuto
- Text je přednastavený, lze upravit jedním kliknutím

---

## 8. Design System

### Vizionářský směr

> *„Vypadá to jako appka za milion dolarů, ale používá ji moje máma.“*

#### Paleta (restrained, premium)

```
Primární:    #0F172A  (téměř černá — důvěra, stabilita)
Sekundární:  #3B82F6  (modrá — akce, klid)
Úspěch:      #10B981  (zelená — hotovo, dobré)
Varování:    #F59E0B  (oranžová — pozor)
Chyba:       #EF4444  (červená — jen když nutné)
Pozadí:      #F8FAFC  (teplá bílá)
Karta:       #FFFFFF  (čistá bílá)
Text:        #1E293B  (čitelná šedá)
Text-muted:  #94A3B8  (druhořadý text)
```

#### Typografie

| Element | Velikost | Váha | Proč |
|---------|----------|------|------|
| Hlavní nadpis | 24px | 600 | Velké, ale ne agresivní |
| Nadpis sekce | 18px | 600 | Přehledné |
| Tělo | 16px | 400 | Čitelné na mobilu |
| Popisek | 14px | 500 | Šedý, netlačí |
| Číslo | 36px | 700 | Velké = důležité |
| Tlačítko | 16px | 600 | Klikatelné |

> Font: **Inter** nebo **Geist** — moderní, čitelná, české znaky

#### Komponenty

**Tlačítko (primární):**
```
┌─────────────────────┐
│  [  Napsat odpověď ]│  ← padding 16px 24px
│       rounded-xl    │  ← radius 12px
│       shadow-sm     │  ← jemný stín
└─────────────────────┘
```

**Karta:**
```
┌─────────────────────┐
│                     │
│  Obsah              │  ← padding 20px
│                     │  ← radius 16px
│                     │  ← border 1px #E2E8F0
└─────────────────────┘
```

**Input:**
```
┌─────────────────────┐
│ Jméno               │  ← label nad
│ ┌─────────────────┐ │
│ │ Anna Nováková   │ │  ← border pouze dolní
│ └─────────────────┘ │     nebo celý rámeček
└─────────────────────┘
```

#### Whitespace pravidla

- Mezi sekcemi: **32px**
- Mezi kartami: **16px**
- Uvnitř karty: **20px**
- Mezi prvkem a labelem: **8px**

> **Pravidlo:** Když něco vypadá utopené, přidej 8px. Když to vypadá prázdné, odeber 8px.

#### Ikony

- Pouze **Lucide** nebo **Phosphor**
- Outline styl, ne fill
- Velikost: 20px (standard), 24px (navigace)
- Ikona + text vždy dohromady
- Nikdy sama ikona bez textu (kromě dashboardu)

#### Animace (subtle)

| Interakce | Animace | Délka |
|-----------|---------|-------|
| Kliknutí | Scale 0.98 | 100ms |
| Načtení | Fade in + slide up 8px | 200ms |
| Přesun karty | Smooth translate | 150ms |
| Uložení | Zelený check + fade | 300ms |
| Chyba | Jemný shake | 300ms |

> **Pravidlo:** Animace mají být nepozorovatelné. Uživatel si řekne „to je plynulé“, ne „to je animované“.

---

## 9. Psychologie UX

### Proč toto funguje

#### 1. Redukce kognitivní zátěže

**Problém:** Průměrný člověk zvládne v paměti 4±1 položky.
**Řešení:** 5 menu položek, 4 sloupce v pipeline, 6 karet na dashboardu.

> Když uživatel přijde do administrace a vidí 20 položek menu, mozek řekne: „To je moc. Jdu pryč.“

#### 2. Illusion of control

**Problém:** Uživatel se boří, že něco pokazí.
**Řešení:** 
- Web se nedá rozbít (žádné mazání sekcí)
- Vždy existuje „Zpět“
- AI nikdy nepošle nic bez potvrzení
- Automaticky se ukládá

> Uživatel, který se bojí, nepoužívá. Uživatel, který si věří, používá denně.

#### 3. Dopaminová smyčka

**Problém:** Uživatel zapomíná přihlašovat se.
**Řešení:**
- „2 nové poptávky!“ = důvod se přihlásit
- Zelená čísla = úspěch
- Přesun karty do „Hotové“ = satisfakce
- Nová reference = odměna

> Každá návštěva administrace musí přinést dobrý pocit.

#### 4. Familiarity bias

**Problém:** Uživatel nechce nic nového učit.
**Řešení:**
- Dashboard jako feed (Instagram)
- Zprávy jako chat (WhatsApp)
- Pipeline jako nástěnka (Trello, které zná z netu)
- Editace jako Word (klikni a piš)

> „Vypadá to jako něco, co už znám“ = okamžitá důvěra.

#### 5. Sunk cost fallacy (v dobrém)

**Problém:** Uživatel odejde po měsíci.
**Řešení:**
- Každá přidaná reference = investice
- Každý upravený text = investice
- Každý přesunutý lead = investice
- Dashboard ukazuje: „Už máte 15 zákazníků přes nás“

> Čím více času uživatel vloží, tím méně chce odejít.

#### 6. Authority & Trust

**Problém:** Uživatel nevěří technologii.
**Řešení:**
- Čistý design = „tohle je profi“
- AI jako „asistent“, ne „algoritmus“
- Automatizace jako „pomocník“, ne „bot“
- Notifikace: „Máte novou poptávku“ ne „Trigger activated“

> Jazyk = důvěra. Design = důvěra. Jednoduchost = důvěra.

---

## 10. Technická filozofie

### Architektura pro jednoduchost

```
┌─────────────────────────────────────────┐
│           NEXT.JS (App Router)          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Dashboard│ │   CRM   │ │   Web   │   │
│  │  (RSC)  │ │  (RSC)  │ │ Editor  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Zprávy  │ │ Nastaven│ │   AI    │   │
│  │  (RSC)  │ │  (RSC)  │ │ Panel   │   │
│  └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────┤
│  REACT SERVER COMPONENTS + ACTIONS      │
│  → žádné API routes pro čtení           │
│  → server actions pro mutace            │
├─────────────────────────────────────────┤
│           SUPABASE                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  Auth   │ │  Postgres│ │  Realtime│   │
│  └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────┤
│           N8N / EDGE FUNCTIONS          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Automatiz│ │  Webhook │ │  Notifik │   │
│  └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────┤
│           AI API (OpenAI/Anthropic)     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  Text   │ │  Chat   │ │ Generuj  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────┘
```

#### Proč tento stack

| Technologie | Proč |
|-------------|------|
| Next.js App Router | RSC = méně JS na klientu = rychlé |
| Server Actions | Žádné REST API = méně kódu |
| Supabase Auth | Jednoduché přihlášení, magic link |
| Supabase Realtime | Push notifikace poptávek |
| Postgres Row Level Security | Bezpečnost bez složité logiky |
| n8n | Automatizace bez kódu, snadno upravitelné |
| AI API | Zapínáno postupně, jednoduché prompt engineering |

#### Principy vývoje

1. **Mobile-first design** — Navrhujeme na mobilu, škálujeme na desktop
2. **Optimistické UI** — Uživatel vidí výsledek okamžitě, server dožene později
3. **Skeleton loading** — Žádné spinners, jen struktura se plní obsahem
4. **Edge deployment** — Rychlost pro lokální firmy = SEO + UX
5. **Zero-config onboarding** — Registrace = web je okamžitě živý

#### Databázové principy

- Jednoduché tabulky, žádné komplexní vztahy
- Každá poptávka = jeden řádek
- JSONB pro flexibilní data (nastavení, historie)
- RLS policies = uživatel vidí jen svá data
- Automatické `created_at`, `updated_at`

#### Cena provozu

| Komponent | Odhad měsíčně |
|-----------|---------------|
| Vercel Pro | $20 |
| Supabase Pro | $25 |
| n8n (self-host) | $5 (VPS) |
| AI API | $10-50 (podle použití) |
| **Celkem** | **~$60-100/měsíc** |

> Při 100 uživatelích = $0.60-1.00 na uživatele.
> Při 1000 uživatelích = škálování na vyšší plány, stále nízké náklady.

---

## 11. Onboarding (bonus)

### První přihlášení = 3 kroky

```
┌─────────────────────────────────────┐
│  Krok 1/3                           │
│  🏢 Jak se jmenuje vaše firma?      │
│  [________________]                 │
│                                     │
│  [ Pokračovat ]                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Krok 2/3                           │
│  📞 Jaký je váš telefon?            │
│  [________________]                 │
│                                     │
│  [ Pokračovat ]                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Krok 3/3 ✅                        │
│  Váš web je živý!                   │
│                                     │
│  webdo24.cz/vase-firma              │
│                                     │
│  [ Zobrazit dashboard ]             │
└─────────────────────────────────────┘
```

- Žádný výběr šablony (máme jednu profi šablonu)
- Žádné nastavení barev
- Žádné nahrávání loga (získáme z veřejných zdrojů nebo doplníme později)
- **3 pole = web je online**

---

## 12. Kontrolní seznam pro každou obrazovku

Před implementací každé obrazovky se zeptej:

- [ ] Je to pochopitelné bez školení?
- [ ] Je to použitelné na mobilu?
- [ ] Může to použít člověk bez technických znalostí?
- [ ] Je tam méně než 7 prvků na první pohled?
- [ ] Každé tlačítko má jasný popis?
- [ ] Uživatel se nemůže „ztratit“?
- [ ] Existuje cesta zpět?
- [ ] Je to rychlé (< 2s načtení)?
- [ ] Vypadá to důvěryhodně?
- [ ] Působí to pozitivně?

---

> *„Nejlepší software je ten, který uživatel nepoužívá — on ho prostě žije.“*
>
> **WEBDO24 LEAD MACHINE™ — Administrace pro lidi, ne pro programátory.**
