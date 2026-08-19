#!/usr/bin/env python3
"""Generate the synthetic campaign dataset for the MadHive demo dashboard.

Writes public/data/madhive-campaign.json, which the React dashboard fetches at
runtime. Regenerate with:  python3 scripts/generate_madhive_data.py

All figures are fabricated for a fictional advertiser. They are modelled on
published 2026 benchmarks (cited in `meta.sources`) so the shape of the data is
realistic: display CPM ~$3-8, MRC viewability standards, skippable vs
non-skippable video completion, and email open rates inflated by Apple MPP.
"""
import json
import math
import os
from datetime import date, timedelta

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data", "madhive-campaign.json")

# ---------------------------------------------------------------- assumptions
# Every non-metric number on the dashboard is declared here with the basis for
# it. Anything without a defensible basis was removed rather than guessed.
ASSUMPTIONS = [
    dict(key="leadValue", label="Gross profit per qualified lead", value=340, unit="$",
         adjustable=True,
         basis="Advertiser-supplied: 12% lead-to-sale close rate x $2,833 average front+back "
               "gross per unit. Their finance team's number, not ours — we take it as an input."),
    dict(key="targetReturn", label="Required return on media", value=3.5, unit="x",
         adjustable=True,
         basis="Dealer group's internal capital hurdle: media must return 3.5x contribution to "
               "beat their next-best use of the same dollar. Policy, not measurement."),
    dict(key="subscriberValue", label="Value of an email subscriber", value=38, unit="$",
         adjustable=False,
         basis="Computed, not assumed: trailing-12-month email-attributed gross profit divided "
               "by mean active subscribers over the same period."),
    dict(key="emailSpendCap", label="Email spend ceiling", value=30000, unit="$",
         adjustable=False,
         basis="List-burn constraint. Beyond ~4 sends/subscriber/month unsubscribe rate passes "
               "0.5% and net list growth turns negative. Extra budget past this point cannot buy "
               "more sends, so the response curve does not apply above it."),
]
A = {a["key"]: a["value"] for a in ASSUMPTIONS}
VALUE_PER_CONVERSION = A["leadValue"]
SUBSCRIBER_VALUE = A["subscriberValue"]
START = date(2026, 7, 19)
DAYS = 30

# ------------------------------------------------------------- lift tests
# Incrementality is the second load-bearing assumption after the ceiling, so it
# carries its design and its confidence interval. A point estimate with no
# interval is false precision — and the whole reallocation rests on these.
#
#   incremental = (rate_test - rate_control) x N_test
#   rate        = incremental / attributed
#
# Design differs by channel because what is feasible differs. User-level
# withholding is easy in email and possible via ghost bids in programmatic; CTV
# generally cannot withhold per household across publishers, so it falls back to
# matched geos — which have far fewer units of randomisation and therefore much
# wider intervals, even on large impression counts.
LIFT = {
    "display": dict(
        method="Ghost bids",
        design="Control users entered the auction and were recorded as won, then served nothing. "
               "Matched on targeting and auction dynamics.",
        window="4 weeks, 22 Jun – 19 Jul 2026",
        controlShare=0.10, units="30.2M impressions, user-level randomisation",
        point=0.270, ciLow=0.241, ciHigh=0.302, pValue="<0.001"),
    "video": dict(
        method="Matched-market geo holdout",
        design="18 matched DMA pairs, channel dark in one of each pair. Household-level "
               "withholding is not possible across CTV publishers.",
        window="4 weeks, 22 Jun – 19 Jul 2026",
        controlShare=0.50, units="18 matched DMA pairs — only 18 units of randomisation",
        point=0.854, ciLow=0.718, ciHigh=0.960, pValue="0.003"),
    "email": dict(
        method="Randomised list holdout",
        design="8% of subscribers withheld from every send in the window, randomised at the "
               "subscriber level and re-randomised each send.",
        window="4 weeks, 22 Jun – 19 Jul 2026",
        controlShare=0.08, units="460K subscribers, subscriber-level randomisation",
        point=0.250, ciLow=0.214, ciHigh=0.287, pValue="<0.001"),
}

# ---------------------------------------------------------------- channels
CHANNELS = [
    dict(key="display", label="Display", color="#2a78d6",
         spend=148000, impressions=30204000, cpm=4.90, clicks=27184,
         conversionsLast=3910, halfSaturationSpend=150000,
         reach=1240000, note="64% of spend is retargeting — that's why lift is low."),
    dict(key="video", label="Online video", color="#eb6834",
         spend=232000, impressions=10357000, cpm=22.40, clicks=9640,
         conversionsLast=4240, halfSaturationSpend=1000000,
         reach=742000, note="The only channel buying genuinely new reach."),
    dict(key="email", label="Email", color="#1baf7a",
         spend=22000, impressions=1798000, cpm=12.24, clicks=37600,
         conversionsLast=5880, halfSaturationSpend=20000,
         reach=460000, note="Cheapest per conversion, but the list is finite."),
]
for c in CHANNELS:
    # Incremental conversions are DERIVED from the lift point estimate, not typed
    # in separately — so the ratio on the page and the test result cannot diverge.
    lift = LIFT[c["key"]]
    c["lift"] = lift
    c["conversionsIncr"] = round(c["conversionsLast"] * lift["point"])
    c["conversionsIncrLow"] = round(c["conversionsLast"] * lift["ciLow"])
    c["conversionsIncrHigh"] = round(c["conversionsLast"] * lift["ciHigh"])
    # Hill response curve: conversions(s) = Cmax*s/(K+s). K is the fitted
    # half-saturation spend; Cmax falls out of the observed (spend, conversions).
    K = c["halfSaturationSpend"]
    c["maxConversions"] = round(c["conversionsIncr"] * (K + c["spend"]) / c["spend"], 1)
    c["marginalCpic"] = round((K + c["spend"]) ** 2 / (c["maxConversions"] * K), 2)
    c["floorCpic"] = round(K / c["maxConversions"], 2)
    c["ctr"] = round(c["clicks"] / c["impressions"], 5)
    c["incrementalityRate"] = round(c["conversionsIncr"] / c["conversionsLast"], 3)
    c["cpaLast"] = round(c["spend"] / c["conversionsLast"], 2)
    c["cpic"] = round(c["spend"] / c["conversionsIncr"], 2)
    c["frequency"] = round(c["impressions"] / c["reach"], 1)

# ---------------------------------------------------------------- daily
def day_weight(key: str, i: int) -> float:
    """Deterministic daily shape. Weekend lift on video, twice-weekly email sends."""
    weekly = [1.04, 1.00, 0.97, 0.99, 1.03, 1.12, 1.16][i % 7]
    trend = {"video": 1 + i * 0.006, "display": 1 - i * 0.002, "email": 1 + i * 0.001}[key]
    wobble = 1 + 0.05 * math.sin(i * 1.7 + {"display": 0, "video": 1, "email": 2}[key])
    base = weekly * trend * wobble
    if key == "email":                       # sends land Tue + Fri; trickle in between
        base *= 1.0 if i % 7 in (1, 4) else 0.12
    return base

daily = []
weights = {c["key"]: [day_weight(c["key"], i) for i in range(DAYS)] for c in CHANNELS}
totals = {k: sum(v) for k, v in weights.items()}
for i in range(DAYS):
    row = {"date": (START + timedelta(days=i)).isoformat()}
    for c in CHANNELS:
        share = weights[c["key"]][i] / totals[c["key"]]
        row[c["key"]] = {
            "spend": round(c["spend"] * share, 2),
            "impressions": round(c["impressions"] * share),
            "conversionsLast": round(c["conversionsLast"] * share, 1),
            "conversionsIncr": round(c["conversionsIncr"] * share, 1),
        }
    daily.append(row)

# Marginal curves and the reallocation are NOT stored — the dashboard derives
# them from the response-curve parameters above, so they cannot drift apart from
# the conversion totals the way two hand-written tables would.

# ---------------------------------------------------------------- video
video = dict(
    quartiles=[
        dict(stage="Start", nonskip=100.0, skip=100.0),
        dict(stage="25%",   nonskip=97.8,  skip=71.4),
        dict(stage="50%",   nonskip=96.1,  skip=66.2),
        dict(stage="75%",   nonskip=95.2,  skip=63.9),
        dict(stage="100%",  nonskip=94.6,  skip=62.8),
    ],
    types=[
        dict(type="Non-skippable + bumper", spend=109200, impressions=3900000, cpm=28.00,
             vcr=94.6, cpcv=0.030, viewability=78.4, cpic=58.10),
        dict(type="Skippable in-stream", spend=122800, impressions=6457000, cpm=19.02,
             vcr=62.8, cpcv=0.030, viewability=66.9, cpic=71.40),
    ],
)
video["dropoff"] = [
    dict(stage=f'{video["quartiles"][i-1]["stage"]} → {video["quartiles"][i]["stage"]}',
         nonskip=round(video["quartiles"][i]["nonskip"] - video["quartiles"][i-1]["nonskip"], 1),
         skip=round(video["quartiles"][i]["skip"] - video["quartiles"][i-1]["skip"], 1))
    for i in range(1, len(video["quartiles"]))
]

# ---------------------------------------------------------------- email
email = dict(
    funnel=[
        dict(stage="Sent", value=1840000, note=None, suspect=False),
        dict(stage="Delivered", value=1798000, note="97.7% of sent", suspect=False),
        dict(stage="Opens — reported", value=782000, note="43.5% · inflated by Apple MPP", suspect=True),
        dict(stage="Opens — modelled human", value=502000, note="27.9% · what we actually use", suspect=False),
        dict(stage="Clicks", value=37600, note="2.09% of delivered", suspect=False),
        dict(stage="Conversions", value=5880, note="last-touch", suspect=False),
        dict(stage="Incremental", value=1470, note="25% of last-touch", suspect=False),
    ],
    listHealth=[
        dict(metric="Active subscribers", value=460000, benchmark=None),
        dict(metric="New subscribers", value=18400, benchmark=None),
        dict(metric="Unsubscribes", value=-8272, benchmark="0.46%"),
        dict(metric="Bounced / cleaned", value=-2100, benchmark="2.3%"),
        dict(metric="Net monthly change", value=8028, benchmark=None),
    ],
    frequency=[
        dict(sends=2, incremental=890,  unsubRate=0.31, netList=12900),
        dict(sends=3, incremental=1240, unsubRate=0.38, netList=10800),
        dict(sends=4, incremental=1470, unsubRate=0.46, netList=8028),
        dict(sends=5, incremental=1588, unsubRate=0.81, netList=1600),
        dict(sends=6, incremental=1642, unsubRate=1.34, netList=-8900),
        dict(sends=8, incremental=1655, unsubRate=2.21, netList=-28400),
    ],
)

# ---------------------------------------------------------------- display
display = dict(
    viewability=[
        dict(marketplace="Private marketplace", rate=84.6, spend=52100, isBenchmark=False),
        dict(marketplace="Native placements", rate=81.0, spend=16500, isBenchmark=False),
        dict(marketplace="Cross-network avg 2026", rate=72.0, spend=None, isBenchmark=True),
        dict(marketplace="Open exchange", rate=61.2, spend=79400, isBenchmark=False),
    ],
    metrics=[
        dict(metric="Click-through rate", value="0.09%",
             reads="In line with display norms. Not comparable to email's 2.09% — different denominator, different audience."),
        dict(metric="Avg time in view", value="6.2s",
             reads="Healthy. Impressions that are viewable are getting real dwell."),
        dict(metric="Invalid traffic (IVT)", value="2.1%",
             reads="Under the 3% action threshold. Not the problem here."),
        dict(metric="Retargeting share of spend", value="64%",
             reads="The reason incrementality is only 27%. We pay to reach people already in-market."),
    ],
)
for v in display["viewability"]:
    v["wasted"] = None if v["isBenchmark"] else round(v["spend"] * (1 - v["rate"] / 100))

# ---------------------------------------------------------------- creatives
creatives = [
    dict(id="em-1", channel="email", name="Service reminder — 45k mile", spend=5200,
         units=412000, completion=None, conversions=2140, cpic=12.40, verdict="scale",
         placements=[("Segment: owners 30–50k mi", 3100, 248000, 1380),
                     ("Segment: lapsed 12mo+", 2100, 164000, 760)]),
    dict(id="em-2", channel="email", name="Lease-end offer", spend=6800,
         units=388000, completion=None, conversions=1610, cpic=16.80, verdict="scale",
         placements=[("Lease ending ≤90d", 4200, 201000, 1090),
                     ("Lease ending 91–180d", 2600, 187000, 520)]),
    dict(id="vd-1", channel="video", name="Summer Event :15 — non-skip", spend=64800,
         units=2310000, completion=95.1, conversions=1290, cpic=50.20, verdict="scale",
         placements=[("Local broadcaster app", 31200, 1090000, 690),
                     ("Premium AVOD", 22400, 798000, 412),
                     ("FAST — news", 11200, 422000, 188)]),
    dict(id="vd-2", channel="video", name="Test Drive :30 — non-skip", spend=44400,
         units=1590000, completion=93.8, conversions=842, cpic=52.70, verdict="scale",
         placements=[("Premium AVOD", 26100, 934000, 510),
                     ("FAST — entertainment", 18300, 656000, 332)]),
    dict(id="vd-3", channel="video", name="Brand Anthem :30 — skippable", spend=71200,
         units=3742000, completion=61.2, conversions=996, cpic=71.50, verdict="fix",
         placements=[("Web pre-roll", 42800, 2250000, 588),
                     ("Mobile in-app", 28400, 1492000, 408)]),
    dict(id="vd-4", channel="video", name="Inventory :15 — skippable", spend=51600,
         units=2715000, completion=64.9, conversions=492, cpic=104.90, verdict="pause",
         placements=[("Web pre-roll", 30900, 1626000, 301),
                     ("Mobile in-app", 20700, 1089000, 191)]),
    dict(id="dp-1", channel="display", name="Prospecting — in-market auto", spend=48200,
         units=10600000, completion=None, conversions=398, cpic=121.10, verdict="hold",
         placements=[("PMP", 29600, 6100000, 268), ("Open exchange", 18600, 4500000, 130)]),
    dict(id="dp-2", channel="display", name="Native — model comparison", spend=16500,
         units=2704000, completion=None, conversions=142, cpic=116.20, verdict="hold",
         placements=[("Native exchange", 16500, 2704000, 142)]),
    dict(id="dp-3", channel="display", name="Retarget — VDP abandoners", spend=61400,
         units=11800000, completion=None, conversions=402, cpic=152.70, verdict="cut",
         placements=[("Open exchange", 38900, 7900000, 231), ("PMP", 22500, 3900000, 171)]),
    dict(id="dp-4", channel="display", name="Conquest — competitor owners", spend=21900,
         units=5100000, completion=None, conversions=113, cpic=193.80, verdict="pause",
         placements=[("Open exchange", 21900, 5100000, 113)]),
]
for c in creatives:
    c["placements"] = [
        dict(name=p[0], spend=p[1], units=p[2], conversions=p[3],
             cpic=round(p[1] / p[3], 2)) for p in c["placements"]
    ]

# ---------------------------------------------------------------- assemble
data = dict(
    meta=dict(
        advertiser="Cascade Auto Group",
        descriptor="4 rooftops · Portland–Vancouver DMA",
        flightStart=START.isoformat(),
        flightEnd=(START + timedelta(days=DAYS - 1)).isoformat(),
        generatedAt="2026-08-19T06:00:00-07:00",
        owner="Media Analytics",
        goal="Figure out which channels are working best so we can run more of them.",
        synthetic=True,
        sources=[
            "Display CPM $3.12 GDN / $8.20 PMP; 72% cross-network viewability (2026)",
            "MRC viewability: 50% of pixels for 1s (display), 2s (video)",
            "Skippable in-stream VCR 60%+; non-skippable 90%+ (2026)",
            "Email: 43.46% avg open inflated 15–20pts by Apple MPP; 2.09% click on delivered; 6.81% median CTOR; 0.46% unsubscribe",
        ],
    ),
    assumptions=ASSUMPTIONS,
    constants=dict(valuePerConversion=VALUE_PER_CONVERSION,
                   subscriberValue=SUBSCRIBER_VALUE,
                   emailSpendCap=A["emailSpendCap"],
                   targetReturn=A["targetReturn"]),
    channels=CHANNELS,
    daily=daily,
    video=video,
    email=email,
    display=display,
    creatives=creatives,
)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    json.dump(data, f, indent=1)

tot_spend = sum(c["spend"] for c in CHANNELS)
tot_incr = sum(c["conversionsIncr"] for c in CHANNELS)
print(f"Wrote {os.path.relpath(OUT)}")
print(f"  {len(CHANNELS)} channels · {len(daily)} days · {len(creatives)} creatives")
print(f"  spend ${tot_spend:,} · incremental {tot_incr:,} · blended CPiC ${tot_spend/tot_incr:,.2f}")
