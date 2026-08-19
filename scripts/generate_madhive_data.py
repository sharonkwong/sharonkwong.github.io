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
    dict(key="leadValue", label="Gross profit per qualified lead", value=340, unit="$",
         adjustable=True,
         basis="Advertiser-supplied: 12% lead-to-sale close rate x $2,833 average front+back "
               "gross per unit. Their finance team's number — we take it as an input."),
    dict(key="targetReturn", label="Required return on media", value=3.5, unit="x",
         adjustable=True,
         basis="Dealer group's internal capital hurdle: media must return 3.5x contribution "
               "to beat their next-best use of the same dollar. Policy, not measurement."),
    dict(key="emailSpendCap", label="Email spend ceiling", value=30000, unit="$",
         adjustable=False,
         basis="List-burn constraint. Past ~4 sends/subscriber/month the unsubscribe rate "
               "passes 0.5% and net list growth turns negative, so extra budget cannot buy "
               "more sends and the response curve stops applying."),
]
A = {a["key"]: a["value"] for a in ASSUMPTIONS}
LEAD_VALUE = A["leadValue"]
SUBSCRIBER_VALUE = 38
START = date(2026, 6, 19)
DAYS = 60
WINDOW = 30

# ---------------------------------------------------------------- channels
# halfSaturationSpend (K) is the fitted response-curve parameter: the spend at
# which a channel delivers half of everything it could ever deliver. Everything
# marginal derives from it, so no second hand-written table can drift out of
# step with the conversion totals.
CHANNELS = [
    dict(key="display", label="Display", color="#2a78d6",
         spend=148000, impressions=30204000, clicks=27184, conversions=3910,
         halfSaturationSpend=150000, reach=1240000, reachUnit="cookies / device IDs"),
    dict(key="video", label="Online video", color="#eb6834",
         spend=232000, impressions=10357000, clicks=9640, conversions=4240,
         halfSaturationSpend=1000000, reach=742000, reachUnit="IP households"),
    dict(key="email", label="Email", color="#1baf7a",
         spend=22000, impressions=1798000, clicks=37600, conversions=5880,
         halfSaturationSpend=20000, reach=460000, reachUnit="subscribers"),
]
for c in CHANNELS:
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

# ------------------------------------------------------------------ reach
# IP is the household identifier in CTV — streaming devices carry no cookie and a
# home router NATs everyone onto one public IPv4. Real practice, imprecise BOTH
# ways: IPv6 rotates addresses so one home looks like many (over-counts); CGNAT
# puts thousands of subscribers behind one IPv4 so many homes look like one
# (under-counts). The three channels also share no common identifier, so a
# cross-channel dedupe runs through a probabilistic identity graph. Reported as a
# range. IP is weak for ADDRESSABILITY (which household) and better for
# DEDUPLICATION (that a household is distinct) — only the second is needed here.
reach = dict(
    dedupedLow=740000, dedupedHigh=1120000,
    method="Identity graph joining IP households, device IDs and hashed email. Display "
           "cookies collapsed to households at 2.0-2.5 devices each; the band spans "
           "plausible overlap between prospecting video and retargeted display.",
    source="CIMM / Go Addressable (2025): IP-to-postal matching accurate 13-16% of the time.",
)

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
        dict(type="Non-skippable + bumper", spend=109200, impressions=3900000, cpm=28.00,
             vcr=94.6, cpcv=0.030, viewability=78.4, cpa=51.30),
        dict(type="Skippable in-stream", spend=122800, impressions=6457000, cpm=19.02,
             vcr=62.8, cpcv=0.030, viewability=66.9, cpa=58.10),
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
        dict(stage="Sent", value=1840000, note=None, suspect=False),
        dict(stage="Delivered", value=1798000, note="97.7% of sent", suspect=False),
        dict(stage="Opens — reported", value=782000, note="43.5% · inflated by Apple MPP", suspect=True),
        dict(stage="Opens — modelled human", value=502000, note="27.9% · what we use", suspect=False),
        dict(stage="Clicks", value=37600, note="2.09% of delivered", suspect=False),
        dict(stage="Conversions", value=5880, note=None, suspect=False),
    ],
    listHealth=[
        dict(metric="Active subscribers", value=460000, benchmark=None),
        dict(metric="New subscribers", value=18400, benchmark=None),
        dict(metric="Unsubscribes", value=-8272, benchmark="0.46%"),
        dict(metric="Bounced / cleaned", value=-2100, benchmark="2.3%"),
        dict(metric="Net monthly change", value=8028, benchmark=None),
    ],
    frequency=[
        dict(sends=2, conversions=3560, unsubRate=0.31, netList=12900),
        dict(sends=3, conversions=4960, unsubRate=0.38, netList=10800),
        dict(sends=4, conversions=5880, unsubRate=0.46, netList=8028),
        dict(sends=5, conversions=6352, unsubRate=0.81, netList=1600),
        dict(sends=6, conversions=6568, unsubRate=1.34, netList=-8900),
        dict(sends=8, conversions=6620, unsubRate=2.21, netList=-28400),
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
        dict(metric="Avg time in view", value="6.2s",
             reads="Healthy. Impressions that are viewable are getting real dwell."),
        dict(metric="Invalid traffic (IVT)", value="2.1%",
             reads="Under the 3% action threshold. Not the problem here."),
        dict(metric="Retargeting share of spend", value="64%",
             reads="Most of display is reaching people already shopping."),
    ],
)
for v in display["viewability"]:
    v["wasted"] = None if v["isBenchmark"] else round(v["spend"] * (1 - v["rate"] / 100))

# ---------------------------------------------------------------- creatives
creatives = [
    dict(id="em-1", channel="email", name="Service reminder — 45k mile", spend=5200,
         units=412000, completion=None, conversions=1712, verdict="scale",
         placements=[("Segment: owners 30-50k mi", 3100, 248000, 1104),
                     ("Segment: lapsed 12mo+", 2100, 164000, 608)]),
    dict(id="em-2", channel="email", name="Lease-end offer", spend=6800,
         units=388000, completion=None, conversions=1288, verdict="scale",
         placements=[("Lease ending <=90d", 4200, 201000, 872),
                     ("Lease ending 91-180d", 2600, 187000, 416)]),
    dict(id="vd-1", channel="video", name="Summer Event :15 — non-skip", spend=64800,
         units=2310000, completion=95.1, conversions=1462, verdict="scale",
         placements=[("Local broadcaster app", 31200, 1090000, 782),
                     ("Premium AVOD", 22400, 798000, 467),
                     ("FAST — news", 11200, 422000, 213)]),
    dict(id="vd-2", channel="video", name="Test Drive :30 — non-skip", spend=44400,
         units=1590000, completion=93.8, conversions=954, verdict="scale",
         placements=[("Premium AVOD", 26100, 934000, 578),
                     ("FAST — entertainment", 18300, 656000, 376)]),
    dict(id="vd-3", channel="video", name="Brand Anthem :30 — skippable", spend=71200,
         units=3742000, completion=61.2, conversions=1129, verdict="fix",
         placements=[("Web pre-roll", 42800, 2250000, 666),
                     ("Mobile in-app", 28400, 1492000, 463)]),
    dict(id="vd-4", channel="video", name="Inventory :15 — skippable", spend=51600,
         units=2715000, completion=64.9, conversions=695, verdict="pause",
         placements=[("Web pre-roll", 30900, 1626000, 425),
                     ("Mobile in-app", 20700, 1089000, 270)]),
    dict(id="dp-1", channel="display", name="Prospecting — in-market auto", spend=48200,
         units=10600000, completion=None, conversions=1402, verdict="hold",
         placements=[("PMP", 29600, 6100000, 944), ("Open exchange", 18600, 4500000, 458)]),
    dict(id="dp-2", channel="display", name="Native — model comparison", spend=16500,
         units=2704000, completion=None, conversions=502, verdict="hold",
         placements=[("Native exchange", 16500, 2704000, 502)]),
    dict(id="dp-3", channel="display", name="Retarget — VDP abandoners", spend=61400,
         units=11800000, completion=None, conversions=1608, verdict="hold",
         placements=[("Open exchange", 38900, 7900000, 924), ("PMP", 22500, 3900000, 684)]),
    dict(id="dp-4", channel="display", name="Conquest — competitor owners", spend=21900,
         units=5100000, completion=None, conversions=398, verdict="pause",
         placements=[("Open exchange", 21900, 5100000, 398)]),
]
for c in creatives:
    c["cpa"] = round(c["spend"] / c["conversions"], 2)
    c["placements"] = [dict(name=p[0], spend=p[1], units=p[2], conversions=p[3],
                            cpa=round(p[1] / p[3], 2)) for p in c["placements"]]

# ---------------------------------------------------------------- assemble
data = dict(
    meta=dict(
        advertiser="Cascade Auto Group",
        descriptor="4 rooftops · Portland-Vancouver DMA",
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
            "CIMM / Go Addressable (2025): IP-to-household accuracy 13-16%",
        ],
    ),
    assumptions=ASSUMPTIONS,
    constants=dict(leadValue=LEAD_VALUE, targetReturn=A["targetReturn"],
                   emailSpendCap=A["emailSpendCap"], subscriberValue=SUBSCRIBER_VALUE),
    channels=CHANNELS,
    daily=daily,
    totals=totals,
    reach=reach,
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
    print("  %-8s CPA $%7.2f  next conv $%7.2f  floor $%6.2f"
          % (c["key"], c["cpa"], c["marginalCpa"], c["floorCpa"]))
