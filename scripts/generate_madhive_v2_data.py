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
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from madhive_v2_email_layout import CLICK_SHARES, SECTIONS  # noqa: E402

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
    dict(id="c-dp-1", name="Summer Slice Prospecting", mediaType="display", flight=(0, 180),
         impressions=3_900_000, clicks=13_300, conversions=165, spend=19_100),
    dict(id="c-dp-2", name="Cart Abandon Retarget", mediaType="display", flight=(12, 168),
         impressions=2_300_000, clicks=8_400, conversions=135, spend=11_900),
    dict(id="c-em-1", name="Two for Tuesday", mediaType="email", flight=(0, 180),
         impressions=340_000, clicks=7_300, conversions=980, spend=8_300),
    dict(id="c-em-2", name="Win-Back 60 Day", mediaType="email", flight=(34, 180),
         impressions=200_000, clicks=4_000, conversions=540, spend=5_200),
    dict(id="c-vd-1", name="Fresh Out The Oven", mediaType="video", flight=(6, 180),
         impressions=800_000, clicks=2_050, conversions=610, spend=20_000),
    dict(id="c-vd-2", name="Family Night", mediaType="video", flight=(45, 180),
         impressions=500_000, clicks=1_200, conversions=370, spend=12_500),
]

# Email does not have impressions. What it has is sends, of which some are
# delivered, of which some report an open. The `impressions` field carries
# DELIVERED for email campaigns; these ratios put the rest of the funnel around
# it so nothing has to be inferred in the UI.
#
# Two open numbers are carried and neither is ever a denominator. Apple Mail
# Privacy Protection fetches the tracking pixel on delivery whether or not
# anyone opened, so the reported figure is inflated by an unknowable margin and
# click-to-open inherits the problem. Click rate is taken on delivered.
EMAIL_FUNNEL = {
    "c-em-1": dict(deliveryRate=0.978, openReported=0.468, openModelled=0.302, unsubRate=0.0038),
    "c-em-2": dict(deliveryRate=0.971, openReported=0.414, openModelled=0.267, unsubRate=0.0062),
}

# ------------------------------------------------------------------ reach
# Reach does not add up, which is the whole difficulty. Two things are stored
# instead of a number:
#
#   frequency  impressions per unique identifier over the campaign's flight.
#              Reach for any filtered window is impressions / frequency, which
#              holds because frequency is close to flat once a campaign is past
#              its first fortnight.
#   overlap    how much the campaigns in scope share people. It grows with the
#              number of media types selected, because a person reached on
#              display and on video is one person, and the join that says so is
#              probabilistic.
#
# Identifiers differ by channel: display and video dedupe on a device id,
# email on a hashed address. Resolving one to the other is a match, not a
# lookup, which is why the card is a modelled figure and says so.
FREQUENCY = {
    "c-dp-1": 22.0,   # broad prospecting, large pool
    "c-dp-2": 34.0,   # retargeting: small pool, hit often
    "c-em-1": 14.2,   # the active list, mailed twice a week
    "c-em-2": 9.6,
    "c-vd-1": 12.0,
    "c-vd-2": 9.0,
}
# Keyed by how many media types are in scope.
OVERLAP = {1: 0.06, 2: 0.19, 3: 0.28}
IDENTIFIERS = {
    "display": "Device id (IDFA / AAID, or a first-party cookie on web)",
    "video": "Device id from the streaming app or CTV device",
    "email": "Hashed email address",
}

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
    lo, hi = c["flight"]
    live = lambda i: lo <= i < hi
    n = {k: sum(x for i, x in enumerate(v) if i >= DAYS - WINDOW and live(i))
         for k, v in dict(imp=w_imp, clk=w_clk, cnv=w_cnv, spd=w_spd).items()}
    fn = EMAIL_FUNNEL.get(c["id"])
    for i in range(DAYS):
        if not live(i):
            continue
        delivered = round(c["impressions"] * w_imp[i] / n["imp"])
        row = dict(
            date=(START + timedelta(days=i)).isoformat(),
            campaign=c["id"],
            impressions=delivered,          # email: delivered, not served
            clicks=round(c["clicks"] * w_clk[i] / n["clk"]),
            conversions=round(c["conversions"] * w_cnv[i] / n["cnv"], 2),
            spend=round(c["spend"] * w_spd[i] / n["spd"], 2),
        )
        if fn:
            row.update(
                sends=round(delivered / fn["deliveryRate"]),
                opensReported=round(delivered * fn["openReported"]),
                opensModelled=round(delivered * fn["openModelled"]),
                unsubs=round(delivered * fn["unsubRate"], 2),
            )
        daily.append(row)

# -------------------------------------------------------------- breakdowns
def norm(d):
    t = sum(d.values())
    return {k: round(v / t, 4) for k, v in d.items()}

# Device is inferred -- from the user agent on a bid request, or from the one
# the open pixel reports -- and inference has a residual. Every real report
# carries an Other bucket, so this one does too. It is largest on video, where
# connected-TV devices frequently do not identify themselves, and on email,
# where a proxying client reports its own agent rather than the reader's.
DEVICE_SPLIT = {          # impressions / clicks / conversions each get a share
    "display": dict(Mobile=(0.610, 0.660, 0.535), Desktop=(0.262, 0.233, 0.350),
                    Tablet=(0.097, 0.078, 0.087), Other=(0.031, 0.029, 0.028)),
    "email":   dict(Mobile=(0.664, 0.622, 0.489), Desktop=(0.206, 0.264, 0.395),
                    Tablet=(0.065, 0.057, 0.056), Other=(0.065, 0.057, 0.060)),
    "video":   dict(Mobile=(0.446, 0.516, 0.383), Desktop=(0.363, 0.328, 0.458),
                    Tablet=(0.121, 0.094, 0.093), Other=(0.070, 0.062, 0.066)),
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
# Population is MODELLED, like the rest of the area profile beside it. The
# Census API needs a key we do not have, and inventing a number that looks like
# an official count would be worse than saying plainly that it is not one.
# Magnitudes are set to what a Portland ZCTA plausibly holds.
ZIPS = [
    # zip,   col, row, name,                 weight, median income, median age, degree share, population
    ("97203", 0, 0, "St Johns",            0.72,  61_400, 34.1, .29, 26400),
    ("97217", 1, 0, "Kenton",              0.94,  68_900, 35.4, .36, 35200),
    ("97211", 2, 0, "Woodlawn",            1.08,  76_200, 36.0, .45, 30100),
    ("97218", 3, 0, "Cully",               0.66,  63_800, 34.8, .28, 16300),
    ("97220", 4, 0, "Parkrose",            0.58,  59_100, 36.2, .24, 24100),
    ("97229", 0, 1, "Bethany",             0.81, 118_400, 39.6, .61, 61800),
    ("97210", 1, 1, "Northwest",           1.02,  92_700, 35.1, .58, 17400),
    ("97227", 2, 1, "Eliot",               0.88,  71_500, 33.7, .42, 9200),
    ("97212", 3, 1, "Irvington",           1.21,  98_300, 38.4, .59, 22300),
    ("97213", 4, 1, "Hollywood",           0.97,  84_600, 37.9, .49, 26600),
    ("97221", 0, 2, "Sylvan",              0.63, 131_200, 44.2, .67, 11900),
    ("97205", 1, 2, "Goose Hollow",        1.14,  74_800, 34.0, .55, 8100),
    ("97209", 2, 2, "Pearl",               1.44,  96_100, 35.8, .63, 16200),
    ("97232", 3, 2, "Lloyd",               1.07,  79_400, 36.6, .51, 13400),
    ("97215", 4, 2, "Mt Tabor",            0.92,  86_900, 38.1, .52, 18100),
    ("97239", 0, 3, "South Waterfront",    0.86,  89_700, 37.2, .57, 21300),
    ("97201", 1, 3, "Downtown",            1.32,  70_300, 33.2, .53, 17800),
    ("97214", 2, 3, "Buckman",             1.51,  73_900, 33.9, .54, 27400),
    ("97202", 3, 3, "Sellwood",            1.18,  88_100, 37.5, .56, 39800),
    ("97206", 4, 3, "Foster-Powell",       0.94,  67_200, 35.6, .38, 40200),
    ("97219", 1, 4, "Multnomah Village",   0.79,  99_800, 41.3, .58, 34900),
    ("97266", 3, 4, "Lents",               0.61,  57_600, 34.4, .22, 28300),
]
# Device and mobile-OS profile per ZIP. Modelled, not measured: the tilt is
# seeded off median income and then reconciled by iterative proportional
# fitting so that, weighted by impressions, the ZIP-level device split adds
# back up to the campaign-level one. Without that step the map and the device
# chart would be two numbers that must agree and quietly do not.
DEVICES = ["Mobile", "Desktop", "Tablet", "Other"]

def zip_device_matrix(zips, target_share, row_weight):
    n = len(DEVICES)
    tilt = []
    for (_z, _c, _r, _n, _w, inc, _age, _deg, _p) in zips:
        lean = (inc - 82_000) / 82_000          # richer areas skew to desktop
        # Other does not lean: an unidentified device is unidentified everywhere.
        tilt.append([max(0.05, 1 - 0.45 * lean), max(0.05, 1 + 0.80 * lean), 1.0, 1.0])
    m = [[t[j] * target_share[DEVICES[j]] for j in range(n)] for t in tilt]
    for _ in range(60):                          # rows to impressions, columns to target
        for i, r in enumerate(m):
            s = sum(r) or 1
            for j in range(n):
                m[i][j] *= row_weight[i] / s
        for j in range(n):
            s = sum(m[i][j] for i in range(len(m))) or 1
            for i in range(len(m)):
                m[i][j] *= target_share[DEVICES[j]] / s
    return m

_imp_by_zip = []
for z, col, row, name, w, inc, age, deg, pop in ZIPS:
    _imp_by_zip.append(w)
_tot_w = sum(_imp_by_zip)
_row_weight = [x / _tot_w for x in _imp_by_zip]
_blend = {d: sum(c["impressions"] * DEVICE_SPLIT[c["mediaType"]][d][0] for c in CAMPAIGNS)
          for d in DEVICES}
_bt = sum(_blend.values())
_target = {d: v / _bt for d, v in _blend.items()}
_matrix = zip_device_matrix(ZIPS, _target, _row_weight)

geo = []
for zi, (z, col, row, name, w, inc, age, deg, pop) in enumerate(ZIPS):
    shares = {}
    for c in CAMPAIGNS:
        jitter = 1 + random.uniform(-0.22, 0.22)
        # conversions concentrate more than impressions do
        shares[c["id"]] = dict(
            impressionShare=round(w * jitter, 4),
            clickShare=round(w * jitter * (1 + random.uniform(-0.14, 0.14)), 4),
            conversionShare=round((w ** 1.35) * jitter * (1 + random.uniform(-0.18, 0.18)), 4),
        )
    dev_row = _matrix[zi]
    dev_tot = sum(dev_row)
    # iOS share of this ZIP's mobile traffic. Modelled off income, bounded so no
    # area lands somewhere the real world does not.
    ios = min(0.78, max(0.34, 0.52 + (inc - 82_000) / 82_000 * 0.30
                        + random.uniform(-0.035, 0.035)))
    geo.append(dict(zip=z, name=name, col=col, row=row, shares=shares,
                    population=pop, medianIncome=inc, medianAge=age, degreeShare=deg,
                    devices={d: round(dev_row[j] / dev_tot, 4) for j, d in enumerate(DEVICES)},
                    # A small share of mobile traffic reports neither.
                    os={"iOS": round(ios * 0.982, 4), "Android": round((1 - ios) * 0.982, 4),
                        "Other": round(0.018, 4)}))
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
        # Where inside the email the clicks landed. Boxes come from the same
        # spec the creative is drawn from, so a leader line cannot point at the
        # wrong band.
        sections=[dict(key=k, label=lbl, x=x, y=y, w=bw, h=bh,
                       clickShare=CLICK_SHARES[cid][k])
                  for k, lbl, x, y, bw, bh in SECTIONS] if cid in CLICK_SHARES else None,
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
    campaigns=[dict(id=c["id"], name=c["name"], mediaType=c["mediaType"],
                    frequency=FREQUENCY[c["id"]],
                    flightStart=(START + timedelta(days=c["flight"][0])).isoformat(),
                    flightEnd=(START + timedelta(days=c["flight"][1] - 1)).isoformat())
               for c in CAMPAIGNS],
    daily=daily,
    emailFunnel=EMAIL_FUNNEL,
    reach=dict(overlapByMediaCount=OVERLAP, identifiers=IDENTIFIERS),
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
em = [d for d in w if d["campaign"] in EMAIL_FUNNEL]
if em:
    s = {k: sum(d.get(k, 0) for d in em) for k in
         ("sends", "impressions", "opensReported", "opensModelled", "clicks", "conversions", "unsubs")}
    print("  email funnel  sends %s -> delivered %s (%.1f%%) -> opens %s reported / %s modelled "
          "-> clicks %s (%.2f%% of delivered) -> conv %s   unsub %.2f%%"
          % (f"{s['sends']:,}", f"{s['impressions']:,}", s["impressions"] / s["sends"] * 100,
             f"{s['opensReported']:,}", f"{s['opensModelled']:,}", f"{s['clicks']:,}",
             s["clicks"] / s["impressions"] * 100, f"{s['conversions']:,.0f}",
             s["unsubs"] / s["impressions"] * 100))

for m in MEDIA:
    ids = {c["id"] for c in CAMPAIGNS if c["mediaType"] == m["key"]}
    r = [d for d in w if d["campaign"] in ids]
    i, cl, cv, sp = (sum(x[k] for x in r) for k in ("impressions", "clicks", "conversions", "spend"))
    print("  %-13s imp %9s  clk %6s  conv %6s  spend %9s   CTR %5.3f%%  CPA $%6.2f"
          % (m["label"], f"{i:,}", f"{cl:,}", f"{cv:,.0f}", f"${sp:,.0f}", cl / i * 100, sp / cv))
i, cl, cv, sp = (sum(x[k] for x in w) for k in ("impressions", "clicks", "conversions", "spend"))
print("  %-13s imp %9s  clk %6s  conv %6s  spend %9s   CPM $%.2f  CPC $%.2f  CPA $%.2f"
      % ("TOTAL", f"{i:,}", f"{cl:,}", f"{cv:,.0f}", f"${sp:,.0f}", sp / i * 1000, sp / cl, sp / cv))
