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
        "flightStart": "First day the campaign ran. Independent of the date filter.",
        "flightEnd": "Last day the campaign ran.",
        "frequency": "Impressions per unique identifier over the flight. Reach for any window is impressions divided by this.",
    },
    "mediaTypes": {
        "key": "Primary key.",
        "label": "Display name.",
        "color": "Categorical hue. Validated for CVD separation on the dark surface.",
    },
    "devices": {
        "campaign": "FK to campaigns.id.",
        "device": "Mobile, Desktop, Tablet, or Other where the user agent did not identify one.",
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
        "population": "Area profile. Modelled, not a Census count — the Census API needs a key we do not hold.",
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
        "asset": "Root-absolute, so the dashboard can be served from any depth.",
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
    dict(name="Bronze", short="vendor files, as they land",
         purpose="Exactly what each vendor sent, untouched. Append only, so a restatement upstream can always be replayed rather than reconciled by hand."),
    dict(name="Silver", short="one row per real event",
         purpose="Deduplicated, typed, attributed and resolved to shared keys. The first layer where a join across two sources is safe."),
    dict(name="Gold", short="one row per question",
         purpose="Aggregates cut to the grain a question is asked at. Every metric the dashboard shows is defined exactly once, here."),
    dict(name="Served", short="one document",
         purpose="The JSON the browser fetches. Shaped so a single request answers every panel, with breakdowns held as shares rather than counts."),
]

# What actually happens at each boundary. This is the part a table list cannot
# show: the tables are the nouns, these are the verbs.
TRANSFORMS = [
    dict(frm="Bronze", to="Silver", steps=[
        dict(title="Rebuild, do not append",
             detail="The DSP restates the previous 48 hours, so silver is rebuilt on a trailing window rather than inserted into. Yesterday's bronze partition is not final and is never treated as such.",
             tables="raw_dsp_delivery -> fct_impression"),
        dict(title="Deduplicate on the key the source gives you",
             detail="Pixel events dedupe on their idempotency key, because retries and offline queues deliver the same conversion twice. Impressions dedupe on the vendor id within the restatement window.",
             tables="raw_pixel_event -> fct_conversion"),
        dict(title="Conform three vocabularies into one",
             detail="Each vendor names devices, placements and media types differently. Silver maps all three onto one enum per dimension, so a downstream filter is written once instead of once per source.",
             tables="all bronze -> dim_device, dim_placement"),
        dict(title="Attribute",
             detail="A conversion event becomes a conversion credited to a click here, under last touch inside a 30-day window. The model and the window are stored on the row, so a later change to either is visible rather than silent.",
             tables="raw_pixel_event + fct_click -> fct_conversion"),
        dict(title="Collapse the email event log",
             detail="Send, delivery, bounce, open, click and unsubscribe arrive as separate events. They become one row per recipient per send, with MPP-prefetched opens flagged so the reported and modelled numbers can both be counted without re-walking the log.",
             tables="raw_esp_event -> fct_email_delivery"),
        dict(title="Simplify geometry once, not per query",
             detail="ZCTA polygons are reduced with Douglas-Peucker and rounded to five decimal places on the way in. A map that simplifies at read time pays for it on every request.",
             tables="raw_zcta_boundary -> dim_geo_zip"),
    ]),
    dict(frm="Silver", to="Gold", steps=[
        dict(title="Aggregate to the grain of the question",
             detail="Date by campaign is the spine, because that is the grain every top-line number, trend line and prior-period delta is asked at. Anything finer is a breakdown, not a spine.",
             tables="fct_impression + fct_click + fct_conversion -> agg_campaign_daily"),
        dict(title="Divide by the parent, so filters re-derive",
             detail="Breakdowns are stored as a fraction of their parent rather than as counts. A geo, device, creative or placement figure is then whatever the current filter leaves, multiplied by the share -- so it cannot disagree with the total above it.",
             tables="fct_impression -> agg_geo_zip, agg_device_campaign, agg_creative_placement"),
        dict(title="Fit where two things must agree",
             detail="The ZIP device profile is reconciled to the campaign-level device split by iterative proportional fitting, so the ZIP numbers weighted by impressions add back up to what the device pies show. Without it they would be two numbers that must agree and quietly would not.",
             tables="agg_geo_zip x agg_device_campaign"),
        dict(title="Define each metric once",
             detail="Cost per mille, cost per click and cost per conversion are expressions over this layer, not over the dashboard. Two panels showing the same metric are reading one definition rather than agreeing by coincidence.",
             tables="agg_campaign_daily"),
    ]),
    dict(frm="Gold", to="Served", steps=[
        dict(title="Pivot to the shape the UI reads",
             detail="agg_geo_zip is long -- one row per ZIP per campaign. It ships as one row per ZIP with a shares object keyed by campaign, because the map draws per ZIP and would otherwise regroup on every render.",
             tables="agg_geo_zip -> geo[]"),
        dict(title="Nest children under their parent",
             detail="Placements and email sections are nested inside their creative, so opening a creative needs no second lookup.",
             tables="agg_creative_placement, agg_creative_section -> creatives[]"),
        dict(title="Split geometry into its own file",
             detail="Boundaries are a third of the payload and nothing above the map needs them, so they load separately and the dashboard paints before they arrive.",
             tables="dim_geo_zip -> madhive-v2-shapes.json"),
        dict(title="Ship shares, not counts",
             detail="Only the spine ships as counts. Everything else ships as a fraction, which is both smaller and the reason a filter can never produce a breakdown that contradicts its total.",
             tables="all aggregates -> madhive-v2.json"),
    ]),
]

TABLES = [
    dict(layer="Bronze", name="raw_dsp_delivery", grain="One row per impression or bid response",
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
    dict(layer="Bronze", name="raw_pixel_event", grain="One row per fired pixel",
         description="Streaming, seconds behind. Late and duplicated: retries, offline queues and blockers mean events land hours late or twice.",
         columns=[("event_id", "string", "Idempotency key. The dedupe runs on this."),
                  ("event_ts", "timestamp", ""),
                  ("event_type", "string", "page_view, add_to_cart, purchase."),
                  ("order_value_usd", "numeric", "Advertiser-supplied where present."),
                  ("click_id", "string", "Set when the visit carried a click identifier."),
                  ("user_key", "string", "Hashed. Used for last-touch attribution.")]),
    dict(layer="Bronze", name="raw_esp_event", grain="One row per email event",
         description="From the email service provider. Carries the whole email lifecycle, including the two open numbers.",
         columns=[("event_id", "string", ""),
                  ("event_ts", "timestamp", ""),
                  ("event_type", "string", "send, delivery, bounce, open, click, unsubscribe."),
                  ("campaign_id", "string", ""),
                  ("creative_id", "string", ""),
                  ("section_key", "string", "Set on click events. Which band of the email was clicked."),
                  ("mail_client", "string", "Gmail, Apple Mail, Outlook, Yahoo, Proton."),
                  ("is_mpp_prefetch", "boolean", "Provider's flag that an open came from Apple Mail Privacy Protection.")]),
    dict(layer="Bronze", name="raw_zcta_boundary", grain="One row per ZCTA",
         description="US Census 2020 Cartographic Boundary File. Static reference, refreshed when the Census publishes.",
         columns=[("zcta5", "string", "Five-digit ZCTA."),
                  ("geometry", "geometry", "Polygon or multipolygon, WGS84.")]),

    dict(layer="Silver", name="fct_impression", grain="One row per impression",
         description="Deduplicated on the vendor id within the restatement window, typed, and joined to the dimension keys.",
         columns=[("impression_sk", "bigint", "Surrogate key."),
                  ("event_date", "date", "Local calendar day."),
                  ("campaign_id", "string", "FK dim_campaign."),
                  ("creative_id", "string", "FK dim_creative."),
                  ("placement_id", "string", "FK dim_placement."),
                  ("device_type", "string", "FK dim_device."),
                  ("zcta5", "string", "FK dim_geo_zip."),
                  ("identifier", "string", "Device id or hashed email. Resolves to a person through fct_identity_map, which is what makes reach a distinct count rather than a sum."),
                  ("media_cost_usd", "numeric", "")]),
    dict(layer="Silver", name="fct_click", grain="One row per click",
         description="Display and video clicks from the DSP log, email clicks from the ESP, conformed to one shape so the dashboard never branches on source.",
         columns=[("click_sk", "bigint", ""),
                  ("event_date", "date", ""),
                  ("impression_sk", "bigint", "Null where the click cannot be tied to an impression."),
                  ("campaign_id", "string", ""),
                  ("creative_id", "string", ""),
                  ("placement_id", "string", ""),
                  ("section_key", "string", "Email only. FK dim_creative_section.")]),
    dict(layer="Silver", name="fct_conversion", grain="One row per conversion",
         description="Deduplicated on the pixel's idempotency key, then attributed. Last touch inside a 30-day window.",
         columns=[("conversion_sk", "bigint", ""),
                  ("event_date", "date", ""),
                  ("click_sk", "bigint", "The attributed click, where there was one."),
                  ("campaign_id", "string", ""),
                  ("creative_id", "string", ""),
                  ("placement_id", "string", ""),
                  ("attribution_model", "string", "last_touch."),
                  ("attribution_window_days", "integer", "30.")]),
    dict(layer="Silver", name="fct_email_delivery", grain="One row per recipient per send",
         description="The email funnel collapsed to one row per recipient, so sends, delivery, both open numbers and unsubscribe are countable without re-walking the event log.",
         columns=[("send_sk", "bigint", ""),
                  ("event_date", "date", ""),
                  ("campaign_id", "string", ""),
                  ("creative_id", "string", ""),
                  ("identifier", "string", "Hashed email. Resolves through fct_identity_map to the same person a device id resolves to, which is what stops one person being counted twice for seeing a banner and opening a send."),
                  ("was_delivered", "boolean", "False on bounce or suppression."),
                  ("open_reported", "boolean", "Any open event, MPP included."),
                  ("open_modelled", "boolean", "Opens with the MPP prefetch flag removed."),
                  ("was_unsubscribed", "boolean", "")]),
    dict(layer="Silver", name="fct_identity_map", grain="One row per identifier",
         description="Resolves the identifiers three channels arrive with -- a device id from display and video, a hashed address from email -- onto one person key. The device side is a lookup; the join across to email is a probabilistic match, and the confidence is stored so anything counting people downstream can say so.",
         columns=[("identifier", "string", "Device id or hashed email, as received."),
                  ("identifier_type", "string", "device_id, hashed_email."),
                  ("person_key", "bigint", "The resolved entity."),
                  ("match_confidence", "numeric", "1.0 for a direct device lookup, below 1 for a cross-channel match."),
                  ("first_seen", "date", ""), ("last_seen", "date", "")]),
    dict(layer="Silver", name="dim_campaign", grain="One row per campaign",
         columns=[("campaign_id", "string", "PK."), ("campaign_name", "string", ""),
                  ("media_type", "string", "display, email, video."),
                  ("flight_start", "date", ""), ("flight_end", "date", "")]),
    dict(layer="Silver", name="dim_creative", grain="One row per creative",
         columns=[("creative_id", "string", "PK."), ("campaign_id", "string", "FK."),
                  ("creative_name", "string", ""), ("format", "string", ""),
                  ("width_px", "integer", ""), ("height_px", "integer", ""),
                  ("duration_seconds", "integer", "Video only."),
                  ("asset_uri", "string", "")]),
    dict(layer="Silver", name="dim_creative_section", grain="One row per band of an email creative",
         description="Where the clickable regions of an email sit. Held once and read by both the renderer and the click join, so a leader line can never point at the wrong band.",
         columns=[("creative_id", "string", "FK."), ("section_key", "string", "PK with creative_id."),
                  ("label", "string", ""), ("x", "numeric", "Fraction of the creative."),
                  ("y", "numeric", ""), ("w", "numeric", ""), ("h", "numeric", "")]),
    dict(layer="Silver", name="dim_media_type", grain="One row per media type",
         description="Display, email and online video, with the identifier each dedupes on and the colour the dashboard draws it in.",
         columns=[("media_type", "string", "PK."), ("media_label", "string", ""),
                  ("identifier_type", "string", "Device id, or hashed email."),
                  ("chart_colour", "string", "Validated for CVD separation on the dark surface.")]),
    dict(layer="Silver", name="dim_placement", grain="One row per site, app or mail client",
         columns=[("placement_id", "string", "PK."), ("placement_name", "string", ""),
                  ("channel", "string", "web, ctv, app, inbox.")]),
    dict(layer="Silver", name="dim_geo_zip", grain="One row per ZCTA",
         description="Boundary geometry plus the area profile. Simplified with Douglas-Peucker at load, not at query time.",
         columns=[("zcta5", "string", "PK."), ("area_name", "string", ""),
                  ("geometry", "geometry", ""), ("median_income_usd", "integer", ""),
                  ("median_age", "numeric", ""), ("degree_share", "numeric", "")]),
    dict(layer="Silver", name="dim_device", grain="One row per device type",
         columns=[("device_type", "string", "PK."), ("os_family", "string", "iOS, Android, other.")]),

    dict(layer="Gold", name="agg_campaign_daily", grain="date x campaign",
         description="The spine. Every top-line number, every trend line and every prior-period delta is a filter and a sum over this one table.",
         columns=[("event_date", "date", ""), ("campaign_id", "string", ""),
                  ("impressions", "bigint", "Delivered, for email campaigns."),
                  ("clicks", "bigint", ""), ("conversions", "numeric", ""),
                  ("spend_usd", "numeric", ""), ("sends", "bigint", "Email only."),
                  ("opens_reported", "bigint", "Email only."),
                  ("opens_modelled", "bigint", "Email only."),
                  ("unsubscribes", "numeric", "Email only.")]),
    dict(layer="Gold", name="agg_campaign_reach", grain="One row per campaign",
         description="Reach cannot be summed, so it is not stored as a number. What is stored is frequency -- impressions per unique identifier over the whole flight -- plus how much the campaigns in scope overlap. Reach for a filter is impressions divided by frequency, less the overlap. Frequency is scaled to the window first: a shorter range reaches nearly the same people fewer times each, so f(w) = 1 + (f_flight - 1) x (w / flight)^0.5, which returns the stored figure at the full flight and tends to 1 at a single day. Dividing a month of impressions by a six-month frequency would understate reach badly.",
         columns=[("campaign_id", "string", ""),
                  ("unique_identifiers", "bigint", "Distinct person keys over the flight."),
                  ("frequency", "numeric", "Impressions / unique_identifiers."),
                  ("flight_days", "integer", "Denominator for scaling frequency to a shorter window.")]),
    dict(layer="Gold", name="dim_reach_overlap", grain="One row per count of media types in scope",
         description="How much the selected media share people. A lookup rather than a column on the reach table, because it is a property of the selection and not of any one campaign.",
         columns=[("media_types", "integer", "PK. 1, 2 or 3 in scope."),
                  ("overlap_share", "numeric", "Deducted from the summed per-campaign reach.")]),
    dict(layer="Gold", name="agg_creative_placement", grain="creative x placement",
         description="Stored as shares of the parent creative rather than counts, so a date or campaign filter re-derives it without a second pass over the facts.",
         columns=[("creative_id", "string", ""), ("placement_id", "string", ""),
                  ("impression_share", "numeric", ""), ("click_share", "numeric", ""),
                  ("conversion_share", "numeric", "")]),
    dict(layer="Gold", name="agg_creative_section", grain="creative x section",
         description="Email clicks by band of the creative.",
         columns=[("creative_id", "string", ""), ("section_key", "string", ""),
                  ("click_share", "numeric", "Sums to 1 per creative.")]),
    dict(layer="Gold", name="agg_geo_zip", grain="zcta x campaign",
         description="Shares by ZCTA, plus the ZIP's own device and OS profile. The device profile is fitted so that, weighted by impressions, it adds back up to agg_device_campaign.",
         columns=[("zcta5", "string", ""), ("campaign_id", "string", ""),
                  ("impression_share", "numeric", ""), ("click_share", "numeric", ""),
                  ("conversion_share", "numeric", ""),
                  ("device_share", "map<string,numeric>", ""),
                  ("os_share", "map<string,numeric>", "Of that ZIP's mobile impressions.")]),
    dict(layer="Gold", name="agg_device_campaign", grain="campaign x device",
         columns=[("campaign_id", "string", ""), ("device_type", "string", ""),
                  ("impression_share", "numeric", ""), ("click_share", "numeric", ""),
                  ("conversion_share", "numeric", "")]),
    dict(layer="Gold", name="agg_converter_profile", grain="media type x dimension x bucket",
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

# How the gold tables hang together. The columns are not repeated here -- the
# diagram reads them off TABLES, so it cannot show a column the table card on
# the same page does not.
# Everything the dashboard reads. The aggregates carry the numbers, the
# dimensions carry the labels, and no panel works without both -- the campaign
# filter needs names and flight dates, the map needs ZIP names and boundaries,
# the creative table needs formats and sizes.
GOLD_SPINE = "agg_campaign_daily"
# Campaign identity sits beside the spine because every table on the diagram
# keys to it; drawing all seven of those edges would be noise, so the note says
# it instead.
GOLD_IDENTITY = [
    dict(name="dim_campaign", via="campaign_id",
         note="every share table keys here too"),
    dict(name="dim_media_type", via="media_type",
         note="how agg_converter_profile resolves"),
]
GOLD_ROWS = [
    dict(agg="agg_campaign_reach", via="campaign_id", note="impressions / frequency",
         dims=[dict(name="dim_reach_overlap", via="media_types in scope")]),
    dict(agg="agg_device_campaign", via="campaign_id", note="x impression, click, conversion",
         dims=[dict(name="dim_device", via="device_type")]),
    dict(agg="agg_geo_zip", via="campaign_id", note="x impression, click, conversion",
         dims=[dict(name="dim_geo_zip", via="zcta5")]),
    dict(agg="agg_creative_placement", via="creative_id", note="share of a share",
         dims=[dict(name="dim_creative", via="creative_id"),
               dict(name="dim_placement", via="placement_id")]),
    dict(agg="agg_creative_section", via="creative_id", note="x clicks",
         dims=[dict(name="dim_creative", via="creative_id"),
               dict(name="dim_creative_section", via="creative_id, section_key")]),
    dict(agg="agg_converter_profile", via="media_type", note="profile only, no counts",
         dims=[]),
]

LINEAGE = [
    ("Top Line Metrics", "Seven cards and their drill-downs", ["daily", "campaigns", "mediaTypes"]),
    ("Top Line Metrics", "Impressions / Delivered labelling", ["daily.sends", "campaigns.mediaType"]),
    ("Top Line Metrics", "Unique reach, and its drill-down", ["campaigns.frequency", "reach.overlapByMediaCount", "reach.identifiers", "daily.impressions"]),
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
    ("Creative", "Email funnel", ["daily.sends", "daily.opensReported", "daily.unsubs"]),
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
    dict(title="Reach is derived, never stored as a count",
         body="A stored reach number would sit beside the impression total and drift from it the moment a filter moved. Frequency is stored instead, so reach is impressions divided by frequency and stays tied to the number above it. Frequency itself is scaled to the selected window, because a month of impressions reaches nearly the same people as six months does, just fewer times each. The cross-media discount goes on top, and the card says it is modelled rather than counted -- a device id and a hashed email are matched, not joined."),
    dict(title="Fitted, not assumed, where two things must agree",
         body="The ZIP device profile is reconciled to the campaign-level device split by iterative proportional fitting. Without that step the map and the device pies would be two numbers that must agree and quietly would not."),
    dict(title="Inference keeps its residual",
         body="Device and OS are read off a user agent, and a user agent does not always say. Every device breakdown therefore carries an Other bucket rather than distributing the unknown across the three that are known. It is largest on video, where connected-TV devices frequently do not identify themselves, and on email, where a proxying client reports its own agent instead of the reader's."),
    dict(title="Geometry is real",
         body="ZCTA and national outlines come from the US Census 2020 Cartographic Boundary Files, simplified with Douglas-Peucker and rounded to five decimal places. Nothing on the map is drawn by hand."),
]


def worked_examples(data):
    """Three traces through the layers, each ending on a row that really ships.

    The gold rows are lifted straight out of madhive-v2.json. The bronze and
    silver rows above them are illustrative -- this demo has no event-level
    data -- and the page says so, because presenting invented rows as observed
    ones would undo the point of introspecting the rest of the schema.
    """
    day = "2026-08-18"
    disp = next(r for r in data["daily"] if r["campaign"] == "c-dp-1" and r["date"] == day)
    mail = next(r for r in data["daily"] if r["campaign"] == "c-em-1" and r["date"] == day)
    cr = next(c for c in data["creatives"] if c["id"] == "cr-01")
    top = sorted(cr["placements"], key=lambda p: -p["impressionShare"])[:3]

    return [
        dict(
            title="An impression that became a conversion",
            note="Four rows land, one is a restatement of another. What survives is three impressions, one click and one conversion, which roll into a single row on the spine.",
            steps=[
                dict(layer="Bronze", table="raw_dsp_delivery",
                     cols=["impression_id", "event_ts", "campaign_id", "creative_id", "placement_id", "device_type", "is_click"],
                     rows=[["a91f-0c22", "2026-08-18T18:41:07Z", "c-dp-1", "cr-01", "buzzfeed.com", "PHONE", "false"],
                           ["a91f-0c31", "2026-08-18T18:41:09Z", "c-dp-1", "cr-01", "reddit.com", "Smartphone", "true"],
                           ["a91f-0c44", "2026-08-18T18:42:55Z", "c-dp-1", "cr-03", "pinterest.com", "TABLET", "false"],
                           ["a91f-0c22", "2026-08-18T18:41:07Z", "c-dp-1", "cr-01", "buzzfeed.com", "PHONE", "false"]],
                     flags=[None, None, None, "restated — same impression_id, dropped"]),
                dict(layer="Bronze", table="raw_pixel_event",
                     cols=["event_id", "event_ts", "event_type", "click_id", "user_key"],
                     rows=[["p-7741", "2026-08-18T19:02:44Z", "purchase", "a91f-0c31", "u_8813"],
                           ["p-7741", "2026-08-18T19:02:51Z", "purchase", "a91f-0c31", "u_8813"]],
                     flags=[None, "retry — same event_id, dropped"]),
                dict(layer="Silver", table="fct_impression",
                     cols=["impression_sk", "event_date", "campaign_id", "creative_id", "placement_id", "device_type"],
                     rows=[["1000441827", "2026-08-18", "c-dp-1", "cr-01", "buzzfeed.com", "Mobile"],
                           ["1000441828", "2026-08-18", "c-dp-1", "cr-01", "reddit.com", "Mobile"],
                           ["1000441829", "2026-08-18", "c-dp-1", "cr-03", "pinterest.com", "Tablet"]],
                     flags=[None, None, None],
                     note="Deduped, dated in local time, and PHONE / Smartphone / TABLET conformed onto one device enum."),
                dict(layer="Silver", table="fct_conversion",
                     cols=["conversion_sk", "event_date", "click_sk", "campaign_id", "attribution_model", "window_days"],
                     rows=[["90002214", "2026-08-18", "5500318", "c-dp-1", "last_touch", "30"]],
                     flags=[None],
                     note="One row, not two. The model and window ride on the row so a later change to either is visible."),
                dict(layer="Gold", table="agg_campaign_daily",
                     cols=["event_date", "campaign_id", "impressions", "clicks", "conversions", "spend_usd"],
                     rows=[[day, "c-dp-1", f"{disp['impressions']:,}", f"{disp['clicks']:,}",
                            f"{disp['conversions']:,}", f"{disp['spend']:,.2f}"]],
                     flags=[None],
                     note="The three rows above are part of this total, alongside the rest of that day. This row ships verbatim as daily[].",
                     real=True),
            ]),
        dict(
            title="Six email events, one recipient",
            note="The ESP emits a row per lifecycle event. Silver collapses them to one row per recipient per send, which is what makes sends, both open numbers and unsubscribes countable without walking the log again.",
            steps=[
                dict(layer="Bronze", table="raw_esp_event",
                     cols=["event_id", "event_ts", "event_type", "campaign_id", "creative_id", "section_key", "is_mpp_prefetch"],
                     rows=[["e-4410", "2026-08-18T14:00:02Z", "send", "c-em-1", "cr-06", "", ""],
                           ["e-4411", "2026-08-18T14:00:09Z", "delivery", "c-em-1", "cr-06", "", ""],
                           ["e-4412", "2026-08-18T14:00:11Z", "open", "c-em-1", "cr-06", "", "true"],
                           ["e-4418", "2026-08-18T18:22:40Z", "open", "c-em-1", "cr-06", "", "false"],
                           ["e-4419", "2026-08-18T18:23:04Z", "click", "c-em-1", "cr-06", "hero", "false"],
                           ["e-4462", "2026-08-18T18:25:31Z", "unsubscribe", "c-em-1", "cr-06", "footer", ""]],
                     flags=[None, None, "fired 9s after delivery — Apple MPP prefetch", None, None, None]),
                dict(layer="Silver", table="fct_email_delivery",
                     cols=["send_sk", "event_date", "campaign_id", "creative_id", "was_delivered", "open_reported", "open_modelled", "was_unsubscribed"],
                     rows=[["7700912", "2026-08-18", "c-em-1", "cr-06", "true", "true", "true", "true"]],
                     flags=[None],
                     note="Both open columns survive. Reported counts the prefetch; modelled does not. Neither is ever a denominator."),
                dict(layer="Gold", table="agg_campaign_daily",
                     cols=["event_date", "campaign_id", "sends", "impressions", "opens_reported", "opens_modelled", "clicks", "unsubscribes"],
                     rows=[[day, "c-em-1", f"{mail['sends']:,}", f"{mail['impressions']:,}",
                            f"{mail['opensReported']:,}", f"{mail['opensModelled']:,}",
                            f"{mail['clicks']:,}", f"{mail['unsubs']:,}"]],
                     flags=[None],
                     note=f"impressions carries DELIVERED here: {mail['impressions']:,} of {mail['sends']:,} sends. The gap between the two open columns is {mail['opensReported'] - mail['opensModelled']:,} prefetches.",
                     real=True),
            ]),
        dict(
            title="Counts become shares",
            note="A breakdown is divided by its parent on the way into gold, so any filter re-derives it by multiplying back. This is why a placement figure can never disagree with the creative total above it.",
            steps=[
                dict(layer="Silver", table="fct_impression (grouped)",
                     cols=["creative_id", "placement_id", "impressions"],
                     rows=[["cr-01", "buzzfeed.com", "434,712"],
                           ["cr-01", "reddit.com", "424,714"],
                           ["cr-01", "pinterest.com", "386,853"],
                           ["cr-01", "…9 more placements", "2,326,912"]],
                     flags=[None, None, None, None]),
                dict(layer="Gold", table="agg_creative_placement",
                     cols=["creative_id", "placement_id", "impression_share"],
                     rows=[["cr-01", "buzzfeed.com", f"{top[0]['impressionShare']}"],
                           ["cr-01", "reddit.com", f"{top[1]['impressionShare']}"],
                           ["cr-01", "pinterest.com", f"{top[2]['impressionShare']}"],
                           ["cr-01", "…9 more placements", f"{round(1 - sum(p['impressionShare'] for p in top), 4)}"]],
                     flags=[None, None, None, None],
                     note="Sums to 1. No count is stored, so the same rows serve every date range and every campaign filter.",
                     real=True),
            ]),
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
        transforms=TRANSFORMS,
        goldErd=dict(spine=GOLD_SPINE, identity=GOLD_IDENTITY, rows=GOLD_ROWS),
        worked=worked_examples(data),
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
