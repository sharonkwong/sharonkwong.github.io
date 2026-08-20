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
  byMedia: Record<MediaKey, Totals>;
  dates: string[];
  media: { key: MediaKey; label: string; color: string }[];
}

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
    for (const c of campaigns) byCampaign[c.id] = { ...ZERO };
    for (const r of rows) {
      const t = byCampaign[r.campaign];
      t.impressions += r.impressions; t.clicks += r.clicks;
      t.conversions += r.conversions; t.spend += r.spend;
    }

    const byMedia = { display: { ...ZERO }, email: { ...ZERO }, video: { ...ZERO } } as Record<MediaKey, Totals>;
    for (const c of campaigns) {
      const t = byMedia[c.mediaType], s = byCampaign[c.id];
      t.impressions += s.impressions; t.clicks += s.clicks;
      t.conversions += s.conversions; t.spend += s.spend;
    }

    const dates = [...new Set(rows.map((r) => r.date))].sort();
    const media = data.mediaTypes.filter((m) => campaigns.some((c) => c.mediaType === m.key));

    return {
      campaigns, ids, rows, priorRows,
      totals: sumRows(rows), priorTotals: sumRows(priorRows),
      byCampaign, byMedia, dates, media,
    };
  }, [data, f]);
}

export type MediaSeriesRow = { date: string } & Record<MediaKey, number>;

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

export function toCsv(rows: DailyRow[], campaigns: Campaign[]) {
  const name = Object.fromEntries(campaigns.map((c) => [c.id, c.name]));
  const media = Object.fromEntries(campaigns.map((c) => [c.id, c.mediaType]));
  const head = "date,campaign,media_type,impressions,clicks,conversions,spend";
  const body = rows.map((r) =>
    [r.date, `"${name[r.campaign] ?? r.campaign}"`, media[r.campaign],
     r.impressions, r.clicks, r.conversions.toFixed(2), r.spend.toFixed(2)].join(","));
  return [head, ...body].join("\n");
}
