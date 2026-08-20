#!/usr/bin/env python3
"""Placeholder creatives for /madhive/v2, rendered locally at their real sizes.

Nothing is fetched at runtime -- a demo that 404s because someone else's
placeholder host went away is worse than no image.

The video file is Big Buck Bunny (c) Blender Foundation, CC BY 3.0.
"""
import os
import shutil

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
    ("cr-01", 300, 250, "FAMILY BUNDLE", "Two larges,\nbreadsticks, soda", "$26", "Order now"),
    ("cr-02", 728,  90, "EVERY TUESDAY", "Second pizza half price", "2 for 1", "Order now"),
    ("cr-03", 300, 600, "NEW", "Detroit-style,\ncrispy edge", "Now baking", "Try a square"),
    ("cr-04", 300, 250, "STILL HUNGRY?", "Your cart is\nwaiting", "24 hrs", "Finish order"),
    ("cr-05", 160, 600, "STILL WARM", "Fresh from\nthe oven", "20 min", "Order"),
    ("cr-06", 600, 900, "EVERY TUESDAY", "Second pizza half price,\nall day, all shops", "2 for 1", "Order for tonight"),
    ("cr-07", 600, 900, "COME BACK", "It has been a while.\nHere is a slice on us", "Free slice", "See the deal"),
    ("cr-08", 600, 750, "WE MISS YOU", "Take $5 off your\nnext order", "$5 off", "Redeem"),
]

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
