#!/usr/bin/env python3
"""Generate the synthetic campaign dataset for the MadHive demo dashboard.

Writes public/data/madhive-campaign.json, fetched by the React dashboard at
runtime. Regenerate with:  python3 scripts/generate_madhive_data.py

All figures are fabricated for a fictional advertiser, modelled on published
2026 benchmarks (cited in meta.sources) so the shape is realistic.

Conversions are last-touch throughout — what a platform reports by default.
60 days are generated so the dashboard can show the most recent 30 against the
prior 30.
"""
import json
import math
import os
from datetime import date, timedelta

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data", "madhive-campaign.json")

# ---------------------------------------------------------------- assumptions
# Every number here that isn't directly measured, with the basis for it.
ASSUMPTIONS = [
    dict(key="emailSpendCap", label="Email spend ceiling", value=5600, unit="$",
         adjustable=False,
         basis="List-burn constraint. Past ~4 emails a month the unsubscribe rate passes 0.5% "
               "and the list starts shrinking, so extra budget cannot buy more sends and the "
               "response curve stops applying."),
    dict(key="offlineMatchRate", label="Offline match rate", value=0.34, unit="",
         adjustable=False,
         basis="Modelled, not measured. Published work on IP-based resolution (CIMM / Go "
               "Addressable, 2025) puts IP-to-postal accuracy at 13-16%, so an IP-to-device "
               "match is only ever partial. Every offline conversion on this page is therefore "
               "a floor, not a count — the real number is higher and unknowable from here."),
    dict(key="offlineWindowDays", label="Store-visit window", value=7, unit=" days",
         adjustable=False,
         basis="A visit is credited if it happens within 7 days of the impression. Chosen to "
               "match the lift tests' conversion window so the two metrics describe the same "
               "span of behaviour."),
    dict(key="geofenceRadius", label="Geofence radius", value=60, unit="m",
         adjustable=False,
         basis="60 metres around each shop. Tight enough to exclude the pavement traffic and "
               "the units either side; wide enough to survive GPS drift indoors."),
]
A = {a["key"]: a["value"] for a in ASSUMPTIONS}
START = date(2026, 6, 19)
DAYS = 60
WINDOW = 30

# ------------------------------------------------------------- lift tests
# A holdout answers a question attribution cannot: would this person have
# converted anyway? A control group is withheld from the ads; the gap between
# how often the exposed group converts and how often the control group converts
# is what the advertising actually caused.
#
#   incremental = (rate_exposed - rate_control) x exposed
#   lift        = incremental / attributed conversions
#
# Design differs by channel because what is feasible differs. Where the control
# converts nearly as often as the exposed group, most of the credited
# conversions were going to happen regardless.
LIFT = {
    "display": dict(
        method="Ghost bids",
        design="Control users entered the auction and were recorded as won, then served "
               "nothing — matched on targeting and auction dynamics.",
        units="user-level randomisation",
        exposedRate=0.00489, controlRate=0.00357, ciLow=0.241, ciHigh=0.302,
        why="Most display spend retargets people who already left an order in the cart."),
    "video": dict(
        method="Matched-market geo holdout",
        design="18 matched DMA pairs with the channel dark in one of each pair. Household-level "
               "withholding is not possible across CTV publishers.",
        units="22 matched ZIP pairs",
        exposedRate=0.01662, controlRate=0.00249, ciLow=0.718, ciHigh=0.960,
        why="Reaching people who were not already thinking about dinner."),
    "email": dict(
        method="Randomised list holdout",
        design="8% of subscribers withheld from every send in the window, re-randomised each send.",
        units="subscriber-level randomisation",
        exposedRate=0.05645, controlRate=0.04234, ciLow=0.214, ciHigh=0.287,
        why="The list is regulars, and regulars order pizza on their own schedule."),
}

# ---------------------------------------------------------------- channels
# halfSaturationSpend (K) is the fitted response-curve parameter: the spend at
# which a channel delivers half of everything it could ever deliver. Everything
# marginal derives from it, so no second hand-written table can drift out of
# step with the conversion totals.
CHANNELS = [
    dict(key="display", label="Display", color="#2a78d6",
         spend=9800, impressions=2100000, clicks=1890,
         onlineConversions=1240, offlineConversions=620,
         halfSaturationSpend=12000, reach=380000, reachUnit="devices"),
    dict(key="video", label="Online video", color="#eb6834",
         spend=14200, impressions=640000, clicks=590,
         onlineConversions=1510, offlineConversions=1980,
         halfSaturationSpend=40000, reach=210000, reachUnit="households"),
    dict(key="email", label="Email", color="#1baf7a",
         spend=4000, impressions=186000, clicks=3900,
         onlineConversions=2980, offlineConversions=520,
         halfSaturationSpend=3000, reach=62000, reachUnit="subscribers"),
]
for c in CHANNELS:
    # One definition of "a conversion", used by the curve fit, the lift maths and
    # every cost figure. Splitting it would let the two halves drift.
    c["conversions"] = c["onlineConversions"] + c["offlineConversions"]
    lift = dict(LIFT[c["key"]])
    lift["incrementality"] = round(
        (lift["exposedRate"] - lift["controlRate"]) / lift["exposedRate"], 3)
    lift["incremental"] = round(c["conversions"] * lift["incrementality"])
    lift["baseline"] = c["conversions"] - lift["incremental"]
    c["lift"] = lift
    K, s, n = c["halfSaturationSpend"], c["spend"], c["conversions"]
    c["maxConversions"] = round(n * (K + s) / s, 1)
    c["marginalCpa"] = round((K + s) ** 2 / (c["maxConversions"] * K), 2)
    c["floorCpa"] = round(K / c["maxConversions"], 2)
    c["cpa"] = round(s / n, 2)
    c["cpm"] = round(s / c["impressions"] * 1000, 2)
    c["cpc"] = round(s / c["clicks"], 2)
    c["ctr"] = round(c["clicks"] / c["impressions"], 5)
    c["onlineCpa"] = round(s / c["onlineConversions"], 2)
    c["offlineShare"] = round(c["offlineConversions"] / n, 3)
    c["frequency"] = round(c["impressions"] / c["reach"], 1)

# ---------------------------------------------------------------- daily
def day_weight(key, i):
    weekly = [1.04, 1.00, 0.97, 0.99, 1.03, 1.12, 1.16][i % 7]
    trend = {"video": 1 + i * 0.004, "display": 1 - i * 0.0015, "email": 1 + i * 0.0008}[key]
    wobble = 1 + 0.06 * math.sin(i * 1.7 + {"display": 0, "video": 1, "email": 2}[key])
    base = weekly * trend * wobble
    if key == "email":
        base *= 1.0 if i % 7 in (1, 4) else 0.12
    return base

weights = {c["key"]: [day_weight(c["key"], i) for i in range(DAYS)] for c in CHANNELS}
# Conversions get their own daily shape. Sharing one shape with spend would make
# cost-per-conversion a flat line by construction — an artefact, not a finding.
conv_w = {c["key"]: [day_weight(c["key"], i) * (1 + 0.16 * math.sin(i * 0.9 + 1.3)
                                                 + 0.09 * math.cos(i * 2.3))
                     for i in range(DAYS)] for c in CHANNELS}
# Normalise so the LAST 30 days sum to the reported totals; the prior 30 falls
# out of the same shape and gives an honest period-over-period delta.
recent_tot = {k: sum(v[DAYS - WINDOW:]) for k, v in weights.items()}
recent_conv = {k: sum(v[DAYS - WINDOW:]) for k, v in conv_w.items()}

daily = []
for i in range(DAYS):
    row = {"date": (START + timedelta(days=i)).isoformat()}
    for c in CHANNELS:
        share = weights[c["key"]][i] / recent_tot[c["key"]]
        row[c["key"]] = dict(
            spend=round(c["spend"] * share, 2),
            impressions=round(c["impressions"] * share),
            clicks=round(c["clicks"] * share),
            onlineConversions=round(c["onlineConversions"] * conv_w[c["key"]][i] / recent_conv[c["key"]], 1),
            offlineConversions=round(c["offlineConversions"] * conv_w[c["key"]][i] / recent_conv[c["key"]], 1),
            conversions=round(c["conversions"] * conv_w[c["key"]][i] / recent_conv[c["key"]], 1),
        )
    daily.append(row)

def wtot(field, lo, hi):
    return sum(sum(d[c["key"]][field] for c in CHANNELS) for d in daily[lo:hi])

CUR = (DAYS - WINDOW, DAYS)
PRV = (DAYS - 2 * WINDOW, DAYS - WINDOW)
totals = {f: dict(current=round(wtot(f, *CUR), 2), prior=round(wtot(f, *PRV), 2))
          for f in ("spend", "impressions", "clicks",
                    "onlineConversions", "offlineConversions", "conversions")}

# ---------------------------------------------------------------- video
video = dict(
    quartiles=[
        dict(stage="Start", nonskip=100.0, skip=100.0),
        dict(stage="25%", nonskip=97.8, skip=71.4),
        dict(stage="50%", nonskip=96.1, skip=66.2),
        dict(stage="75%", nonskip=95.2, skip=63.9),
        dict(stage="100%", nonskip=94.6, skip=62.8),
    ],
    types=[
        dict(type="Non-skippable + bumper", spend=6700, impressions=240000, cpm=27.92,
             vcr=94.6, cpcv=0.030, viewability=78.4, cpa=3.60),
        dict(type="Skippable in-stream", spend=7500, impressions=400000, cpm=18.75,
             vcr=62.8, cpcv=0.030, viewability=66.9, cpa=4.60),
    ],
)
video["dropoff"] = [
    dict(stage='%s → %s' % (video["quartiles"][i-1]["stage"], video["quartiles"][i]["stage"]),
         nonskip=round(video["quartiles"][i]["nonskip"] - video["quartiles"][i-1]["nonskip"], 1),
         skip=round(video["quartiles"][i]["skip"] - video["quartiles"][i-1]["skip"], 1))
    for i in range(1, len(video["quartiles"]))
]

# ---------------------------------------------------------------- email
email = dict(
    funnel=[
        dict(stage="Sent", value=195000, note=None, suspect=False),
        dict(stage="Delivered", value=186000, note="95.4% of sent", suspect=False),
        dict(stage="Opens — reported", value=84000, note="45.2% · inflated by Apple MPP", suspect=True),
        dict(stage="Opens — modelled human", value=54300, note="29.2% · what we use", suspect=False),
        dict(stage="Clicks", value=3900, note="2.10% of delivered", suspect=False),
        dict(stage="Online conversions", value=2980, note=None, suspect=False),
    ],
    listHealth=[
        dict(metric="Active subscribers", value=62000, benchmark=None),
        dict(metric="New subscribers", value=2400, benchmark=None),
        dict(metric="Unsubscribes", value=-856, benchmark="0.46%"),
        dict(metric="Bounced / cleaned", value=-220, benchmark="2.3%"),
        dict(metric="Net monthly change", value=1324, benchmark=None),
    ],
    frequency=[
        dict(sends=2, conversions=2325, unsubRate=0.31, netList=2100),
        dict(sends=3, conversions=3005, unsubRate=0.38, netList=1760),
        dict(sends=4, conversions=3500, unsubRate=0.46, netList=1324),
        dict(sends=5, conversions=3745, unsubRate=0.81, netList=260),
        dict(sends=6, conversions=3840, unsubRate=1.34, netList=-1450),
        dict(sends=8, conversions=3865, unsubRate=2.21, netList=-4620),
    ],
)

# ---------------------------------------------------------------- display
display = dict(
    viewability=[
        dict(marketplace="Private marketplace", rate=84.6, spend=3400, isBenchmark=False),
        dict(marketplace="Native placements", rate=81.0, spend=1100, isBenchmark=False),
        dict(marketplace="Cross-network avg 2026", rate=72.0, spend=None, isBenchmark=True),
        dict(marketplace="Open exchange", rate=61.2, spend=5300, isBenchmark=False),
    ],
    metrics=[
        dict(metric="Avg time in view", value="6.2s",
             reads="Healthy. Impressions that are viewable are getting real dwell."),
        dict(metric="Invalid traffic (IVT)", value="2.1%",
             reads="Under the 3% action threshold. Not the problem here."),
        dict(metric="Retargeting share of spend", value="64%",
             reads="Most of display is reaching people who already had us in mind."),
    ],
)
for v in display["viewability"]:
    v["wasted"] = None if v["isBenchmark"] else round(v["spend"] * (1 - v["rate"] / 100))

# ---------------------------------------------------------------- creatives
creatives = [
    dict(id="em-1", channel="email", name="Two for Tuesday", spend=2300,
         units=104000, completion=None, conversions=2090, verdict="scale",
         placements=[("Ordered in last 30d", 1380, 61000, 1339),
                     ("Ordered 31-90d ago", 920, 43000, 751)]),
    dict(id="em-2", channel="email", name="We miss you — 30 days", spend=1700,
         units=82000, completion=None, conversions=1410, verdict="scale",
         placements=[("Lapsed 30-60d", 1020, 47000, 916),
                     ("Lapsed 61-120d", 680, 35000, 494)]),
    dict(id="vd-1", channel="video", name="Fresh out the oven :15", spend=4200,
         units=196000, completion=95.1, conversions=1202, verdict="scale",
         placements=[("Local streaming app", 2100, 98000, 650),
                     ("FAST — food & travel", 1300, 61000, 342),
                     ("Premium AVOD", 800, 37000, 210)]),
    dict(id="vd-2", channel="video", name="Meet the dough :30", spend=3600,
         units=164000, completion=93.8, conversions=888, verdict="scale",
         placements=[("Premium AVOD", 2200, 100000, 557),
                     ("FAST — entertainment", 1400, 64000, 331)]),
    dict(id="vd-3", channel="video", name="Family night :30 skippable", spend=4100,
         units=182000, completion=61.2, conversions=860, verdict="fix",
         placements=[("Web pre-roll", 2500, 111000, 534),
                     ("Mobile in-app", 1600, 71000, 326)]),
    dict(id="vd-4", channel="video", name="Late night slice :15 skippable", spend=2300,
         units=98000, completion=64.9, conversions=540, verdict="pause",
         placements=[("Web pre-roll", 1400, 60000, 335),
                     ("Mobile in-app", 900, 38000, 205)]),
    dict(id="dp-1", channel="display", name="Family bundle — $26", spend=2900,
         units=620000, completion=None, conversions=630, verdict="hold",
         placements=[("PMP", 1800, 385000, 414), ("Open exchange", 1100, 235000, 216)]),
    dict(id="dp-2", channel="display", name="Two for Tuesday banner", spend=1800,
         units=390000, completion=None, conversions=366, verdict="hold",
         placements=[("Open exchange", 1800, 390000, 366)]),
    dict(id="dp-3", channel="display", name="Retarget — left in cart", spend=3400,
         units=730000, completion=None, conversions=578, verdict="hold",
         placements=[("Open exchange", 2100, 452000, 347), ("PMP", 1300, 278000, 231)]),
    dict(id="dp-4", channel="display", name="New: Detroit-style", spend=1700,
         units=360000, completion=None, conversions=286, verdict="pause",
         placements=[("Open exchange", 1700, 360000, 286)]),
]
# Metrics that can actually be captured at the creative level, per channel.
# Deliberately different per channel — a video creative has a completion curve
# and no open rate; an email creative is the reverse.
CREATIVE_METRICS = {
    "dp-1": dict(clicks=558, ctr=0.0009, viewability=0.812, timeInView=6.9),
    "dp-2": dict(clicks=351, ctr=0.0009, viewability=0.688, timeInView=4.2),
    "dp-3": dict(clicks=657, ctr=0.0009, viewability=0.604, timeInView=7.4),
    "dp-4": dict(clicks=324, ctr=0.0009, viewability=0.641, timeInView=5.1),
    "vd-1": dict(q25=0.982, q50=0.972, q75=0.964, q100=0.951, cpcv=0.0225, viewability=0.784),
    "vd-2": dict(q25=0.974, q50=0.961, q75=0.947, q100=0.938, cpcv=0.0234, viewability=0.771),
    "vd-3": dict(q25=0.706, q50=0.658, q75=0.629, q100=0.612, cpcv=0.0368, viewability=0.672),
    "vd-4": dict(q25=0.741, q50=0.694, q75=0.667, q100=0.649, cpcv=0.0362, viewability=0.663),
    "em-1": dict(delivered=104000, openRateReported=0.468, openRateModelled=0.302,
                 clicks=2290, clickRate=0.0220, unsubRate=0.0038),
    "em-2": dict(delivered=82000, openRateReported=0.431, openRateModelled=0.278,
                 clicks=1610, clickRate=0.0196, unsubRate=0.0054),
}
CREATIVE_ASSETS = {
    "dp-1": ("image", "creative-dp-1.svg", "300x250"),
    "dp-2": ("image", "creative-dp-2.svg", "728x90"),
    "dp-3": ("image", "creative-dp-3.svg", "300x600"),
    "dp-4": ("image", "creative-dp-4.svg", "300x250"),
    "vd-1": ("video", "video-creative.mp4", ":15 non-skippable"),
    "vd-2": ("video", "video-creative.mp4", ":30 non-skippable"),
    "vd-3": ("video", "video-creative.mp4", ":30 skippable"),
    "vd-4": ("video", "video-creative.mp4", ":15 skippable"),
    "em-1": ("image", "creative-em-1.svg", "600x300"),
    "em-2": ("image", "creative-em-2.svg", "600x300"),
}
for c in creatives:
    c["cpa"] = round(c["spend"] / c["conversions"], 2)
    c["metrics"] = CREATIVE_METRICS[c["id"]]
    kind, asset, fmt = CREATIVE_ASSETS[c["id"]]
    c["assetKind"] = kind
    c["asset"] = f"../madhive-assets/{asset}"
    c["poster"] = "../madhive-assets/video-poster.svg" if kind == "video" else None
    c["format"] = fmt
    c["placements"] = [dict(name=p[0], spend=p[1], units=p[2], conversions=p[3],
                            cpa=round(p[1] / p[3], 2)) for p in c["placements"]]

# ---------------------------------------------------------------- assemble
# --------------------------------------------------------------- offline
# A store visit is not observed by us. It is inferred, and the inference has
# named weak points — which is why the widget shows the chain, not just a number.
offline = dict(
    method="IP-to-device geofence match",
    windowDays=A["offlineWindowDays"],
    radiusM=A["geofenceRadius"],
    matchRate=A["offlineMatchRate"],
    lagDays=3,
    chain=[
        dict(step="Impression",
             what="The ad is served. The bid request carries the household IP.",
             holds="Solid. This is our own log."),
        dict(step="Vendor feed",
             what="A third-party location vendor sends device IDs seen inside a "
                  "%dm geofence around each shop, with the IPs those devices used."
                  % A["geofenceRadius"],
             holds="Solid for the sighting. We are trusting their panel's coverage."),
        dict(step="IP match",
             what="Impression IP is matched against the device's IP.",
             holds="Weakest link. Mobile carrier IPs rotate and shared IPs collide."),
        dict(step="Window",
             what="A visit inside %d days of the impression is credited."
                  % A["offlineWindowDays"],
             holds="A choice, not a fact. Widen it and the number grows."),
    ],
    caveat="Matched visits only. Roughly %d%% of impressions resolve to a device we "
           "can follow, so this is a floor — the true number is higher and we cannot "
           "say by how much." % round(A["offlineMatchRate"] * 100),
)

data = dict(
    meta=dict(
        advertiser="Bella Vita Pizza",
        descriptor="6 shops · Portland, OR",
        flightStart=(START + timedelta(days=DAYS - WINDOW)).isoformat(),
        flightEnd=(START + timedelta(days=DAYS - 1)).isoformat(),
        generatedAt="2026-08-19T06:00:00-07:00",
        window=WINDOW,
        synthetic=True,
        sources=[
            "Display CPM $3.12 GDN / $8.20 PMP; 72% cross-network viewability (2026)",
            "MRC viewability: 50% of pixels for 1s (display), 2s (video)",
            "Skippable in-stream VCR 60%+; non-skippable 90%+ (2026)",
            "Email: 43.46% avg open inflated 15-20pts by Apple MPP; 2.09% click on delivered; 0.46% unsubscribe",
        ],
    ),
    assumptions=ASSUMPTIONS,
    constants=dict(emailSpendCap=A["emailSpendCap"]),
    channels=CHANNELS,
    daily=daily,
    totals=totals,
    video=video,
    email=email,
    display=display,
    creatives=creatives,
    offline=offline,
)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    json.dump(data, f, indent=1)

print("Wrote %s" % os.path.relpath(OUT))
print("  %d channels · %d days (%d-day window) · %d creatives"
      % (len(CHANNELS), DAYS, WINDOW, len(creatives)))
for f_ in ("spend", "conversions"):
    t = totals[f_]
    pct = (t["current"] / t["prior"] - 1) * 100
    print(f"  {f_:12} {t['current']:>12,.0f}  vs prior {t['prior']:>12,.0f}  ({pct:+.1f}%)")
for c in CHANNELS:
    print("  %-8s CPA $%7.2f  next order $%7.2f  floor $%6.2f"
          % (c["key"], c["cpa"], c["marginalCpa"], c["floorCpa"]))
