#!/usr/bin/env python3
"""Dataset for the Elite Pizza ad-performance dashboard (/madhive/v2).

One source of truth: daily rows at (date x campaign) grain. Everything else --
geo, device, demographics, creatives, placements -- is stored as a *share* of
its campaign, so any filter the UI applies re-derives them consistently. A
breakdown can never disagree with the total it belongs to.

Regenerate with:  python3 scripts/generate_madhive_v2_data.py
"""
import json
import math
import os
import random
from datetime import date, timedelta

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data", "madhive-v2.json")
random.seed(1509)

DAYS = 180
WINDOW = 90                       # default selection: the last 90 days
START = date(2026, 2, 20)

MEDIA = [
    dict(key="display", label="Display", color="#58a6ff"),
    dict(key="email",   label="Email",   color="#e3b341"),
    dict(key="video",   label="Online video", color="#f778ba"),
]

# Deliberately seeded so the three media types tell different stories:
# display buys clicks that do not convert, email converts the few clicks it
# gets, video barely clicks at all yet carries its weight in conversions.
CAMPAIGNS = [
    dict(id="c-dp-1", name="Summer Slice Prospecting", mediaType="display",
         impressions=3_900_000, clicks=13_300, conversions=165, spend=19_100),
    dict(id="c-dp-2", name="Cart Abandon Retarget", mediaType="display",
         impressions=2_300_000, clicks=8_400, conversions=135, spend=11_900),
    dict(id="c-em-1", name="Two for Tuesday", mediaType="email",
         impressions=340_000, clicks=7_300, conversions=980, spend=8_300),
    dict(id="c-em-2", name="Win-Back 60 Day", mediaType="email",
         impressions=200_000, clicks=4_000, conversions=540, spend=5_200),
    dict(id="c-vd-1", name="Fresh Out The Oven", mediaType="video",
         impressions=800_000, clicks=2_050, conversions=610, spend=20_000),
    dict(id="c-vd-2", name="Family Night", mediaType="video",
         impressions=500_000, clicks=1_200, conversions=370, spend=12_500),
]

# ------------------------------------------------------------------- daily
def shape(seed, i, media):
    weekly = [1.02, 0.96, 0.94, 0.98, 1.05, 1.16, 1.19][i % 7]
    drift = {"display": 1 - i * 0.0016, "email": 1 + i * 0.0009, "video": 1 + i * 0.0035}[media]
    wobble = 1 + 0.07 * math.sin(i * 1.31 + seed) + 0.04 * math.cos(i * 0.47 + seed)
    base = weekly * drift * wobble
    if media == "email":                       # email lands on send days only
        base *= 1.0 if i % 7 in (1, 4) else 0.10
    return max(base, 0.02)

daily = []
for ci, c in enumerate(CAMPAIGNS):
    w_imp = [shape(ci * 1.7, i, c["mediaType"]) for i in range(DAYS)]
    # clicks and conversions get their own wobble, or every rate is a flat line
    w_clk = [w * (1 + 0.11 * math.sin(i * 0.83 + ci)) for i, w in enumerate(w_imp)]
    w_cnv = [w * (1 + 0.17 * math.sin(i * 0.61 + ci * 2.1) + 0.08 * math.cos(i * 1.9)) for i, w in enumerate(w_imp)]
    w_spd = [w * (1 + 0.05 * math.cos(i * 1.11 + ci)) for i, w in enumerate(w_imp)]
    n = {k: sum(v[DAYS - WINDOW:]) for k, v in
         dict(imp=w_imp, clk=w_clk, cnv=w_cnv, spd=w_spd).items()}
    for i in range(DAYS):
        daily.append(dict(
            date=(START + timedelta(days=i)).isoformat(),
            campaign=c["id"],
            impressions=round(c["impressions"] * w_imp[i] / n["imp"]),
            clicks=round(c["clicks"] * w_clk[i] / n["clk"]),
            conversions=round(c["conversions"] * w_cnv[i] / n["cnv"], 2),
            spend=round(c["spend"] * w_spd[i] / n["spd"], 2),
        ))

# -------------------------------------------------------------- breakdowns
def norm(d):
    t = sum(d.values())
    return {k: round(v / t, 4) for k, v in d.items()}

DEVICE_SPLIT = {          # impressions / clicks / conversions each get a share
    "display": dict(Mobile=(0.63, 0.68, 0.55), Desktop=(0.27, 0.24, 0.36), Tablet=(0.10, 0.08, 0.09)),
    "email":   dict(Mobile=(0.71, 0.66, 0.52), Desktop=(0.22, 0.28, 0.42), Tablet=(0.07, 0.06, 0.06)),
    "video":   dict(Mobile=(0.48, 0.55, 0.41), Desktop=(0.39, 0.35, 0.49), Tablet=(0.13, 0.10, 0.10)),
}
devices = [
    dict(campaign=c["id"], device=dev,
         impressionShare=v[0], clickShare=v[1], conversionShare=v[2])
    for c in CAMPAIGNS for dev, v in DEVICE_SPLIT[c["mediaType"]].items()
]

DEMOS = {
    "display": dict(
        income=[("Under $50k", .31), ("$50-75k", .27), ("$75-100k", .21), ("$100-150k", .14), ("$150k+", .07)],
        age=[("18-24", .19), ("25-34", .31), ("35-44", .22), ("45-54", .16), ("55+", .12)],
        education=[("High school", .28), ("Some college", .31), ("Bachelor's", .28), ("Postgraduate", .13)],
        device=[("Mobile", .63), ("Desktop", .27), ("Tablet", .10)]),
    "email": dict(
        income=[("Under $50k", .18), ("$50-75k", .24), ("$75-100k", .26), ("$100-150k", .21), ("$150k+", .11)],
        age=[("18-24", .09), ("25-34", .24), ("35-44", .29), ("45-54", .23), ("55+", .15)],
        education=[("High school", .17), ("Some college", .27), ("Bachelor's", .38), ("Postgraduate", .18)],
        device=[("Mobile", .71), ("Desktop", .22), ("Tablet", .07)]),
    "video": dict(
        income=[("Under $50k", .22), ("$50-75k", .25), ("$75-100k", .24), ("$100-150k", .19), ("$150k+", .10)],
        age=[("18-24", .14), ("25-34", .28), ("35-44", .27), ("45-54", .19), ("55+", .12)],
        education=[("High school", .21), ("Some college", .29), ("Bachelor's", .34), ("Postgraduate", .16)],
        device=[("Mobile", .48), ("Desktop", .39), ("Tablet", .13)]),
}
demographics = {k: {dim: [dict(label=l, share=s) for l, s in rows]
                    for dim, rows in v.items()} for k, v in DEMOS.items()}

# ---------------------------------------------------------------- geography
# A tile grid, not a projection: one square per ZIP, laid out to keep north,
# south, east and west in the right places. Reading a tile grid does not depend
# on area, which is what makes a small dense inner city legible next to a large
# outer one.
ZIPS = [
    # zip,   col, row, name,                 weight, median income, median age, degree share
    ("97203", 0, 0, "St Johns",            0.72,  61_400, 34.1, .29),
    ("97217", 1, 0, "Kenton",              0.94,  68_900, 35.4, .36),
    ("97211", 2, 0, "Woodlawn",            1.08,  76_200, 36.0, .45),
    ("97218", 3, 0, "Cully",               0.66,  63_800, 34.8, .28),
    ("97220", 4, 0, "Parkrose",            0.58,  59_100, 36.2, .24),
    ("97229", 0, 1, "Bethany",             0.81, 118_400, 39.6, .61),
    ("97210", 1, 1, "Northwest",           1.02,  92_700, 35.1, .58),
    ("97227", 2, 1, "Eliot",               0.88,  71_500, 33.7, .42),
    ("97212", 3, 1, "Irvington",           1.21,  98_300, 38.4, .59),
    ("97213", 4, 1, "Hollywood",           0.97,  84_600, 37.9, .49),
    ("97221", 0, 2, "Sylvan",              0.63, 131_200, 44.2, .67),
    ("97205", 1, 2, "Goose Hollow",        1.14,  74_800, 34.0, .55),
    ("97209", 2, 2, "Pearl",               1.44,  96_100, 35.8, .63),
    ("97232", 3, 2, "Lloyd",               1.07,  79_400, 36.6, .51),
    ("97215", 4, 2, "Mt Tabor",            0.92,  86_900, 38.1, .52),
    ("97239", 0, 3, "South Waterfront",    0.86,  89_700, 37.2, .57),
    ("97201", 1, 3, "Downtown",            1.32,  70_300, 33.2, .53),
    ("97214", 2, 3, "Buckman",             1.51,  73_900, 33.9, .54),
    ("97202", 3, 3, "Sellwood",            1.18,  88_100, 37.5, .56),
    ("97206", 4, 3, "Foster-Powell",       0.94,  67_200, 35.6, .38),
    ("97219", 1, 4, "Multnomah Village",   0.79,  99_800, 41.3, .58),
    ("97266", 3, 4, "Lents",               0.61,  57_600, 34.4, .22),
]
geo = []
for z, col, row, name, w, inc, age, deg in ZIPS:
    shares = {}
    for c in CAMPAIGNS:
        jitter = 1 + random.uniform(-0.22, 0.22)
        # conversions concentrate more than impressions do
        shares[c["id"]] = dict(
            impressionShare=round(w * jitter, 4),
            clickShare=round(w * jitter * (1 + random.uniform(-0.14, 0.14)), 4),
            conversionShare=round((w ** 1.35) * jitter * (1 + random.uniform(-0.18, 0.18)), 4),
        )
    geo.append(dict(zip=z, name=name, col=col, row=row, shares=shares,
                    medianIncome=inc, medianAge=age, degreeShare=deg))
for field in ("impressionShare", "clickShare", "conversionShare"):
    for c in CAMPAIGNS:
        t = sum(g["shares"][c["id"]][field] for g in geo)
        for g in geo:
            g["shares"][c["id"]][field] = round(g["shares"][c["id"]][field] / t, 5)

# ---------------------------------------------------------------- creatives
CREATIVES = [
    # id, campaign, name, format, dimensions, seconds, share of campaign (imp, clk, cnv)
    ("cr-01", "c-dp-1", "Family Bundle $26",     "Static image", "300x250", None, (.42, .45, .48)),
    ("cr-02", "c-dp-1", "Two for Tuesday",       "Static image", "728x90",  None, (.33, .31, .27)),
    ("cr-03", "c-dp-1", "Detroit-Style Launch",  "Animated GIF", "300x600", None, (.25, .24, .25)),
    ("cr-04", "c-dp-2", "Left In Cart",          "Static image", "300x250", None, (.58, .61, .66)),
    ("cr-05", "c-dp-2", "Still Warm",            "Static image", "160x600", None, (.42, .39, .34)),
    ("cr-06", "c-em-1", "Tuesday Deal — Active", "HTML email",   "600x900", None, (.63, .66, .69)),
    ("cr-07", "c-em-1", "Tuesday Deal — Lapsed", "HTML email",   "600x900", None, (.37, .34, .31)),
    ("cr-08", "c-em-2", "We Miss You $5 Off",    "HTML email",   "600x750", None, (1.0, 1.0, 1.0)),
    ("cr-09", "c-vd-1", "Fresh Out The Oven :15", "Video", "1920x1080", 15, (.61, .64, .66)),
    ("cr-10", "c-vd-1", "Fresh Out The Oven :30", "Video", "1920x1080", 30, (.39, .36, .34)),
    ("cr-11", "c-vd-2", "Family Night :30",       "Video", "1920x1080", 30, (.57, .54, .59)),
    ("cr-12", "c-vd-2", "Late Night Slice :15",   "Video", "1920x1080", 15, (.43, .46, .41)),
]
QUARTILES = {
    "cr-09": [100, 96.4, 94.1, 92.8, 91.2], "cr-10": [100, 88.7, 81.4, 77.2, 74.9],
    "cr-11": [100, 71.3, 64.8, 61.2, 58.4], "cr-12": [100, 79.6, 73.1, 69.4, 66.8],
}
SITES = {
    "display": ["weather.com", "allrecipes.com", "oregonlive.com", "food52.com", "reddit.com",
                "espn.com", "buzzfeed.com", "seriouseats.com", "yelp.com", "pinterest.com",
                "wikihow.com", "accuweather.com"],
    "video":   ["Hulu", "Tubi", "Pluto TV", "Roku Channel", "Peacock", "YouTube",
                "Paramount+", "Local news app", "Sling", "Xumo"],
    "email":   ["Gmail", "Apple Mail", "Outlook", "Yahoo Mail", "Proton Mail"],
}
ASSETS = {"Video": ("video", "video-creative.mp4")}
creatives = []
for cid, camp, name, fmt, dims, secs, (si, sc, sv) in CREATIVES:
    media = next(c["mediaType"] for c in CAMPAIGNS if c["id"] == camp)
    sites = SITES[media]
    raw = [(s, random.uniform(0.4, 1.0) ** 1.6) for s in sites]
    tot = sum(v for _, v in raw)
    placements = []
    for s, v in sorted(raw, key=lambda r: -r[1]):
        placements.append(dict(
            site=s,
            impressionShare=round(v / tot, 4),
            clickShare=round(v / tot * random.uniform(0.72, 1.31), 4),
            conversionShare=round(v / tot * random.uniform(0.55, 1.48), 4),
        ))
    for f in ("clickShare", "conversionShare"):
        t = sum(p[f] for p in placements)
        for p in placements:
            p[f] = round(p[f] / t, 4)
    creatives.append(dict(
        id=cid, campaign=camp, name=name, format=fmt, dimensions=dims, seconds=secs,
        impressionShare=si, clickShare=sc, conversionShare=sv,
        assetKind="video" if fmt == "Video" else "image",
        # The page lives at /madhive/v2/, so assets at the site root are two up.
        asset=("../../madhive-v2-assets/video-creative.mp4" if fmt == "Video"
               else f"../../madhive-v2-assets/{cid}.svg"),
        poster="../../madhive-v2-assets/video-poster.svg" if fmt == "Video" else None,
        quartiles=QUARTILES.get(cid),
        placements=placements,
    ))

data = dict(
    meta=dict(
        advertiser="Elite Pizza",
        firstDate=START.isoformat(),
        lastDate=(START + timedelta(days=DAYS - 1)).isoformat(),
        defaultStart=(START + timedelta(days=DAYS - WINDOW)).isoformat(),
        defaultEnd=(START + timedelta(days=DAYS - 1)).isoformat(),
        generatedAt="2026-08-19T06:00:00-07:00",
        synthetic=True,
    ),
    mediaTypes=MEDIA,
    campaigns=[{k: v for k, v in c.items()
                if k in ("id", "name", "mediaType")} for c in CAMPAIGNS],
    daily=daily,
    devices=devices,
    demographics=demographics,
    geo=geo,
    creatives=creatives,
)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    json.dump(data, f, separators=(",", ":"))

kb = os.path.getsize(OUT) / 1024
w = [d for d in daily if d["date"] >= data["meta"]["defaultStart"]]
print("Wrote %s  (%.0f KB)" % (os.path.relpath(OUT), kb))
print("  %d campaigns · %d days · %d creatives · %d ZIPs"
      % (len(CAMPAIGNS), DAYS, len(creatives), len(geo)))
for m in MEDIA:
    ids = {c["id"] for c in CAMPAIGNS if c["mediaType"] == m["key"]}
    r = [d for d in w if d["campaign"] in ids]
    i, cl, cv, sp = (sum(x[k] for x in r) for k in ("impressions", "clicks", "conversions", "spend"))
    print("  %-13s imp %9s  clk %6s  conv %6s  spend %9s   CTR %5.3f%%  CPA $%6.2f"
          % (m["label"], f"{i:,}", f"{cl:,}", f"{cv:,.0f}", f"${sp:,.0f}", cl / i * 100, sp / cv))
i, cl, cv, sp = (sum(x[k] for x in w) for k in ("impressions", "clicks", "conversions", "spend"))
print("  %-13s imp %9s  clk %6s  conv %6s  spend %9s   CPM $%.2f  CPC $%.2f  CPA $%.2f"
      % ("TOTAL", f"{i:,}", f"{cl:,}", f"{cv:,.0f}", f"${sp:,.0f}", sp / i * 1000, sp / cl, sp / cv))
