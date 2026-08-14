#!/usr/bin/env python3
"""
VALIDACE ORIGINALITY — pipeline v2 (skill: web-design-dna-system)

Analyzuje HTML webu, přiřadí varianty 7 dimenzí design DNA a porovná
s registrem realizací. Pravidlo: min. 5 ze 7 dimenzí ODLIŠNÝCH od každého
existujícího webu (max 2 sdílené) + zákaz identických zakázaných kombinací.

Použití:
  python3 validate-design-dna.py --web <cesta/k/web.html> [--name <nazev>]
  (registr se čte z docs/pipeline-v2/design-dna-registry.json)
"""
import argparse
import json
import re
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
DEFAULT_REGISTRY = BACKEND / "docs" / "pipeline-v2" / "design-dna-registry.json"

# Zakázané kombinace: pokud dva weby sdílí TYTO dvě dimenze zároveň → FAIL i při jinak 5+ odlišných
FORBIDDEN_PAIRS = [
    ("hero", "footer"),
    ("services", "footer"),
]

# Klasifikátory dimenzí — hledají signatury v HTML/CSS
def detect_dna(html: str) -> dict:
    css = html
    # extrahuj <style> bloky pro analýzu CSS
    style_blocks = re.findall(r"<style>(.*?)</style>", html, re.S)
    css = "\n".join(style_blocks)
    text = re.sub(r"<[^>]+>", " ", html)

    dna = {}

    # DIM 3 — barvy: primární akcent podle CSS proměnných / hex hodnot
    colors = "unknown"
    if re.search(r"#0e7c7b|--teal:#0e7c7b|rgb\(14, ?124, ?123\)", css, re.I):
        colors = "C1"
    elif re.search(r"#e8590c|--orange:#e8590c|rgb\(232, ?89, ?12\)", css, re.I):
        colors = "C2"
    elif re.search(r"#2d5a27|#3a5f0b|--forest|#1f401b", css, re.I):
        colors = "C5"
    elif re.search(r"#b08d57|#b8860b|--accent:#b0|--gold|--mosaz", css, re.I):
        colors = "C6"
    elif re.search(r"#0a0a0a.*#ccff00|--acid|--neon", css, re.I):
        colors = "C7"
    elif re.search(r"#f7e8e0|#fdeef2|--pastel", css, re.I):
        colors = "C8"
    elif re.search(r"#c1694f|#b76e5a|--terracotta", css, re.I):
        colors = "C9"
    dna["colors"] = colors

    # DIM 2 — typografie: display font podle font-family v CSS
    typo = "unknown"
    if re.search(r"Fraunces|Playfair|Canela", css, re.I):
        typo = "T1"
    elif re.search(r"Bodoni Moda|Cormorant|Didot", css, re.I):
        typo = "T1b"  # didone display — serif family, jiná větev než T1
    elif re.search(r"Archivo|Anton|Montserrat", css, re.I) and not re.search(r"Bodoni|Fraunces", css, re.I):
        typo = "T2"
    elif re.search(r"font-family:[^;]*(Inter|Space Grotesk)[^;]*;", css, re.I) and not re.search(r"Archivo|Fraunces|Poppins|Mono", css, re.I):
        typo = "T3"
    elif re.search(r"JetBrains Mono|IBM Plex Mono|monospace", css, re.I):
        typo = "T4"
    elif re.search(r"Roboto Slab|Libre Caslon", css, re.I):
        typo = "T5"
    elif re.search(r"Source Sans|IBM Plex Sans", css, re.I):
        typo = "T6"
    elif re.search(r"Poppins|Outfit|Circular", css, re.I):
        typo = "T7"
    dna["typography"] = typo

    # DIM 1 — HERO archetyp (pořadí: specifické vzory PŘED obecnými)
    hero = "unknown"
    if re.search(r"\.hero-visual|tooth-card|float-chip|hero-img|hero-card", css, re.I) or re.search(r'class="[^"]*hero-visual[^"]*"', html):
        hero = "H1"  # split + vizuální karta
    elif re.search(r"hero-bg|hero.*background-image|\.hero\{[^}]*url\(", css, re.I) or re.search(r'class="[^"]*hero-bg[^"]*"', html):
        hero = "H2"  # full-bleed fotka
    elif re.search(r"\.hero h1\{[^}]*font-size:clamp\([^)]*1[05]vw", css, re.I):
        hero = "H3"  # typography-led obří
    elif re.search(r"hero.*grid-template-columns:1\.\d+fr \.?\.?\d+fr", css, re.I) and re.search(r"hero.*img|hero.*photo", css, re.I):
        hero = "H4"
    elif re.search(r"\.hero\{[^}]*text-align:center", css, re.I):
        hero = "H6"
    dna["hero"] = hero

    # DIM 4 — služby
    svc = "unknown"
    if re.search(r"svc-row|service-row|\.svc-list", css, re.I):
        svc = "S1"
    elif re.search(r"\.svc-panel|\.svc-card|\.service-card|services-grid[^}]*grid-template-columns|svc-grid", css, re.I):
        svc = "S2"
    elif re.search(r"service-acc|\.svc-accordion", css, re.I):
        svc = "S3"
    elif re.search(r"\.svc-num|service.*text-stroke|panel-num|svc-panel \.idx", css, re.I):
        svc = "S4"
    elif re.search(r"price-table|\.pricing-table|cenik", css, re.I):
        svc = "S5"
    elif re.search(r"services.*overflow-x:auto|svc-track", css, re.I):
        svc = "S6"
    elif re.search(r"bento", css, re.I):
        svc = "S7"
    elif re.search(r"svc-img|service-image", css, re.I):
        svc = "S8"
    dna["services"] = svc

    # DIM 5 — reference
    refs = "unknown"
    if re.search(r"ref-track|testimonial-track|overflow-x:auto", css, re.I):
        refs = "R1"
    elif re.search(r"ref-grid|ref-card", css, re.I):
        refs = "R2"
    elif re.search(r"ref-quote|big-quote|editorial-quote|ref-row.*q\b|\.r-body q", css, re.I):
        refs = "R3"
    elif re.search(r"marquee", css, re.I):
        refs = "R4"
    elif re.search(r"masonry", css, re.I):
        refs = "R5"
    elif re.search(r"ref-num|carousel.*num", css, re.I):
        refs = "R6"
    elif re.search(r"arch-frame|o-idx|prop-index|o-body", css, re.I):
        refs = "R8"  # katalog s evidenčními čísly + obloukové rámy
    dna["references"] = refs

    # DIM 6 — footer
    foot = "unknown"
    if re.search(r"foot-giant|footer.*text-stroke", css, re.I):
        foot = "F1"
    elif re.search(r"foot-manifesto|closing_manifesto|foot-cta", css, re.I):
        foot = "F2b"  # závěrečné prohlášení / velký CTA
    elif re.search(r"foot-logo|footer.*monogram|\.foot-giant-logo", css, re.I):
        foot = "F3"
    elif re.search(r"foot-cols|footer.*columns", css, re.I):
        foot = "F4"
    elif re.search(r"foot-min|footer.*single-line", css, re.I):
        foot = "F5"
    elif re.search(r"foot-marquee", css, re.I):
        foot = "F6"
    dna["footer"] = foot

    # DIM 7 — motion
    motion = "unknown"
    if re.search(r"prefers-reduced-motion", css, re.I):
        if re.search(r"lineUp|\.line > span|animation:lineUp", css, re.I):
            motion = "M2"
        elif re.search(r"parallax|scroll-driven", css, re.I):
            motion = "M3"
        elif re.search(r"clip-path", css, re.I):
            motion = "M4"
        elif re.search(r"magnetic|spring", css, re.I):
            motion = "M5"
        elif re.search(r"\.rv|IntersectionObserver|reveal", css, re.I):
            motion = "M1"
        elif re.search(r"@keyframes|animation:", css, re.I):
            motion = "M6"
        else:
            motion = "M7"  # static_by_design — reduced-motion je, ale žádné keyframes
    elif re.search(r"@keyframes\s+marquee|marquee.*animation", css, re.I):
        motion = "M1"
    dna["motion"] = motion

    return dna


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--web", required=True, help="Cesta k HTML webu")
    ap.add_argument("--name", default=None, help="Název webu (pro výstup)")
    ap.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    args = ap.parse_args()

    html = Path(args.web).read_text(encoding="utf-8")
    name = args.name or Path(args.web).stem

    try:
        registry = json.loads(Path(args.registry).read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"CHYBA: registr nenalezen: {args.registry}")
        sys.exit(2)

    dna = detect_dna(html)
    print(f"=== DESIGN DNA: {name} ===")
    for dim, variant in dna.items():
        print(f"  {dim:12s} {variant}")

    print("\n=== POROVNÁNÍ S REGISTREM (jen aktivní weby) ===")
    failures = []
    active_sites = [s for s in registry.get("websites", []) if s.get("status", "active") != "archived"]
    if not active_sites:
        print("  (registr neobsahuje žádné aktivní weby — první realizace, OK)")
    for site in active_sites:
        if site.get("name") == name:
            continue  # web už je v registru = byl už validován; validace probíhá před zápisem
        existing = site["dna"]
        shared = [d for d in dna if dna.get(d) != "unknown" and dna.get(d) == existing.get(d)]
        shared_pairs = list(zip(shared, [dna.get(d) for d in shared]))
        # zakázané kombinace
        for a, b in FORBIDDEN_PAIRS:
            if a in shared and b in shared:
                failures.append(f"ZAKÁZANÁ KOMBINACE s '{site['name']}': {a}+{b}")
        status = "OK" if len(shared) <= 2 and not any(a in shared and b in shared for a, b in FORBIDDEN_PAIRS) else "FAIL"
        if status == "FAIL":
            failures.append(f"Web '{site['name']}' (obor: {site.get('industry','?')}): {len(shared)} sdílených dimenzí — {', '.join(shared) or 'žádné detekované'}")
        print(f"  {status:4s} vs {site['name']:35s} sdíleno: {len(shared)} ({', '.join(shared) or '-'})")

    print()
    if failures:
        print("VERDIKT: FAIL — web NENÍ originální vůči registru:")
        for f in failures:
            print(f"  ✗ {f}")
        print("\nDoporučení: změňte dimenze dle skillu web-design-dna-system")
        print("(např. jiný footer archetyp, jinou prezentaci služeb, jiný motion).")
        sys.exit(1)
    else:
        print("VERDIKT: OK — web je originální (≤2 sdílené dimenze s každou realizací)")
        print("\nZapište tuto DNA do registru: docs/pipeline-v2/design-dna-registry.json")


if __name__ == "__main__":
    main()
