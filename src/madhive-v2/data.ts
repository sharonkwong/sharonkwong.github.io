import { useEffect, useMemo, useState } from "react";
import type {
  Campaign, Creative, Data, DailyRow, GeoZip, MediaKey, Metric, ShareMetric,
} from "./types";

const URL = "../../data/madhive-v2.json";
const SHAPES_URL = "../../data/madhive-v2-shapes.json";

export function useData() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(URL)
      .then((r) => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); })
      .then((d: Data) => live && setData(d))
      .catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, []);
  return { data, error };
}

export interface Shapes {
  source: { zcta: string; nation: string; url: string; note: string };
  zips: { zip: string; rings: number[][][] }[];
  nation: number[][][];
}

/** Boundaries load on their own so the dashboard paints before the geometry. */
export function useShapes() {
  const [shapes, setShapes] = useState<Shapes | null>(null);
  useEffect(() => {
    let live = true;
    fetch(SHAPES_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Shapes | null) => live && setShapes(s))
      .catch(() => undefined);
    return () => { live = false; };
  }, []);
  return shapes;
}

/* ------------------------------------------------------------------ filters */

export interface Filters {
  media: MediaKey[];          // empty = all
  campaigns: string[];        // empty = all
  start: string;
  end: string;
}

const MEDIA_KEYS: MediaKey[] = ["display", "email", "video"];
const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

function fromUrl(data: Data): Filters {
  const q = new URLSearchParams(window.location.search);
  const csv = (k: string) => (q.get(k) ?? "").split(",").filter(Boolean);
  const start = q.get("start"), end = q.get("end");
  return {
    media: csv("media").filter((m): m is MediaKey => MEDIA_KEYS.includes(m as MediaKey)),
    campaigns: csv("campaigns").filter((c) => data.campaigns.some((x) => x.id === c)),
    start: isDate(start) ? start : data.meta.defaultStart,
    end: isDate(end) ? end : data.meta.defaultEnd,
  };
}

function toUrl(f: Filters, data: Data) {
  const q = new URLSearchParams();
  if (f.media.length) q.set("media", f.media.join(","));
  if (f.campaigns.length) q.set("campaigns", f.campaigns.join(","));
  if (f.start !== data.meta.defaultStart) q.set("start", f.start);
  if (f.end !== data.meta.defaultEnd) q.set("end", f.end);
  const s = q.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
}

/** Filters live in the query string, so any view of this page is a link. */
export function useFilters(data: Data | null) {
  const [f, setF] = useState<Filters | null>(null);
  useEffect(() => {
    if (data && !f) setF(fromUrl(data));
  }, [data, f]);
  const set = (patch: Partial<Filters>) =>
    setF((p) => {
      if (!p || !data) return p;
      const next = { ...p, ...patch };
      toUrl(next, data);
      return next;
    });
  return [f, set] as const;
}

/** Campaigns surviving the media-type and campaign filters. */
export function activeCampaigns(data: Data, f: Filters): Campaign[] {
  return data.campaigns.filter(
    (c) => (!f.media.length || f.media.includes(c.mediaType)) &&
           (!f.campaigns.length || f.campaigns.includes(c.id))
  );
}

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (a: string, b: string) =>
  Math.round((+new Date(`${b}T00:00:00`) - +new Date(`${a}T00:00:00`)) / 86_400_000) + 1;

/** The window immediately before the selected one, of equal length. */
export function priorRange(f: Filters) {
  const n = daysBetween(f.start, f.end);
  return { start: shift(f.start, -n), end: shift(f.start, -1) };
}

export const ZERO = { impressions: 0, clicks: 0, conversions: 0, spend: 0 };
export type Totals = typeof ZERO;

export function sumRows(rows: DailyRow[]): Totals {
  return rows.reduce((a, r) => ({
    impressions: a.impressions + r.impressions,
    clicks: a.clicks + r.clicks,
    conversions: a.conversions + r.conversions,
    spend: a.spend + r.spend,
  }), { ...ZERO });
}

/* --------------------------------------------------------------- selectors */

export interface View {
  campaigns: Campaign[];
  ids: Set<string>;
  rows: DailyRow[];                       // selected window
  priorRows: DailyRow[];
  totals: Totals;
  priorTotals: Totals;
  /** Filtered totals per campaign — every breakdown scales off these. */
  byCampaign: Record<string, Totals>;
  /** Days of each campaign inside the window. Reach needs this, sums do not. */
  daysByCampaign: Record<string, number>;
  byMedia: Record<MediaKey, Totals>;
  dates: string[];
  media: { key: MediaKey; label: string; color: string }[];
  /** Email's own funnel. Opens are carried but never used as a denominator. */
  email: {
    present: boolean;
    only: boolean;
    totals: EmailFunnel;
    byCampaign: Record<string, EmailFunnel>;
  };
}

export interface EmailFunnel {
  sends: number; delivered: number;
  opensReported: number; opensModelled: number;
  clicks: number; conversions: number; unsubs: number;
}
const EMPTY_FUNNEL = (): EmailFunnel => ({
  sends: 0, delivered: 0, opensReported: 0, opensModelled: 0,
  clicks: 0, conversions: 0, unsubs: 0,
});

export function useView(data: Data | null, f: Filters | null): View | null {
  return useMemo(() => {
    if (!data || !f) return null;
    const campaigns = activeCampaigns(data, f);
    const ids = new Set(campaigns.map((c) => c.id));
    const p = priorRange(f);
    const inWin = (d: string, a: string, b: string) => d >= a && d <= b;

    const rows: DailyRow[] = [];
    const priorRows: DailyRow[] = [];
    for (const r of data.daily) {
      if (!ids.has(r.campaign)) continue;
      if (inWin(r.date, f.start, f.end)) rows.push(r);
      else if (inWin(r.date, p.start, p.end)) priorRows.push(r);
    }

    const byCampaign: Record<string, Totals> = {};
    const seen: Record<string, Set<string>> = {};
    for (const c of campaigns) { byCampaign[c.id] = { ...ZERO }; seen[c.id] = new Set(); }
    for (const r of rows) {
      const t = byCampaign[r.campaign];
      t.impressions += r.impressions; t.clicks += r.clicks;
      t.conversions += r.conversions; t.spend += r.spend;
      seen[r.campaign].add(r.date);
    }
    const daysByCampaign = Object.fromEntries(
      Object.entries(seen).map(([k, s]) => [k, s.size]));

    const byMedia = { display: { ...ZERO }, email: { ...ZERO }, video: { ...ZERO } } as Record<MediaKey, Totals>;
    for (const c of campaigns) {
      const t = byMedia[c.mediaType], s = byCampaign[c.id];
      t.impressions += s.impressions; t.clicks += s.clicks;
      t.conversions += s.conversions; t.spend += s.spend;
    }

    const dates = [...new Set(rows.map((r) => r.date))].sort();
    const media = data.mediaTypes.filter((m) => campaigns.some((c) => c.mediaType === m.key));

    const emailIds = new Set(campaigns.filter((c) => c.mediaType === "email").map((c) => c.id));
    const emailByCampaign: Record<string, EmailFunnel> = {};
    const emailTotals = EMPTY_FUNNEL();
    for (const r of rows) {
      if (!emailIds.has(r.campaign)) continue;
      const f = (emailByCampaign[r.campaign] ??= EMPTY_FUNNEL());
      for (const t of [f, emailTotals]) {
        t.sends += r.sends ?? 0;
        t.delivered += r.impressions;
        t.opensReported += r.opensReported ?? 0;
        t.opensModelled += r.opensModelled ?? 0;
        t.clicks += r.clicks;
        t.conversions += r.conversions;
        t.unsubs += r.unsubs ?? 0;
      }
    }

    return {
      campaigns, ids, rows, priorRows,
      totals: sumRows(rows), priorTotals: sumRows(priorRows),
      byCampaign, daysByCampaign, byMedia, dates, media,
      email: {
        present: emailIds.size > 0,
        only: emailIds.size > 0 && emailIds.size === campaigns.length,
        totals: emailTotals,
        byCampaign: emailByCampaign,
      },
    };
  }, [data, f]);
}

export type MediaSeriesRow = { date: string } & Record<MediaKey, number>;

/**
 * Unique identifiers reached, for whatever is filtered.
 *
 * Reach cannot be summed, so it is derived rather than stored: filtered
 * impressions divided by frequency, then discounted for the people two
 * campaigns share.
 *
 * Frequency is the part that has to move with the date filter. The stored
 * figure is the whole flight's, and a shorter window reaches nearly the same
 * people fewer times each -- so dividing a month of impressions by a six-month
 * frequency would understate reach badly. Frequency is therefore scaled by how
 * much of the flight is in view, sub-linearly, because repeat exposure
 * accumulates fastest early and then flattens:
 *
 *     f(w) = 1 + (f_flight - 1) * (w / flight) ^ 0.5
 *
 * At the full flight it returns the stored frequency; at a single day it tends
 * to 1, where every impression is a different person.
 */
const FREQ_EXPONENT = 0.5;

export function reachOf(v: View, data: Data) {
  const byId = Object.fromEntries(data.campaigns.map((c) => [c.id, c]));
  let raw = 0;
  const perCampaign: Record<string, { reach: number; freq: number; days: number }> = {};
  for (const c of v.campaigns) {
    const meta = byId[c.id];
    const imps = v.byCampaign[c.id]?.impressions ?? 0;
    const flight = daysBetween(meta.flightStart, meta.flightEnd);
    const win = Math.min(v.daysByCampaign[c.id] ?? 0, flight);
    if (imps <= 0 || win <= 0) { perCampaign[c.id] = { reach: 0, freq: 0, days: 0 }; continue; }
    const freq = Math.max(1, 1 + (meta.frequency - 1) * (win / flight) ** FREQ_EXPONENT);
    const reach = imps / freq;
    perCampaign[c.id] = { reach, freq, days: win };
    raw += reach;
  }
  const overlap = data.reach.overlapByMediaCount[String(v.media.length)] ?? 0;
  return { unique: raw * (1 - overlap), raw, overlap, perCampaign };
}

/**
 * Reach and frequency for one creative, inside the current window.
 *
 * A creative is shown to a subset of the people its campaign reached, so its
 * frequency is lower than the campaign's -- fewer impressions spread over
 * nearly the same pool. The same sub-linear shape applies, on the creative's
 * share of impressions rather than on elapsed days:
 *
 *     f_creative = 1 + (f_campaign_window - 1) * share ^ 0.5
 *
 * A creative with 42% of the impressions therefore reaches around 63% of the
 * people, which is the right side of both bounds: more than its share, less
 * than all of them. Creative reaches deliberately do not sum -- the same person
 * sees more than one -- so they are never totalled.
 */
export function creativeReach(v: View, data: Data, campaignId: string, impressionShare: number) {
  const camp = reachOf(v, data).perCampaign[campaignId];
  const imps = (v.byCampaign[campaignId]?.impressions ?? 0) * impressionShare;
  if (!camp || camp.freq <= 0 || imps <= 0) return { reach: 0, frequency: 0 };
  const freq = Math.max(1, 1 + (camp.freq - 1) * impressionShare ** FREQ_EXPONENT);
  return { reach: imps / freq, frequency: freq };
}

/** Daily series, one key per media type, for the selected window. */
export function seriesByMedia(v: View, data: Data, metric: Metric): MediaSeriesRow[] {
  const media = Object.fromEntries(data.campaigns.map((c) => [c.id, c.mediaType]));
  const acc = new Map<string, Record<MediaKey, number>>();
  for (const d of v.dates) acc.set(d, { display: 0, email: 0, video: 0 });
  for (const r of v.rows) acc.get(r.date)![media[r.campaign] as MediaKey] += r[metric];
  return v.dates.map((d) => ({ date: d, ...acc.get(d)! }));
}

/* Breakdowns: a share of a campaign's filtered total, so a breakdown always
   adds back up to the number in the card above it. */
const FIELD: Record<ShareMetric, "impressionShare" | "clickShare" | "conversionShare"> = {
  impressions: "impressionShare", clicks: "clickShare", conversions: "conversionShare",
};

export function geoTotals(v: View, geo: GeoZip[], metric: ShareMetric) {
  const f = FIELD[metric];
  return geo.map((g) => ({
    ...g,
    value: v.campaigns.reduce(
      (s, c) => s + (v.byCampaign[c.id]?.[metric] ?? 0) * (g.shares[c.id]?.[f] ?? 0), 0),
  }));
}

/** Every metric for every ZIP at once — what the ZIP table lists. */
export function geoAll(v: View, geo: GeoZip[]) {
  return geo.map((g) => {
    const t = (m: ShareMetric, f: "impressionShare" | "clickShare" | "conversionShare") =>
      v.campaigns.reduce((s, c) => s + (v.byCampaign[c.id]?.[m] ?? 0) * (g.shares[c.id]?.[f] ?? 0), 0);
    const impressions = t("impressions", "impressionShare");
    const clicks = t("clicks", "clickShare");
    const conversions = t("conversions", "conversionShare");
    return {
      zip: g.zip, name: g.name, impressions, clicks, conversions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      cvr: clicks > 0 ? conversions / clicks : 0,
      medianIncome: g.medianIncome, medianAge: g.medianAge, degreeShare: g.degreeShare,
    };
  });
}

export function deviceTotals(v: View, devices: Data["devices"], metric: ShareMetric) {
  const f = FIELD[metric];
  const out = new Map<string, number>();
  for (const d of devices) {
    if (!v.ids.has(d.campaign)) continue;
    out.set(d.device, (out.get(d.device) ?? 0) + (v.byCampaign[d.campaign]?.[metric] ?? 0) * d[f]);
  }
  return [...out].map(([device, value]) => ({ device, value })).sort((a, b) => b.value - a.value);
}

export function creativeTotals(v: View, creatives: Creative[]) {
  return creatives
    .filter((c) => v.ids.has(c.campaign))
    .map((c) => {
      const t = v.byCampaign[c.campaign];
      return {
        ...c,
        impressions: t.impressions * c.impressionShare,
        clicks: t.clicks * c.clickShare,
        conversions: t.conversions * c.conversionShare,
      };
    });
}

export function placementTotals(c: ReturnType<typeof creativeTotals>[number], metric: ShareMetric) {
  const f = FIELD[metric];
  return c.placements
    .map((p) => ({ ...p, value: c[metric] * p[f] }))
    .sort((a, b) => b.value - a.value);
}

/** Roll a daily series up to week starts. 90 daily points is a picket fence. */
export type Grain = "day" | "week" | "month";

const daysInMonth = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

export function rollup(rows: MediaSeriesRow[], grain: Grain): MediaSeriesRow[] {
  if (grain === "day") return rows;
  const keys: MediaKey[] = ["display", "email", "video"];
  const out = new Map<string, MediaSeriesRow>();
  const days = new Map<string, number>();
  for (const r of rows) {
    const d = new Date(`${r.date}T00:00:00`);
    if (grain === "week") d.setDate(d.getDate() - d.getDay());   // week starts Sunday
    else d.setDate(1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.set(k, (days.get(k) ?? 0) + 1);
    const acc = out.get(k);
    if (!acc) out.set(k, { ...r, date: k });
    else for (const m of keys) acc[m] += r[m];
  }
  // A part-bucket at either edge plots as a cliff that never happened. Drop
  // them, but never so far that nothing is left to draw.
  const full = (k: string) => (days.get(k) ?? 0) >= (grain === "week" ? 7 : daysInMonth(k));
  let out2 = [...out.values()];
  while (out2.length > 2 && !full(out2[0].date)) out2 = out2.slice(1);
  while (out2.length > 2 && !full(out2[out2.length - 1].date)) out2 = out2.slice(0, -1);
  return out2;
}

/** Long windows are unreadable at daily grain, so they open coarser. */
export const defaultGrain = (days: number): Grain =>
  days > 120 ? "month" : days > 45 ? "week" : "day";

export const GRAIN_OPTIONS = [
  { value: "day" as Grain, label: "Day" },
  { value: "week" as Grain, label: "Week" },
  { value: "month" as Grain, label: "Month" },
];

/* ---------------------------------------------------------------- formatting */

export const nf = (n: number) => Math.round(n).toLocaleString("en-US");
export const money = (n: number, dp = 0) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
export const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`
  : `${Math.round(n)}`;
export const pct = (n: number, dp = 1) => `${(n * 100).toFixed(dp)}%`;
export const delta = (cur: number, prv: number) => (prv > 0 ? (cur / prv - 1) * 100 : NaN);
export const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * One file, several tables.
 *
 * CSV has no notion of a sheet, so each dimension is written as its own block
 * with a `## table:` marker, its own header row and a blank line after it.
 * Excel and Sheets both import that cleanly, and the markers make it trivial to
 * split into real sheets on the other side. Everything respects the filters
 * that were on screen, and the daily block is the full grain the dashboard
 * itself reads -- nothing is pre-aggregated away.
 */
export interface ExportTable { name: string; cols: string[]; rows: (string | number)[][] }

export function exportTables(v: View, data: Data, f: Filters): ExportTable[] {
  const out: ExportTable[] = [];
  const block = (name: string, cols: string[], rows: (string | number)[][]) =>
    out.push({ name, cols, rows });

  const camp = Object.fromEntries(data.campaigns.map((c) => [c.id, c]));
  const mediaLabel = Object.fromEntries(data.mediaTypes.map((m) => [m.key, m.label]));
  const nameOf = (id: string) => camp[id]?.name ?? id;
  const mediaOf = (id: string) => mediaLabel[camp[id]?.mediaType] ?? "";
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const r4 = (n: number) => Math.round(n * 10000) / 10000;

  block("about", ["field", "value"], [
    ["advertiser", data.meta.advertiser],
    ["exported for", `${f.start} to ${f.end}`],
    ["media types", f.media.length ? f.media.map((m) => mediaLabel[m]).join(" | ") : "all"],
    ["campaigns", `${v.campaigns.length} of ${data.campaigns.length}`],
    ["note", "every sheet is filtered to the selection above"],
    ["daily grain", "daily_by_campaign is the full grain the dashboard reads"],
  ]);

  block("daily_by_campaign",
    ["date", "campaign_id", "campaign", "media_type", "impressions", "clicks", "conversions",
     "spend", "sends", "opens_reported", "opens_modelled", "unsubscribes"],
    [...v.rows].sort((a, b) => a.date.localeCompare(b.date) || a.campaign.localeCompare(b.campaign))
      .map((r) => [r.date, r.campaign, nameOf(r.campaign), mediaOf(r.campaign),
                   r.impressions, r.clicks, r2(r.conversions), r2(r.spend),
                   r.sends ?? "", r.opensReported ?? "", r.opensModelled ?? "", r.unsubs ?? ""]));

  const reach = reachOf(v, data);
  block("campaign_summary",
    ["campaign_id", "campaign", "media_type", "flight_start", "flight_end", "days_in_range",
     "impressions", "clicks", "conversions", "spend", "unique_reach", "frequency",
     "cpm", "cpc", "cpa"],
    v.campaigns.map((c) => {
      const t = v.byCampaign[c.id], rc = reach.perCampaign[c.id];
      return [c.id, c.name, mediaLabel[c.mediaType], c.flightStart, c.flightEnd,
              v.daysByCampaign[c.id] ?? 0, t.impressions, t.clicks, r2(t.conversions), r2(t.spend),
              Math.round(rc?.reach ?? 0), r2(rc?.freq ?? 0),
              r2(t.impressions ? (t.spend / t.impressions) * 1000 : 0),
              r2(t.clicks ? t.spend / t.clicks : 0),
              r2(t.conversions ? t.spend / t.conversions : 0)];
    }));

  block("media_type_summary",
    ["media_type", "impressions", "clicks", "conversions", "spend", "cpm", "cpc", "cpa"],
    v.media.map((m) => {
      const t = v.byMedia[m.key];
      return [m.label, t.impressions, t.clicks, r2(t.conversions), r2(t.spend),
              r2(t.impressions ? (t.spend / t.impressions) * 1000 : 0),
              r2(t.clicks ? t.spend / t.clicks : 0),
              r2(t.conversions ? t.spend / t.conversions : 0)];
    }));

  block("geo_by_zip",
    ["zip", "area", "impressions", "clicks", "conversions", "ctr", "cvr", "population",
     "median_income", "median_age", "degree_share", "share_mobile", "share_desktop",
     "share_tablet", "share_ios", "share_android"],
    geoAll(v, data.geo).sort((a, b) => b.impressions - a.impressions).map((g) => {
      const src = data.geo.find((x) => x.zip === g.zip)!;
      return [g.zip, g.name, Math.round(g.impressions), Math.round(g.clicks),
              r2(g.conversions), r4(g.ctr), r4(g.cvr), src.population,
              g.medianIncome, g.medianAge, r4(g.degreeShare),
              r4(src.devices.Mobile ?? 0), r4(src.devices.Desktop ?? 0), r4(src.devices.Tablet ?? 0),
              r4(src.os.iOS ?? 0), r4(src.os.Android ?? 0)];
    }));

  block("device_by_campaign",
    ["campaign_id", "campaign", "device", "impressions", "clicks", "conversions"],
    data.devices.filter((d) => v.ids.has(d.campaign)).map((d) => {
      const t = v.byCampaign[d.campaign];
      return [d.campaign, nameOf(d.campaign), d.device,
              Math.round(t.impressions * d.impressionShare),
              Math.round(t.clicks * d.clickShare),
              r2(t.conversions * d.conversionShare)];
    }));

  const creatives = creativeTotals(v, data.creatives);
  block("creative",
    ["creative_id", "creative", "campaign", "media_type", "format", "dimensions", "seconds",
     "impressions", "clicks", "conversions", "ctr", "cvr", "unique_reach", "frequency"],
    creatives.map((c) => {
      const cr = creativeReach(v, data, c.campaign, c.impressionShare);
      const isEmail = !!c.sections;
      return [c.id, c.name, nameOf(c.campaign), mediaOf(c.campaign), c.format, c.dimensions,
              c.seconds ?? "", Math.round(c.impressions), Math.round(c.clicks), r2(c.conversions),
              r4(c.impressions ? c.clicks / c.impressions : 0),
              r4(c.clicks ? c.conversions / c.clicks : 0),
              isEmail ? "" : Math.round(cr.reach), isEmail ? "" : r2(cr.frequency)];
    }));

  block("creative_placement",
    ["creative_id", "creative", "campaign", "placement", "impressions", "clicks", "conversions"],
    creatives.flatMap((c) => c.placements.map((pl) => [
      c.id, c.name, nameOf(c.campaign), pl.site,
      Math.round(c.impressions * pl.impressionShare),
      Math.round(c.clicks * pl.clickShare),
      r2(c.conversions * pl.conversionShare)])));

  block("creative_section_email",
    ["creative_id", "creative", "section", "clicks", "click_share"],
    creatives.filter((c) => c.sections).flatMap((c) => c.sections!.map((s) => [
      c.id, c.name, s.label, Math.round(c.clicks * s.clickShare), r4(s.clickShare)])));

  block("video_completion",
    ["creative_id", "creative", "start", "q25", "q50", "q75", "q100"],
    creatives.filter((c) => c.quartiles).map((c) => [c.id, c.name, ...c.quartiles!]));

  block("converter_profile",
    ["media_type", "dimension", "bucket", "share"],
    v.media.flatMap((m) => (["income", "age", "education", "device"] as const).flatMap((dim) =>
      data.demographics[m.key][dim].map((b) => [m.label, dim, b.label, r4(b.share)]))));

  const e = v.email.totals;
  if (v.email.present) {
    block("email_funnel",
      ["stage", "count", "rate_of_previous"],
      [["sends", Math.round(e.sends), ""],
       ["delivered", Math.round(e.delivered), r4(e.sends ? e.delivered / e.sends : 0)],
       ["opens_reported", Math.round(e.opensReported), r4(e.delivered ? e.opensReported / e.delivered : 0)],
       ["opens_modelled", Math.round(e.opensModelled), r4(e.delivered ? e.opensModelled / e.delivered : 0)],
       ["clicks", Math.round(e.clicks), r4(e.delivered ? e.clicks / e.delivered : 0)],
       ["conversions", r2(e.conversions), r4(e.clicks ? e.conversions / e.clicks : 0)],
       ["unsubscribes", r2(e.unsubs), r4(e.delivered ? e.unsubs / e.delivered : 0)]]);
  }

  return out;
}

/** One file, one table per block. Excel and Sheets both import this cleanly. */
export function toCsv(v: View, data: Data, f: Filters) {
  const q = (s: unknown) => {
    const t = String(s ?? "");
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return exportTables(v, data, f).flatMap((t) => [
    `## table: ${t.name}`, t.cols.join(","), ...t.rows.map((r) => r.map(q).join(",")), "",
  ]).join("\n");
}
