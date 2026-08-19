#!/usr/bin/env python3
"""Generate placeholder creative assets for the MadHive demo dashboard.

Real banner/email creatives do not exist for a made-up pizza chain, so we
render stand-ins locally rather than hot-linking a placeholder service — a demo
that 404s because someone else's image host went away is worse than no image.

The video creative is Big Buck Bunny (c) Blender Foundation, CC BY 3.0,
downloaded once and committed so nothing external is fetched at runtime.

Regenerate with:  python3 scripts/generate_creative_assets.py
"""
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "madhive-assets")
os.makedirs(OUT, exist_ok=True)

BRAND = "#2b3a2f"    # basil
ACCENT = "#e0561d"   # oven-fired orange
PAPER = "#f7f4ef"

CREATIVES = [
    # id,             w,   h,   eyebrow,         headline,             sub,                          cta
    ("dp-1", 300, 250, "FAMILY NIGHT",  "2 large + sides",    "$26 until Sunday",            "Order now"),
    ("dp-2", 728,  90, "EVERY TUESDAY", "Two for Tuesday",    "Second pizza half price",     "Order now"),
    ("dp-3", 300, 600, "STILL HUNGRY?", "Your cart's waiting","We kept it for 24 hours",     "Finish your order"),
    ("dp-4", 300, 250, "NEW",           "Detroit-style",      "Crispy edge, thick crust",    "Try a square"),
    ("em-1", 600, 300, "EVERY TUESDAY", "Two for Tuesday",    "Second pizza half price, all day", "Order for tonight"),
    ("em-2", 600, 300, "WE MISS YOU",   "It's been a month",  "Here's $5 off your next order",    "Come back for a slice"),
]

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def render(cid, w, h, eyebrow, headline, sub, cta):
    wide = w > h * 2                      # leaderboard
    tall = h > w * 1.5                    # skyscraper
    pad = 14 if wide else 20
    if wide:
        hl, sl, el, cl = 22, 12, 9, 12
        hy, sy, ey = h / 2 + 2, h / 2 + 20, h / 2 - 18
        cta_w, cta_h = 150, 30
        cta_x, cta_y = w - cta_w - pad, (h - cta_h) / 2
        anchor, tx = "start", pad
    else:
        hl, sl, el, cl = (30 if not tall else 27), 14, 10, 13
        ey, hy, sy = pad + 26, pad + 62, pad + 88
        cta_w, cta_h = w - pad * 2, 40
        cta_x, cta_y = pad, h - cta_h - pad
        anchor, tx = "start", pad
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{esc(headline)} — placeholder creative">
  <defs>
    <linearGradient id="g{cid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{BRAND}"/><stop offset="100%" stop-color="#44583c"/>
    </linearGradient>
  </defs>
  <rect width="{w}" height="{h}" fill="{PAPER}"/>
  <rect width="{w}" height="{h}" fill="url(#g{cid})"/>
  <circle cx="{w * 0.86:.0f}" cy="{h * 0.18:.0f}" r="{max(w, h) * 0.30:.0f}" fill="#ffffff" opacity="0.05"/>
  <circle cx="{w * 0.12:.0f}" cy="{h * 0.92:.0f}" r="{max(w, h) * 0.22:.0f}" fill="#ffffff" opacity="0.04"/>
  <text x="{tx}" y="{ey}" text-anchor="{anchor}" font-family="Inter, system-ui, sans-serif"
    font-size="{el}" font-weight="700" letter-spacing="1.6" fill="{ACCENT}">{esc(eyebrow)}</text>
  <text x="{tx}" y="{hy}" text-anchor="{anchor}" font-family="Inter, system-ui, sans-serif"
    font-size="{hl}" font-weight="800" fill="#ffffff">{esc(headline)}</text>
  <text x="{tx}" y="{sy}" text-anchor="{anchor}" font-family="Inter, system-ui, sans-serif"
    font-size="{sl}" font-weight="500" fill="#ffffff" opacity="0.72">{esc(sub)}</text>
  <rect x="{cta_x:.0f}" y="{cta_y:.0f}" width="{cta_w:.0f}" height="{cta_h:.0f}" rx="4" fill="{ACCENT}"/>
  <text x="{cta_x + cta_w / 2:.0f}" y="{cta_y + cta_h / 2 + 4:.0f}" text-anchor="middle"
    font-family="Inter, system-ui, sans-serif" font-size="{cl}" font-weight="700" fill="#ffffff">{esc(cta)}</text>
  <text x="{w - 6}" y="{h - 6}" text-anchor="end" font-family="ui-monospace, monospace"
    font-size="8" fill="#ffffff" opacity="0.45">PLACEHOLDER · {w}x{h}</text>
</svg>
"""

for c in CREATIVES:
    path = os.path.join(OUT, f"creative-{c[0]}.svg")
    with open(path, "w") as f:
        f.write(render(*c))
    print(f"  {os.path.relpath(path)}  ({c[1]}x{c[2]})")

# Poster frame for the video creatives.
poster = f"""<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img" aria-label="Video creative poster frame">
  <rect width="640" height="360" fill="{BRAND}"/>
  <circle cx="540" cy="60" r="150" fill="#ffffff" opacity="0.05"/>
  <text x="28" y="52" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="700"
    letter-spacing="1.8" fill="{ACCENT}">BELLA VITA PIZZA</text>
  <text x="28" y="98" font-family="Inter, system-ui, sans-serif" font-size="38" font-weight="800" fill="#ffffff">Fresh out the oven</text>
  <text x="28" y="128" font-family="Inter, system-ui, sans-serif" font-size="15" fill="#ffffff" opacity="0.72">hot at your door in 20 minutes</text>
  <circle cx="320" cy="232" r="34" fill="#ffffff" opacity="0.92"/>
  <path d="M 310 214 L 340 232 L 310 250 Z" fill="{BRAND}"/>
  <text x="632" y="350" text-anchor="end" font-family="ui-monospace, monospace" font-size="9"
    fill="#ffffff" opacity="0.45">PLACEHOLDER · 640x360</text>
</svg>
"""
with open(os.path.join(OUT, "video-poster.svg"), "w") as f:
    f.write(poster)
print("  public/madhive-assets/video-poster.svg  (640x360)")
print("\nVideo file is committed separately: video-creative.mp4")
print("  Big Buck Bunny (c) Blender Foundation, CC BY 3.0")
