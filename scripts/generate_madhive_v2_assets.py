#!/usr/bin/env python3
"""Placeholder creatives for /madhive/v2, rendered locally at their real sizes.

Nothing is fetched at runtime -- a demo that 404s because someone else's
placeholder host went away is worse than no image.

The video file is Big Buck Bunny (c) Blender Foundation, CC BY 3.0.
"""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from madhive_v2_email_layout import COPY, SECTIONS  # noqa: E402

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "public", "madhive-v2-assets")
SRC = os.path.join(HERE, "..", "public", "madhive-assets", "video-creative.mp4")
os.makedirs(OUT, exist_ok=True)

INK = "#12161d"
CRUST = "#e8c07d"
SAUCE = "#e8543f"
BASIL = "#5fb87a"
PAPER = "#faf6ef"

CREATIVES = [
    # id,             w,   h,   eyebrow,         headline,             badge,      cta
    ("cr-01", 300, 250, "FAMILY BUNDLE", "Two larges,\nbreadsticks, soda", "$26", "Order now"),
    ("cr-02", 728,  90, "EVERY TUESDAY", "Second pizza half price", "2 for 1", "Order now"),
    ("cr-03", 300, 600, "NEW", "Detroit-style,\ncrispy edge", "Now baking", "Try a square"),
    ("cr-04", 300, 250, "STILL HUNGRY?", "Your cart is\nwaiting", "24 hrs", "Finish order"),
    ("cr-05", 160, 600, "STILL WARM", "Fresh from\nthe oven", "20 min", "Order"),
]

# id -> (w, h). Emails get the sectioned renderer below.
EMAILS = {"cr-06": (600, 900), "cr-07": (600, 900), "cr-08": (600, 750)}

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def render(cid, w, h, eyebrow, body, badge, cta):
    wide = w > h * 2
    narrow = w < 200
    pad = 10 if narrow else 16 if wide else 22
    lines = body.split("\n")
    if wide:
        el, bl, gl, cl = 9, 19, 26, 12
        ey, by = h / 2 - 12, h / 2 + 12
        cta_w, cta_h = 132, 30
        cta_x, cta_y = w - cta_w - pad, (h - cta_h) / 2
        badge_x, badge_y, badge_r = w - cta_w - pad - 78, h / 2, 30
    else:
        el = 8 if narrow else 10
        bl = 13 if narrow else 17 if w < 400 else 23
        gl = 26 if narrow else 34 if w < 400 else 52
        cl = 10 if narrow else 12 if w < 400 else 15
        ey = pad + 16
        by = pad + 48 if not narrow else pad + 38
        cta_w, cta_h = w - pad * 2, 30 if narrow else 38 if w < 400 else 52
        cta_x, cta_y = pad, h - cta_h - pad
        badge_x, badge_y = w / 2, h * (0.52 if h > 400 else 0.62)
        badge_r = min(w, h) * (0.19 if h > 400 else 0.22)
    body_svg = "".join(
        f'<text x="{pad}" y="{by + i * (bl + 4):.0f}" font-family="Inter, system-ui, sans-serif" '
        f'font-size="{bl}" font-weight="600" fill="{PAPER}" opacity="0.88">{esc(l)}</text>'
        for i, l in enumerate(lines))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{esc(badge)} — placeholder creative, {w} by {h}">
  <defs><linearGradient id="g{cid}" x1="0" y1="0" x2="0.7" y2="1">
    <stop offset="0%" stop-color="{INK}"/><stop offset="100%" stop-color="#26313f"/>
  </linearGradient></defs>
  <rect width="{w}" height="{h}" fill="url(#g{cid})"/>
  <circle cx="{badge_x:.0f}" cy="{badge_y:.0f}" r="{badge_r:.0f}" fill="{SAUCE}" opacity="0.16"/>
  <circle cx="{badge_x:.0f}" cy="{badge_y:.0f}" r="{badge_r * 0.72:.0f}" fill="none" stroke="{CRUST}" stroke-width="1.5" opacity="0.5"/>
  <text x="{badge_x:.0f}" y="{badge_y + gl * 0.34:.0f}" text-anchor="middle" font-family="Inter, system-ui, sans-serif"
    font-size="{gl}" font-weight="800" fill="{CRUST}">{esc(badge)}</text>
  <text x="{pad}" y="{ey:.0f}" font-family="Inter, system-ui, sans-serif" font-size="{el}"
    font-weight="700" letter-spacing="1.7" fill="{BASIL}">{esc(eyebrow)}</text>
  {body_svg}
  <rect x="{cta_x:.0f}" y="{cta_y:.0f}" width="{cta_w:.0f}" height="{cta_h:.0f}" rx="4" fill="{SAUCE}"/>
  <text x="{cta_x + cta_w / 2:.0f}" y="{cta_y + cta_h / 2 + cl * 0.36:.0f}" text-anchor="middle"
    font-family="Inter, system-ui, sans-serif" font-size="{cl}" font-weight="700" fill="#ffffff">{esc(cta)}</text>
  <text x="{w - 5}" y="{h - 5}" text-anchor="end" font-family="ui-monospace, monospace"
    font-size="7.5" fill="{PAPER}" opacity="0.4">ELITE PIZZA · {w}x{h}</text>
</svg>
"""

for c in CREATIVES:
    with open(os.path.join(OUT, f"{c[0]}.svg"), "w") as f:
        f.write(render(*c))
    print(f"  {c[0]}.svg  {c[1]}x{c[2]}")

def render_email(cid, w, h):
    """One band per section, drawn from the shared spec so the dashboard's
    leader lines land on the band they name."""
    c = COPY[cid]
    box = {k: (x * w, y * h, bw * w, bh * h) for k, _l, x, y, bw, bh in SECTIONS}
    parts = [
        f'<rect width="{w}" height="{h}" fill="{PAPER}"/>',
    ]

    # header ---------------------------------------------------------------
    hx, hy, hw, hh = box["header"]
    parts += [
        f'<rect x="0" y="{hy:.0f}" width="{hw:.0f}" height="{hh:.0f}" fill="{INK}"/>',
        f'<text x="22" y="{hy + hh * 0.63:.0f}" font-family="Inter, sans-serif" font-size="17" '
        f'font-weight="800" letter-spacing="1.4" fill="{CRUST}">ELITE PIZZA</text>',
        f'<text x="{w - 22}" y="{hy + hh * 0.63:.0f}" text-anchor="end" font-family="Inter, sans-serif" '
        f'font-size="11" fill="{PAPER}" opacity="0.6">Menu   Deals   Locations</text>',
    ]

    # hero -----------------------------------------------------------------
    x, y, bw, bh = box["hero"]
    parts += [
        f'<rect x="0" y="{y:.0f}" width="{bw:.0f}" height="{bh:.0f}" fill="#26313f"/>',
        f'<circle cx="{w * 0.82:.0f}" cy="{y + bh * 0.42:.0f}" r="{bh * 0.36:.0f}" fill="{SAUCE}" opacity="0.18"/>',
        f'<text x="26" y="{y + 34:.0f}" font-family="Inter, sans-serif" font-size="11" font-weight="700" '
        f'letter-spacing="2" fill="{BASIL}">{esc(c["eyebrow"])}</text>',
        f'<text x="26" y="{y + bh * 0.44:.0f}" font-family="Inter, sans-serif" font-size="40" '
        f'font-weight="800" fill="{CRUST}">{esc(c["hero_head"])}</text>',
        f'<text x="26" y="{y + bh * 0.60:.0f}" font-family="Inter, sans-serif" font-size="15" '
        f'fill="{PAPER}" opacity="0.8">{esc(c["hero_sub"])}</text>',
        f'<rect x="26" y="{y + bh * 0.70:.0f}" width="196" height="44" rx="4" fill="{SAUCE}"/>',
        f'<text x="124" y="{y + bh * 0.70 + 28:.0f}" text-anchor="middle" font-family="Inter, sans-serif" '
        f'font-size="14" font-weight="700" fill="#ffffff">{esc(c["hero_cta"])}</text>',
    ]

    # menu grid ------------------------------------------------------------
    x, y, bw, bh = box["menu"]
    parts.append(f'<rect x="0" y="{y:.0f}" width="{bw:.0f}" height="{bh:.0f}" fill="{PAPER}"/>')
    parts.append(f'<text x="26" y="{y + 30:.0f}" font-family="Inter, sans-serif" font-size="11" '
                 f'font-weight="700" letter-spacing="2" fill="{INK}" opacity="0.55">TONIGHT\u2019S PICKS</text>')
    gap, pad = 14, 26
    tw = (w - pad * 2 - gap * 2) / 3
    for i, name in enumerate(c["menu"]):
        tx = pad + i * (tw + gap)
        ty = y + 44
        th = bh - 60
        parts += [
            f'<rect x="{tx:.0f}" y="{ty:.0f}" width="{tw:.0f}" height="{th:.0f}" rx="5" fill="#ece5d8"/>',
            f'<circle cx="{tx + tw / 2:.0f}" cy="{ty + th * 0.40:.0f}" r="{th * 0.24:.0f}" fill="{CRUST}"/>',
            f'<circle cx="{tx + tw / 2:.0f}" cy="{ty + th * 0.40:.0f}" r="{th * 0.17:.0f}" fill="{SAUCE}" opacity="0.75"/>',
            f'<text x="{tx + tw / 2:.0f}" y="{ty + th * 0.76:.0f}" text-anchor="middle" '
            f'font-family="Inter, sans-serif" font-size="12" font-weight="700" fill="{INK}">{esc(name)}</text>',
            f'<text x="{tx + tw / 2:.0f}" y="{ty + th * 0.92:.0f}" text-anchor="middle" '
            f'font-family="Inter, sans-serif" font-size="11" fill="{INK}" opacity="0.6">Order</text>',
        ]

    # coupon ---------------------------------------------------------------
    x, y, bw, bh = box["coupon"]
    parts += [
        f'<rect x="0" y="{y:.0f}" width="{bw:.0f}" height="{bh:.0f}" fill="#f1e7d5"/>',
        f'<rect x="26" y="{y + 18:.0f}" width="{w - 52:.0f}" height="{bh - 36:.0f}" rx="6" '
        f'fill="none" stroke="{SAUCE}" stroke-width="2" stroke-dasharray="7 6"/>',
        f'<text x="46" y="{y + bh * 0.42:.0f}" font-family="Inter, sans-serif" font-size="19" '
        f'font-weight="800" fill="{INK}">{esc(c["coupon_head"])}</text>',
        f'<text x="46" y="{y + bh * 0.64:.0f}" font-family="ui-monospace, monospace" font-size="13" '
        f'fill="{INK}" opacity="0.65">CODE {esc(c["coupon_code"])}</text>',
        f'<rect x="{w - 200:.0f}" y="{y + bh * 0.36:.0f}" width="154" height="40" rx="4" fill="{INK}"/>',
        f'<text x="{w - 123:.0f}" y="{y + bh * 0.36 + 25:.0f}" text-anchor="middle" '
        f'font-family="Inter, sans-serif" font-size="13" font-weight="700" fill="{CRUST}">{esc(c["coupon_cta"])}</text>',
    ]

    # footer ---------------------------------------------------------------
    x, y, bw, bh = box["footer"]
    parts += [
        f'<rect x="0" y="{y:.0f}" width="{bw:.0f}" height="{bh:.0f}" fill="{INK}"/>',
        f'<text x="{w / 2:.0f}" y="{y + bh * 0.30:.0f}" text-anchor="middle" font-family="Inter, sans-serif" '
        f'font-size="14" font-weight="700" fill="{CRUST}">{esc(c["footer"])}</text>',
    ]
    for i in range(3):
        parts.append(f'<circle cx="{w / 2 - 34 + i * 34:.0f}" cy="{y + bh * 0.55:.0f}" r="11" '
                     f'fill="{PAPER}" opacity="0.18"/>')
    parts.append(f'<text x="{w / 2:.0f}" y="{y + bh * 0.84:.0f}" text-anchor="middle" '
                 f'font-family="Inter, sans-serif" font-size="10" fill="{PAPER}" opacity="0.45">'
                 f'Unsubscribe   ·   Preferences   ·   View in browser</text>')

    parts.append(f'<text x="{w - 6}" y="{h - 6}" text-anchor="end" font-family="ui-monospace, monospace" '
                 f'font-size="8" fill="{PAPER}" opacity="0.35">ELITE PIZZA · {w}x{h}</text>')
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" '
            'role="img" aria-label="%s — placeholder email creative">%s</svg>\n'
            % (w, h, w, h, esc(c["hero_head"]), "".join(parts)))


for cid, (w, h) in EMAILS.items():
    with open(os.path.join(OUT, f"{cid}.svg"), "w") as f:
        f.write(render_email(cid, w, h))
    print(f"  {cid}.svg  {w}x{h}  ({len(SECTIONS)} sections)")

poster = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-label="Video creative poster frame">
  <defs><linearGradient id="vp" x1="0" y1="0" x2="0.6" y2="1">
    <stop offset="0%" stop-color="{INK}"/><stop offset="100%" stop-color="#26313f"/>
  </linearGradient></defs>
  <rect width="1280" height="720" fill="url(#vp)"/>
  <circle cx="1040" cy="180" r="300" fill="{SAUCE}" opacity="0.12"/>
  <text x="64" y="112" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="700"
    letter-spacing="4" fill="{BASIL}">ELITE PIZZA</text>
  <text x="64" y="204" font-family="Inter, system-ui, sans-serif" font-size="76" font-weight="800" fill="{CRUST}">Fresh out the oven</text>
  <text x="64" y="262" font-family="Inter, system-ui, sans-serif" font-size="30" fill="{PAPER}" opacity="0.75">hot at your door in 20 minutes</text>
  <circle cx="640" cy="470" r="62" fill="{PAPER}" opacity="0.92"/>
  <path d="M 620 436 L 678 470 L 620 504 Z" fill="{INK}"/>
  <text x="1264" y="706" text-anchor="end" font-family="ui-monospace, monospace" font-size="16"
    fill="{PAPER}" opacity="0.4">ELITE PIZZA · 1280x720</text>
</svg>
"""
with open(os.path.join(OUT, "video-poster.svg"), "w") as f:
    f.write(poster)
print("  video-poster.svg  1280x720")
shutil.copyfile(SRC, os.path.join(OUT, "video-creative.mp4"))
print("  video-creative.mp4  (Big Buck Bunny, (c) Blender Foundation, CC BY 3.0)")
