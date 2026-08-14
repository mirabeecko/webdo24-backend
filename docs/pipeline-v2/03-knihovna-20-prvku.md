# KNIHOVNA 20 INOVATIVNÍCH WEBOVÝCH PRVKŮ (pipeline v2)

- Zařazení: PIPELINE V2 — návrhový systém originality (doplňuje web-design-dna-system)
- Účel: místo stále stejných komponent (trust bar, řádky služeb, FAQ accordion,
  recenze u formuláře, obří footer slovo) kombinovat INOVATIVNÍ prvky z této knihovny
- Pravidlo: každý web si vybere 3–5 prvků; ŽÁDNÉ dva weby nesmí mít stejnou
  kombinaci prvků (kontrola v registru DNA, dimenze "components")

---

## PRAVIDLA KOMBINACE

1. Každý web vybere MINIMÁLNĚ 3 a MAXIMÁLNĚ 5 prvků z knihovny.
2. Kombinace prvků se zapíše do design DNA (dimenze "components") a MUSÍ se
   lišit od všech aktivních webů v registru (žádný web nesmí sdílet >1 prvek
   s jiným webem).
3. Prvky se kombinují s ostatními dimenzemi DNA (hero, typografie, barvy...).
4. Prvek se přizpůsobuje art direction webu (barvy, tvarosloví, motion) —
   nikdy se nekopíruje 1:1 z jiného webu.
5. Konverzní vrstva (trust signaly, recenze u CTA, transparentnost) zůstává,
   ale její VIZUÁLNÍ podoba se řídí vybranými prvky.

---

## SEZNAM PRVKŮ

### P01 — Sticky side navigace s progress
Levý pevný panel s čísly sekcí (01–05) a scroll progress čárou. Kliknutí
skroluje na sekci. Na mobilu se mění na spodní progress proužek.
Vhodné: delší weby (8+ sekcí), B2B, profesionální služby.

### P02 — Scroll-driven horizontální sekce
Při scrollu se sekce posouvá do strany (pinned + translateX). Ideální pro
portfolio/projekty — karty se odkrývají postupně.
Vhodné: agentury, realizace, galerie, e-shop kategorie.

### P03 — Marquee text pás
Nekonečný běžící text (CSS animation) mezi sekcemi, např. „NOVOSTAVBY ·
REKONSTRUKCE · HALY ·" — rytmický přechod, editorialní charakter.
Vhodné: kreativní obory, stavebnictví, gastronomie, móda.

### P04 — Magnetic buttons
Tlačítka, která se jemně přitahují ke kurzoru (JS transform). Mikrointerakce,
která dělá UI „živé". Na mobilu bez efektu (není hover).
Vhodné: jakýkoliv web s CTA, kreativní agentury.

### P05 — Custom cursor
Vlastní kurzor (tečka + kroužek) s plynulým follow. Na interaktivních prvcích
se zvětšuje/rotuje. Pozor: a11y fallback (default cursor zachován), vypnout
na touch zařízeních a prefers-reduced-motion.
Vhodné: portfolio, kreativní weby, produkty.

### P06 — Count-up statistiky
Čísla, která se napočítají při scrollu do viewportu (IntersectionObserver +
rAF animace). „120+ realizací" ožije.
Vhodné: firmy s čísly (roky, projekty, klienti), SaaS.

### P07 — Before/After slider
Posuvník porovnání dvou fotek (před/po). Taháním (nebo drag) se odkrývá.
Vhodné: rekonstrukce, zubařství (úsměvy), kadeřnictví, hubnutí, interiéry.

### P08 — Parallax vrstvy
Pozadí a prvky se pohybují rozdílnou rychlostí při scrollu (transform + JS).
Jemná hloubka, ne kýč. GPU-friendly (transform, ne top/left).
Vhodné: hero, velké vizuální sekce, cestování, realitky.

### P09 — Text reveal po řádcích s maskou
Nadpisy se odkrývají řádek po řádku (overflow hidden + translateY).
Klasika, ale účinná — dělá typografii dramatickou.
Vhodné: hero, sekční nadpisy, editorial.

### P10 — Bento grid
Asymetrická mřížka různě velkých buněk (2fr/1fr mix) — kombinace textu,
fotek, čísel, CTA v jedné kompozici. Velmi „dnešní" layout.
Vhodné: služby, funkce, tým, reference.

### P11 — Tilt cards (3D náklon)
Karty se při hoveru naklápějí podle pozice kurzoru (perspective + rotateX/Y +
glare efekt). Poutavé, ale používat střídmě — jen na klíčových prvcích.
Vhodné: produktové karty, služby, ceník.

### P12 — Lightbox galerie
Kliknutí na fotku otevře fullscreen overlay s navigací (šipky, klávesnice,
ESC). Fotky zákazníka dostanou prostor.
Vhodné: realizace, portfolio, produkty, interiéry.

### P13 — Rozbalovací služby s fotkou
Accordion, kde otevřená položka zobrazí velkou fotku vedle textu (grid:
text | foto). Místo nudného seznamu služeb.
Vhodné: služby, ceník, produkty.

### P14 — Sticky CTA lišta (mobile)
Na mobilu přilepená spodní lišta s telefonem + CTA (zobrazí se po scrollu
za hero, skryje se u patičky). Zvyšuje konverzi na mobilu.
Vhodné: všechny weby s telefonem/objednáním (provozovny, služby).

### P15 — Scroll progress v hero
Tenká čára ukazující průběh čtením, ale stylizovaná do art direction
(v hero jako „měřidlo", přechází do další sekce).
Vhodné: dlouhé weby, editorial.

### P16 — Vertikální timeline
Časová osa (roky, milníky, kroky) s čísly a popisem, odkrývá se po scrollu.
Vhodné: historie firmy, postup práce, kariéra, vývoj produktu.

### P17 — Rotující velký citát
Jedna velká recenze, která se automaticky střídá (fade) s dalšími + autor.
Méně „mřížkovité" než karty recenzí.
Vhodné: reference, důvěra, luxusní služby.

### P18 — Hover image preview na odkazech
Když kurzor najede na odkaz (např. projekt), objeví se plovoucí náhled fotky,
která následuje kurzor. Velmi efektní u portfolií.
Vhodné: realizace, služby, menu.

### P19 — Sekce s přechodem barev
Sekce plynule přecházejí (gradient mezi barvami, vlnité SVG oddělovače,
kruhové „výseky") — místo tvrdého konce jedné a začátku druhé.
Vhodné: kreativní weby, wellness, móda.

### P20 — Fullscreen menu s obrázky
Mobilní/desktop menu na celou obrazovku, kde každý odkaz má malý náhled
fotky (hover zobrazí). Menu jako zážitek.
Vhodné: agentury, portfolio, restaurace, butiky.

---

## POVINNÉ PRVKY (NEJSOU SOUČÁSTÍ KOMBINACÍ — patří na KAŽDÝ web)

Tyto prvky nejsou „volitelné inovace", ale standard pipeline v2:

### M1 — Google Maps embed
Každá provozovna/obchod MUSÍ mít v kontaktní sekci vloženou mapu
(iframe Google Maps, ne jen odkaz):
```html
<iframe
  src="https://www.google.com/maps?q=ADRESA&output=embed"
  width="100%" height="320" style="border:0;border-radius:16px"
  loading="lazy" referrerpolicy="no-referrer-when-downgrade"
  title="Mapa — NÁZEV PROVOZOVNY" allowfullscreen></iframe>
```
- q= adresa URL-encoded (bez diakritiky klidně, Google si poradí)
- loading="lazy", height ~300–380px, border-radius dle art direction
- Umístění: kontaktní sekce, ideálně pod kontaktní údaje / vedle formuláře

### M2 — Spodní lišta „Web by webdo24.cz"
Patička KAŽDÉHO webu končí brandovou lištou WebDo24:
```html
<div class="webdo24-bar" style="
  background:#0f1a17;color:#8fa3a0;text-align:center;
  font-family:inherit;font-size:13px;padding:14px 20px;">
  Web vytvořil <a href="https://webdo24.cz" target="_blank"
  rel="noopener" style="color:#7fd1cf;font-weight:600;
  text-decoration:none;">webdo24.cz</a> — web do 24 hodin
</div>
```
- Tmavý pruh, decentní, vždy viditelný na konci stránky (pod copyrightem)
- Barvy: tmavé pozadí + tyrkysový odkaz (konzistentní značka WebDo24)
- Odkaz vede na https://webdo24.cz, target=_blank, rel=noopener

---

## REGISTR POUŽITÝCH KOMBINACÍ (doplňovat!)

| Web | Prvky (P-codes) | Povinné |
|---|---|---|
| zubni-ordinace-dvorakova (v3) | P09 (hero reveal) | M1, M2 |
| stavby-horak (v2) | P03 (marquee), P06 (count-up) | M1, M2 |
| rezidence-horizont (v1) | P14 (sticky CTA lišta mobile) + signature „Index ticha" (obloukové rámy + evidenční čísla RH-XXXX, vlastní prvek dle 04-design-intelligence) | M1, M2 |
| webdo24-brand-2026 (CIFERNÍK) | P15 (scroll progress stylizovaný jako živý SVG ciferník) + živé hodiny Praha | M1, M2 |
| penzion-komarka (v1) | P12 (lightbox galerie), P13 (accordion služeb s fotkou), P16 (timeline „Den v horách"), P17 (rotující citát recenzí) + signature „ELEVACE" (výškové štítky 425/540/1 020 m + vrstevnicové kontury) | M1, M2 |
| (další web) | ... | M1, M2 |

Pravidlo: žádný aktivní web nesmí sdílet >1 prvek z knihovny s jiným webem.
Povinné prvky (M1, M2) se nepočítají — jsou na všech.
