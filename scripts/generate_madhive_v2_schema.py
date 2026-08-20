#!/usr/bin/env python3
"""Build the data-model reference for /madhive/models.

The field-level schema is INTROSPECTED from the JSON the dashboard actually
fetches, not hand-written, so it cannot drift from what ships. The warehouse
tables and the lineage are curated here, because those describe intent rather
than the artefact.

Regenerate with:  python3 scripts/generate_madhive_v2_schema.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "public", "data")
OUT = os.path.join(DATA, "madhive-v2-schema.json")

# --------------------------------------------------------------- introspect

def kind(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, int):
        return "integer"
    if isinstance(v, float):
        return "number"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        return "array"
    return "object"


def sample(v):
    if isinstance(v, (dict, list)):
        s = json.dumps(v, separators=(",", ":"))
        return s[:60] + ("…" if len(s) > 60 else "")
    if isinstance(v, float):
        return f"{v:,.4f}".rstrip("0").rstrip(".")
    if isinstance(v, int):
        return f"{v:,}"
    return str(v)


def describe(rows, notes):
    """Per-field type, example and range across every row of a collection."""
    fields = {}
    for r in rows:
        if not isinstance(r, dict):
            continue
        for k, v in r.items():
            f = fields.setdefault(k, dict(name=k, types=set(), example=None,
                                          lo=None, hi=None, nulls=0))
            t = kind(v)
            f["types"].add(t)
            if v is None:
                f["nulls"] += 1
            elif f["example"] is None:
                f["example"] = sample(v)
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                f["lo"] = v if f["lo"] is None else min(f["lo"], v)
                f["hi"] = v if f["hi"] is None else max(f["hi"], v)
    out = []
    for f in fields.values():
        types = sorted(f["types"] - {"null"}) or ["null"]
        if f["nulls"]:
            types.append("null")
        rng = None
        if f["lo"] is not None and f["hi"] is not None and f["lo"] != f["hi"]:
            fmt = (lambda x: f"{x:,.4f}".rstrip("0").rstrip(".")) if isinstance(f["lo"], float) else (lambda x: f"{x:,}")
            rng = f"{fmt(f['lo'])} – {fmt(f['hi'])}"
        out.append(dict(name=f["name"], type=" | ".join(types), example=f["example"],
                        range=rng, optional=f["nulls"] > 0 or len(rows) != sum(
                            1 for r in rows if isinstance(r, dict) and f["name"] in r),
                        note=notes.get(f["name"], "")))
    return out


# What each field means. Anything missing here shows without a note rather
# than with a guessed one.
NOTES = {
    "daily": {
        "date": "Local calendar day, ISO 8601.",
        "campaign": "FK to campaigns.id.",
        "impressions": "Served impressions. For email campaigns this carries DELIVERED, not served.",
        "clicks": "Clicks on the ad, or on a link inside the email.",
        "conversions": "Online conversions, last touch. Fractional because the daily shape is fitted, not counted.",
        "spend": "Media cost in USD.",
        "sends": "Email only. Attempted sends, before bounces.",
        "opensReported": "Email only. What the ESP reports. Inflated by Apple Mail Privacy Protection.",
        "opensModelled": "Email only. MPP-adjusted. Shown, never used as a denominator.",
        "unsubs": "Email only. Unsubscribes attributed to that day's send.",
    },
    "campaigns": {
        "id": "Primary key.",
        "name": "Display name, shown in the campaign filter.",
        "mediaType": "FK to mediaTypes.key. Drives colour and which native metrics apply.",
    },
    "mediaTypes": {
        "key": "Primary key.",
        "label": "Display name.",
        "color": "Categorical hue. Validated for CVD separation on the dark surface.",
    },
    "devices": {
        "campaign": "FK to campaigns.id.",
        "device": "Mobile, Desktop or Tablet.",
        "impressionShare": "Share of that campaign's impressions. Sums to 1 per campaign.",
        "clickShare": "Share of that campaign's clicks. Sums to 1 per campaign.",
        "conversionShare": "Share of that campaign's conversions. Sums to 1 per campaign.",
    },
    "geo": {
        "zip": "ZCTA code. Joins to the boundary file.",
        "name": "Neighbourhood label.",
        "col": "Legacy tile-grid column. No longer read by the UI.",
        "row": "Legacy tile-grid row. No longer read by the UI.",
        "shares": "Object keyed by campaign id, each holding the three share fields.",
        "medianIncome": "Area profile. Modelled.",
        "medianAge": "Area profile. Modelled.",
        "degreeShare": "Bachelor's or higher. Modelled.",
        "devices": "Share of this ZIP's impressions by device. Reconciled to the campaign-level split by iterative proportional fitting.",
        "os": "Share of this ZIP's mobile impressions by OS. Modelled off median income.",
    },
    "creatives": {
        "id": "Primary key.",
        "campaign": "FK to campaigns.id.",
        "name": "Display name.",
        "format": "Static image, Animated GIF, HTML email or Video.",
        "dimensions": "Pixel size as rendered in the size tag.",
        "seconds": "Video duration. Null for everything else.",
        "impressionShare": "Share of the campaign's impressions. Sums to 1 per campaign.",
        "clickShare": "Share of the campaign's clicks. Sums to 1 per campaign.",
        "conversionShare": "Share of the campaign's conversions. Sums to 1 per campaign.",
        "assetKind": "image or video. Picks the preview element.",
        "asset": "Path relative to the page, so /madhive/v2/ resolves two levels up.",
        "poster": "Video poster frame. Null for images.",
        "quartiles": "Percent still playing at start, 25, 50, 75, 100. Null for non-video.",
        "sections": "Email only. The clickable bands of the creative.",
        "placements": "Sites or apps the creative ran on.",
    },
    "creatives[].placements": {
        "site": "Site, app or mail client.",
        "impressionShare": "Share of the creative's impressions. Sums to 1 per creative.",
        "clickShare": "Share of the creative's clicks. Sums to 1 per creative.",
        "conversionShare": "Share of the creative's conversions. Sums to 1 per creative.",
    },
    "creatives[].sections": {
        "key": "Stable id for the band.",
        "label": "Shown beside the leader line.",
        "x": "Left edge as a fraction of the creative.",
        "y": "Top edge as a fraction of the creative.",
        "w": "Width as a fraction of the creative.",
        "h": "Height as a fraction of the creative.",
        "clickShare": "Share of that email's clicks landing in this band. Sums to 1 per creative.",
    },
    "demographics.<media>.<dimension>": {
        "label": "Bucket name.",
        "share": "Share of that media type's converters. Sums to 1 per dimension.",
    },
    "shapes.zips": {
        "zip": "ZCTA code. Joins to geo.zip.",
        "rings": "Polygon rings as [lon, lat] pairs. Multiple rings where a ZCTA is split.",
    },
}

LAYERS = [
    dict(name="Raw", purpose="Vendor files as they land. Append only, never edited, so a restatement upstream can always be replayed."),
    dict(name="Conformed", purpose="One row per real event, deduplicated, typed, and resolved to shared keys. This is the first layer where a join is safe."),
    dict(name="Marts", purpose="Aggregates cut to the grain a question is asked at. Everything the dashboard shows is defined exactly once, here."),
    dict(name="Served", purpose="The JSON the browser fetches. Shaped so one request answers every panel, with breakdowns stored as shares rather than counts."),
]

TABLES = [
    dict(layer="Raw", name="raw_dsp_delivery", grain="One row per impression or bid response",
         description="Hourly batch from the DSP. Restated for up to 48 hours, so downstream is rebuilt on a trailing window rather than appended to.",
         columns=[("impression_id", "string", "Vendor id. Not stable across restatements."),
                  ("event_ts", "timestamp", "UTC."),
                  ("campaign_id", "string", ""),
                  ("creative_id", "string", ""),
                  ("placement_id", "string", "Site, app or inventory package."),
                  ("device_type", "string", "Reported by the SSP."),
                  ("os", "string", "iOS, Android, or desktop OS."),
                  ("postal_code", "string", "Coarse geo from the bid request."),
                  ("media_cost_usd", "numeric", ""),
                  ("is_click", "boolean", "Click joined back onto the impression by the DSP.")]),
    dict(layer="Raw", name="raw_pixel_event", grain="One row per fired pixel",
         description="Streaming, seconds behind. Late and duplicated: retries, offline queues and blockers mean events land hours late or twice.",
         columns=[("event_id", "string", "Idempotency key. The dedupe runs on this."),
                  ("event_ts", "timestamp", ""),
                  ("event_type", "string", "page_view, add_to_cart, purchase."),
                  ("order_value_usd", "numeric", "Advertiser-supplied where present."),
                  ("click_id", "string", "Set when the visit carried a click identifier."),
                  ("user_key", "string", "Hashed. Used for last-touch attribution.")]),
    dict(layer="Raw", name="raw_esp_event", grain="One row per email event",
         description="From the email service provider. Carries the whole email lifecycle, including the two open numbers.",
         columns=[("event_id", "string", ""),
                  ("event_ts", "timestamp", ""),
                  ("event_type", "string", "send, delivery, bounce, open, click, unsubscribe."),
                  ("campaign_id", "string", ""),
                  ("creative_id", "string", ""),
                  ("section_key", "string", "Set on click events. Which band of the email was clicked."),
                  ("mail_client", "string", "Gmail, Apple Mail, Outlook, Yahoo, Proton."),
                  ("is_mpp_prefetch", "boolean", "Provider's flag that an open came from Apple Mail Privacy Protection.")]),
    dict(layer="Raw", name="raw_zcta_boundary", grain="One row per ZCTA",
         description="US Census 2020 Cartographic Boundary File. Static reference, refreshed when the Census publishes.",
         columns=[("zcta5", "string", "Five-digit ZCTA."),
                  ("geometry", "geometry", "Polygon or multipolygon, WGS84.")]),

    dict(layer="Conformed", name="fct_impression", grain="One row per impression",
         description="Deduplicated on the vendor id within the restatement window, typed, and joined to the dimension keys.",
         columns=[("impression_sk", "bigint", "Surrogate key."),
                  ("event_date", "date", "Local calendar day."),
                  ("campaign_id", "string", "FK dim_campaign."),
                  ("creative_id", "string", "FK dim_creative."),
                  ("placement_id", "string", "FK dim_placement."),
                  ("device_type", "string", "FK dim_device."),
                  ("zcta5", "string", "FK dim_geo_zip."),
                  ("media_cost_usd", "numeric", "")]),
    dict(layer="Conformed", name="fct_click", grain="One row per click",
         description="Display and video clicks from the DSP log, email clicks from the ESP, conformed to one shape so the dashboard never branches on source.",
         columns=[("click_sk", "bigint", ""),
                  ("event_date", "date", ""),
                  ("impression_sk", "bigint", "Null where the click cannot be tied to an impression."),
                  ("campaign_id", "string", ""),
                  ("creative_id", "string", ""),
                  ("placement_id", "string", ""),
                  ("section_key", "string", "Email only. FK dim_creative_section.")]),
    dict(layer="Conformed", name="fct_conversion", grain="One row per conversion",
         description="Deduplicated on the pixel's idempotency key, then attributed. Last touch inside a 30-day window.",
         columns=[("conversion_sk", "bigint", ""),
                  ("event_date", "date", ""),
                  ("click_sk", "bigint", "The attributed click, where there was one."),
                  ("campaign_id", "string", ""),
                  ("creative_id", "string", ""),
                  ("placement_id", "string", ""),
                  ("attribution_model", "string", "last_touch."),
                  ("attribution_window_days", "integer", "30.")]),
    dict(layer="Conformed", name="fct_email_delivery", grain="One row per recipient per send",
         description="The email funnel collapsed to one row per recipient, so sends, delivery, both open numbers and unsubscribe are countable without re-walking the event log.",
         columns=[("send_sk", "bigint", ""),
                  ("event_date", "date", ""),
                  ("campaign_id", "string", ""),
                  ("creative_id", "string", ""),
                  ("was_delivered", "boolean", "False on bounce or suppression."),
                  ("open_reported", "boolean", "Any open event, MPP included."),
                  ("open_modelled", "boolean", "Opens with the MPP prefetch flag removed."),
                  ("was_unsubscribed", "boolean", "")]),
    dict(layer="Conformed", name="dim_campaign", grain="One row per campaign",
         columns=[("campaign_id", "string", "PK."), ("campaign_name", "string", ""),
                  ("media_type", "string", "display, email, video."),
                  ("flight_start", "date", ""), ("flight_end", "date", "")]),
    dict(layer="Conformed", name="dim_creative", grain="One row per creative",
         columns=[("creative_id", "string", "PK."), ("campaign_id", "string", "FK."),
                  ("creative_name", "string", ""), ("format", "string", ""),
                  ("width_px", "integer", ""), ("height_px", "integer", ""),
                  ("duration_seconds", "integer", "Video only."),
                  ("asset_uri", "string", "")]),
    dict(layer="Conformed", name="dim_creative_section", grain="One row per band of an email creative",
         description="Where the clickable regions of an email sit. Held once and read by both the renderer and the click join, so a leader line can never point at the wrong band.",
         columns=[("creative_id", "string", "FK."), ("section_key", "string", "PK with creative_id."),
                  ("label", "string", ""), ("x", "numeric", "Fraction of the creative."),
                  ("y", "numeric", ""), ("w", "numeric", ""), ("h", "numeric", "")]),
    dict(layer="Conformed", name="dim_placement", grain="One row per site, app or mail client",
         columns=[("placement_id", "string", "PK."), ("placement_name", "string", ""),
                  ("channel", "string", "web, ctv, app, inbox.")]),
    dict(layer="Conformed", name="dim_geo_zip", grain="One row per ZCTA",
         description="Boundary geometry plus the area profile. Simplified with Douglas-Peucker at load, not at query time.",
         columns=[("zcta5", "string", "PK."), ("area_name", "string", ""),
                  ("geometry", "geometry", ""), ("median_income_usd", "integer", ""),
                  ("median_age", "numeric", ""), ("degree_share", "numeric", "")]),
    dict(layer="Conformed", name="dim_device", grain="One row per device type",
         columns=[("device_type", "string", "PK."), ("os_family", "string", "iOS, Android, other.")]),

    dict(layer="Marts", name="agg_campaign_daily", grain="date x campaign",
         description="The spine. Every top-line number, every trend line and every prior-period delta is a filter and a sum over this one table.",
         columns=[("event_date", "date", ""), ("campaign_id", "string", ""),
                  ("impressions", "bigint", "Delivered, for email campaigns."),
                  ("clicks", "bigint", ""), ("conversions", "numeric", ""),
                  ("spend_usd", "numeric", ""), ("sends", "bigint", "Email only."),
                  ("opens_reported", "bigint", "Email only."),
                  ("opens_modelled", "bigint", "Email only."),
                  ("unsubscribes", "numeric", "Email only.")]),
    dict(layer="Marts", name="agg_creative_placement", grain="creative x placement",
         description="Stored as shares of the parent creative rather than counts, so a date or campaign filter re-derives it without a second pass over the facts.",
         columns=[("creative_id", "string", ""), ("placement_id", "string", ""),
                  ("impression_share", "numeric", ""), ("click_share", "numeric", ""),
                  ("conversion_share", "numeric", "")]),
    dict(layer="Marts", name="agg_creative_section", grain="creative x section",
         description="Email clicks by band of the creative.",
         columns=[("creative_id", "string", ""), ("section_key", "string", ""),
                  ("click_share", "numeric", "Sums to 1 per creative.")]),
    dict(layer="Marts", name="agg_geo_zip", grain="zcta x campaign",
         description="Shares by ZCTA, plus the ZIP's own device and OS profile. The device profile is fitted so that, weighted by impressions, it adds back up to agg_device_campaign.",
         columns=[("zcta5", "string", ""), ("campaign_id", "string", ""),
                  ("impression_share", "numeric", ""), ("click_share", "numeric", ""),
                  ("conversion_share", "numeric", ""),
                  ("device_share", "map<string,numeric>", ""),
                  ("os_share", "map<string,numeric>", "Of that ZIP's mobile impressions.")]),
    dict(layer="Marts", name="agg_device_campaign", grain="campaign x device",
         columns=[("campaign_id", "string", ""), ("device_type", "string", ""),
                  ("impression_share", "numeric", ""), ("click_share", "numeric", ""),
                  ("conversion_share", "numeric", "")]),
    dict(layer="Marts", name="agg_converter_profile", grain="media type x dimension x bucket",
         description="Who converted, by media type. Profile only -- it never carries a count, so it cannot be mistaken for a measured audience.",
         columns=[("media_type", "string", ""), ("dimension", "string", "income, age, education, device."),
                  ("bucket", "string", ""), ("share", "numeric", "Sums to 1 per dimension.")]),

    dict(layer="Served", name="madhive-v2.json", grain="One document",
         description="Everything except geometry. Fetched once on load; every filter is then applied in the browser.",
         columns=[("meta", "object", "Advertiser, date bounds, defaults."),
                  ("mediaTypes", "array", ""), ("campaigns", "array", ""),
                  ("daily", "array", "agg_campaign_daily."),
                  ("devices", "array", "agg_device_campaign."),
                  ("demographics", "object", "agg_converter_profile."),
                  ("geo", "array", "agg_geo_zip, pivoted by ZIP."),
                  ("creatives", "array", "dim_creative + agg_creative_placement + agg_creative_section."),
                  ("emailFunnel", "object", "Per-campaign rates, for reference.")]),
    dict(layer="Served", name="madhive-v2-shapes.json", grain="One document",
         description="Boundary geometry, split out so the dashboard paints before the map arrives.",
         columns=[("source", "object", "Citation and simplification note."),
                  ("zips", "array", "Simplified ZCTA rings."),
                  ("nation", "array", "National outline for the locator inset.")]),
]

LINEAGE = [
    ("Top Line Metrics", "Seven cards and their drill-downs", ["daily", "campaigns", "mediaTypes"]),
    ("Top Line Metrics", "Impressions / Delivered labelling", ["daily.sends", "campaigns.mediaType"]),
    ("What, When & Who Converts", "Cost per conversion by media", ["daily", "campaigns"]),
    ("What, When & Who Converts", "Who converted", ["demographics"]),
    ("What, When & Who Converts", "Where do impressions stop", ["daily"]),
    ("What, When & Who Converts", "Daily engagement", ["daily"]),
    ("Delivery", "Are your ads delivering", ["daily"]),
    ("Delivery", "Device distribution pies", ["devices", "daily"]),
    ("Delivery", "Geographic map", ["geo", "shapes.zips", "shapes.nation", "daily"]),
    ("Delivery", "ZIP detail: device and OS", ["geo.devices", "geo.os"]),
    ("Delivery", "ZIP table", ["geo", "daily"]),
    ("Creative", "Creative table", ["creatives", "daily", "campaigns"]),
    ("Creative", "Email section breakdown", ["creatives.sections", "daily"]),
    ("Creative", "Email funnel", ["daily.sends", "daily.opensReported", "daily.opensModelled", "daily.unsubs"]),
    ("Creative", "Video completion drop-off", ["creatives.quartiles"]),
    ("Creative", "Site placements", ["creatives.placements", "daily"]),
]

RULES = [
    dict(title="Breakdowns are shares, never counts",
         body="Every breakdown -- geo, device, creative, placement, email section -- is stored as a fraction of its parent and multiplied by whatever the current filter leaves. A breakdown therefore cannot disagree with the total in the card above it, because it is derived from that total rather than computed beside it."),
    dict(title="One definition per number",
         body="Anything shown twice is read from one place. Cost per conversion in a card and cost per conversion in a bar are the same expression over the same table, not two expressions that happen to agree today."),
    dict(title="Email is delivered, not served",
         body="The impressions column carries delivered for email campaigns. The label follows what is in scope: email alone reads Delivered, a mixed selection says so rather than averaging two different events under one word."),
    dict(title="Opens are carried, never divided by",
         body="Apple Mail Privacy Protection fetches the tracking pixel on delivery whether or not anyone opened, so the reported figure is inflated by an unknowable margin and click-to-open inherits it. Both numbers are stored, both are shown, and click rate is taken on delivered."),
    dict(title="Fitted, not assumed, where two things must agree",
         body="The ZIP device profile is reconciled to the campaign-level device split by iterative proportional fitting. Without that step the map and the device pies would be two numbers that must agree and quietly would not."),
    dict(title="Geometry is real",
         body="ZCTA and national outlines come from the US Census 2020 Cartographic Boundary Files, simplified with Douglas-Peucker and rounded to five decimal places. Nothing on the map is drawn by hand."),
]


def main():
    data = json.load(open(os.path.join(DATA, "madhive-v2.json")))
    shapes = json.load(open(os.path.join(DATA, "madhive-v2-shapes.json")))

    collections = []

    def add(name, rows, desc, source):
        collections.append(dict(name=name, rows=len(rows), description=desc, source=source,
                                fields=describe(rows, NOTES.get(name, {}))))

    add("campaigns", data["campaigns"], "The campaigns in the account.", "dim_campaign")
    add("mediaTypes", data["mediaTypes"], "Display, email and online video, with their colours.", "reference")
    add("daily", data["daily"], "The spine. Every total, trend and delta is a filter and a sum over this.", "agg_campaign_daily")
    add("devices", data["devices"], "Device split per campaign, as shares.", "agg_device_campaign")
    add("geo", data["geo"], "One row per ZCTA: campaign shares, area profile, device and OS profile.", "agg_geo_zip")
    add("creatives", data["creatives"], "One row per creative, with its placements and email bands nested.", "dim_creative + aggregates")
    add("creatives[].placements", [p for c in data["creatives"] for p in c["placements"]],
        "Where each creative ran, as shares of that creative.", "agg_creative_placement")
    add("creatives[].sections", [s for c in data["creatives"] if c.get("sections") for s in c["sections"]],
        "Clickable bands of an email creative, as fractions of the creative plus their click share.", "dim_creative_section + agg_creative_section")
    add("demographics.<media>.<dimension>",
        [b for m in data["demographics"].values() for dim in m.values() for b in dim],
        "Who converted, by media type. Profile only, never a count.", "agg_converter_profile")
    add("shapes.zips", shapes["zips"], "Simplified ZCTA boundary rings.", "raw_zcta_boundary")

    files = []
    for path, desc in [("madhive-v2.json", "Everything except geometry."),
                       ("madhive-v2-shapes.json", "Boundary geometry, loaded separately so the page paints first.")]:
        files.append(dict(path=f"/data/{path}", bytes=os.path.getsize(os.path.join(DATA, path)),
                          description=desc))

    out = dict(
        generatedAt="2026-08-20T06:00:00-07:00",
        dashboard="/madhive/v2/",
        advertiser=data["meta"]["advertiser"],
        window=dict(first=data["meta"]["firstDate"], last=data["meta"]["lastDate"]),
        files=files, layers=LAYERS, collections=collections, rules=RULES,
        tables=[dict(layer=t["layer"], name=t["name"], grain=t["grain"],
                     description=t.get("description", ""),
                     columns=[dict(name=c[0], type=c[1], note=c[2]) for c in t["columns"]])
                for t in TABLES],
        lineage=[dict(section=s, widget=w, reads=list(r)) for s, w, r in LINEAGE],
        source=shapes["source"],
    )
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))

    print("Wrote %s  (%.0f KB)" % (os.path.relpath(OUT), os.path.getsize(OUT) / 1024))
    print("  %d tables across %d layers · %d served collections · %d lineage rows"
          % (len(TABLES), len(LAYERS), len(collections), len(LINEAGE)))
    for c in collections:
        print("    %-34s %6s rows  %2d fields" % (c["name"], f"{c['rows']:,}", len(c["fields"])))


if __name__ == "__main__":
    main()
