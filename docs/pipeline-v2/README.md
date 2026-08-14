# PIPELINE V2 — PROMPTY (dodatečné fáze)

Tento adresář obsahuje dodatečné prompty pipeline v2 — fáze, které se spouštějí
po vygenerování obsahu do Content Registry a prvním renderu webu.

## Struktura fází pipeline v2

1. **Brief** — zadání zákazníka (webdo24_project_briefs)
2. **Generování obsahu** — n8n pipeline → Content Registry (webdo24_pages +
   webdo24_content_fields + webdo24_content_values) dle Website Contract v1
3. **První render** — renderer web.webdo24.cz/{slug} zobrazí web
4. **FINÁLNÍ VIZUÁLNÍ REDESIGN** — `01-master-prompt-redesign.md`
   (transformace funkčního webu na výjimečný vizuální zážitek;
   obsah, funkcionalita, SEO a data-content-id bindingy zůstávají)
5. **PRŮZKUM OBORU + APLIKACE** — `02-pruzkum-oboru-a-aplikace.md`
   (výzkum nejlepších webů v oboru zákazníka, analýza atraktivnosti,
   aplikace zjištění — konverzní vrstva: trust signaly, anxiety reducers)
6. **KNIHOVNA 20 PRVKŮ** — `03-knihovna-20-prvku.md`
   (každý web kombinuje 3–5 inovativních prvků; povinné M1 Google Maps
   a M2 lišta webdo24.cz na každém webu)
7. **MASTER DESIGN INTELLIGENCE** — `04-design-intelligence.md`
   (kompletní design-studio simulace: 17 fází P0–P16, 33 dimenzí DNA,
   18 teritorií, novelty ledger, 40 slop-lint kontrol, adverzní vizuální
   kritika, Sibling Test. TOTO JE POSLEDNÍ A NEJVYŠŠÍ PROMPT — při sporu
   s předchozími promptami má přednost jeho precedence §18)
8. **KONTROLA + SCHVÁLENÍ** — QA dle KONTROLA_WEBU.md, approval OWNERa
9. **NASAZENÍ** — publikace dle NASAZENI.md

## Pravidla všech dodatečných fází

- Obsah, funkcionalita, informační architektura a SEO zůstávají nedotčené
- data-content-id / data-content-type bindingy (editable binding) MUSÍ zůstat
- Vizuální design se může radikálně změnit
- Výstup: MEMORABLE + PREMIUM + DISTINCTIVE + HIGH-CONVERSION
- Publikace POUZE po explicitním schválení OWNERa

## Volitelná inspirace zákazníka (brief)

Zákazník MŮŽE (nikoli musí) uvést v briefu:

- `inspiration_url` — URL webu, který se mu líbí
- `inspiration_notes` — popis konkrétních prvků, které se mu líbí
  (barvy, typografie, layout, sekce, atmosféra...)

PRAVIDLA POUŽITÍ INSPIRACE:
1. Inspirace je VOLITELNÁ — nikdy se nevyžaduje, nikdy se nepokutuje její absence.
2. Inspirace je SMĚR, ne kopie. Převádí se na PRINCIPY („líbí se mi tmavá
   fotka v hero", „chci velkou serifovou typografii") — nikdy se nekopíruje
   layout, barvy 1:1 ani struktura cizího webu.
3. Inspirace NIKDY nepotlačuje systém originality (design DNA) — vždy musí
   projít stejnou validací originality jako web bez inspirace.
4. Pokud zákazník uvede URL konkurenta, použije se jen jako referenční
   negativ („takhle to dělat nechceme") nebo jako výchozí bod pro odlišení.
