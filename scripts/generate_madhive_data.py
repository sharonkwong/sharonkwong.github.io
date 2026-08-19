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
    dict(key="leadValue", label="Profit per online order", value=22, unit="$",
         adjustable=True,
         basis="Owner-supplied: $34 average ticket less food, packaging and delivery cost, "
               "plus the second order a new customer places within 90 days. Their number, "
               "not ours — we take it as an input."),
    dict(key="targetReturn", label="Required return on ad spend", value=2.0, unit="x",
         adjustable=True,
         basis="The owner wants every $1 of advertising to return $2 of profit before it is "
               "worth doing. A policy choice, not a measurement."),
    dict(key="emailSpendCap", label="Email spend ceiling", value=5600, unit="$",
         adjustable=False,
         basis="List-burn constraint. Past ~4 emails a month the unsubscribe rate passes 0.5% "
               "and the list starts shrinking, so extra budget cannot buy more sends and the "
               "response curve stops applying."),
]
A = {a["key"]: a["value"] for a in ASSUMPTIONS}
LEAD_VALUE = A["leadValue"]
SUBSCRIBER_VALUE = 9
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
        exposedRate=0.00326, controlRate=0.00238, ciLow=0.241, ciHigh=0.302,
        why="Most display spend retargets people who already left an order in the cart."),
    "video": dict(
        method="Matched-market geo holdout",
        design="18 matched DMA pairs with the channel dark in one of each pair. Household-level "
               "withholding is not possible across CTV publishers.",
        units="22 matched ZIP pairs",
        exposedRate=0.00719, controlRate=0.00108, ciLow=0.718, ciHigh=0.960,
        why="Reaching people who were not already thinking about dinner."),
    "email": dict(
        method="Randomised list holdout",
        design="8% of subscribers withheld from every send in the window, re-randomised each send.",
        units="subscriber-level randomisation",
        exposedRate=0.04806, controlRate=0.03605, ciLow=0.214, ciHigh=0.287,
        why="The list is regulars, and regulars order pizza on their own schedule."),
}

# ---------------------------------------------------------------- channels
# halfSaturationSpend (K) is the fitted response-curve parameter: the spend at
# which a channel delivers half of everything it could ever deliver. Everything
# marginal derives from it, so no second hand-written table can drift out of
# step with the conversion totals.
CHANNELS = [
    dict(key="display", label="Display", color="#2a78d6",
         spend=9800, impressions=2100000, clicks=1890, conversions=1240,
         halfSaturationSpend=12000, reach=380000, reachUnit="devices"),
    dict(key="video", label="Online video", color="#eb6834",
         spend=14200, impressions=640000, clicks=590, conversions=1510,
         halfSaturationSpend=200000, reach=210000, reachUnit="households"),
    dict(key="email", label="Email", color="#1baf7a",
         spend=4000, impressions=186000, clicks=3900, conversions=2980,
         halfSaturationSpend=3000, reach=62000, reachUnit="subscribers"),
]
for c in CHANNELS:
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
    c["convRate"] = round(n / c["clicks"], 4)
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
            conversions=round(c["conversions"] * conv_w[c["key"]][i] / recent_conv[c["key"]], 1),
        )
    daily.append(row)

def wtot(field, lo, hi):
    return sum(sum(d[c["key"]][field] for c in CHANNELS) for d in daily[lo:hi])

CUR = (DAYS - WINDOW, DAYS)
PRV = (DAYS - 2 * WINDOW, DAYS - WINDOW)
totals = {f: dict(current=round(wtot(f, *CUR), 2), prior=round(wtot(f, *PRV), 2))
          for f in ("spend", "impressions", "clicks", "conversions")}

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
             vcr=94.6, cpcv=0.030, viewability=78.4, cpa=8.42),
        dict(type="Skippable in-stream", spend=7500, impressions=400000, cpm=18.75,
             vcr=62.8, cpcv=0.030, viewability=66.9, cpa=10.31),
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
        dict(stage="Online orders", value=2980, note=None, suspect=False),
    ],
    listHealth=[
        dict(metric="Active subscribers", value=62000, benchmark=None),
        dict(metric="New subscribers", value=2400, benchmark=None),
        dict(metric="Unsubscribes", value=-856, benchmark="0.46%"),
        dict(metric="Bounced / cleaned", value=-220, benchmark="2.3%"),
        dict(metric="Net monthly change", value=1324, benchmark=None),
    ],
    frequency=[
        dict(sends=2, conversions=1980, unsubRate=0.31, netList=2100),
        dict(sends=3, conversions=2560, unsubRate=0.38, netList=1760),
        dict(sends=4, conversions=2980, unsubRate=0.46, netList=1324),
        dict(sends=5, conversions=3190, unsubRate=0.81, netList=260),
        dict(sends=6, conversions=3268, unsubRate=1.34, netList=-1450),
        dict(sends=8, conversions=3290, unsubRate=2.21, netList=-4620),
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
         units=104000, completion=None, conversions=1780, verdict="scale",
         placements=[("Ordered in last 30d", 1380, 61000, 1140),
                     ("Ordered 31-90d ago", 920, 43000, 640)]),
    dict(id="em-2", channel="email", name="We miss you — 30 days", spend=1700,
         units=82000, completion=None, conversions=1200, verdict="scale",
         placements=[("Lapsed 30-60d", 1020, 47000, 780),
                     ("Lapsed 61-120d", 680, 35000, 420)]),
    dict(id="vd-1", channel="video", name="Fresh out the oven :15", spend=4200,
         units=196000, completion=95.1, conversions=520, verdict="scale",
         placements=[("Local streaming app", 2100, 98000, 281),
                     ("FAST — food & travel", 1300, 61000, 148),
                     ("Premium AVOD", 800, 37000, 91)]),
    dict(id="vd-2", channel="video", name="Meet the dough :30", spend=3600,
         units=164000, completion=93.8, conversions=384, verdict="scale",
         placements=[("Premium AVOD", 2200, 100000, 241),
                     ("FAST — entertainment", 1400, 64000, 143)]),
    dict(id="vd-3", channel="video", name="Family night :30 skippable", spend=4100,
         units=182000, completion=61.2, conversions=372, verdict="fix",
         placements=[("Web pre-roll", 2500, 111000, 231),
                     ("Mobile in-app", 1600, 71000, 141)]),
    dict(id="vd-4", channel="video", name="Late night slice :15 skippable", spend=2300,
         units=98000, completion=64.9, conversions=234, verdict="pause",
         placements=[("Web pre-roll", 1400, 60000, 145),
                     ("Mobile in-app", 900, 38000, 89)]),
    dict(id="dp-1", channel="display", name="Family bundle — $26", spend=2900,
         units=620000, completion=None, conversions=420, verdict="hold",
         placements=[("PMP", 1800, 385000, 276), ("Open exchange", 1100, 235000, 144)]),
    dict(id="dp-2", channel="display", name="Two for Tuesday banner", spend=1800,
         units=390000, completion=None, conversions=244, verdict="hold",
         placements=[("Open exchange", 1800, 390000, 244)]),
    dict(id="dp-3", channel="display", name="Retarget — left in cart", spend=3400,
         units=730000, completion=None, conversions=386, verdict="hold",
         placements=[("Open exchange", 2100, 452000, 232), ("PMP", 1300, 278000, 154)]),
    dict(id="dp-4", channel="display", name="New: Detroit-style", spend=1700,
         units=360000, completion=None, conversions=190, verdict="pause",
         placements=[("Open exchange", 1700, 360000, 190)]),
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
    constants=dict(leadValue=LEAD_VALUE, targetReturn=A["targetReturn"],
                   emailSpendCap=A["emailSpendCap"], subscriberValue=SUBSCRIBER_VALUE),
    channels=CHANNELS,
    daily=daily,
    totals=totals,
    video=video,
    email=email,
    display=display,
    creatives=creatives,
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
