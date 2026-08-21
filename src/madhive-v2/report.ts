/**
 * The narrative both the PDF and the deck render.
 *
 * The workbook exists to be worked on; these two exist to be read in a meeting
 * where someone decides what the next campaign looks like. So this is not the
 * same data reshaped -- it is ordered around the questions that decision turns
 * on: what the money bought, where it worked hardest, who it reached, and which
 * creative and placement carried it.
 *
 * The findings state comparisons and leave the call to the room. A file that
 * says "shift budget to video" has quietly assumed a goal, a risk appetite and
 * a set of constraints it cannot see.
 */
import {
  compact, creativeReach, creativeTotals, deviceTotals, geoAll, money, nf, pct,
  placementTotals, reachOf,
} from "./data";
import type { Filters, View } from "./data";
import type { Data } from "./types";

export interface Bar { label: string; value: number; display: string; color?: string; sub?: string }
export interface Col { label: string; align?: "right" }
export interface ReportTable { cols: Col[]; rows: string[][] }

export interface Block {
  kind: "kpi" | "bars" | "table" | "findings";
  title: string;
  /** One line under the title saying how to read it. */
  lede?: string;
  kpis?: { label: string; value: string; sub?: string }[];
  bars?: Bar[];
  /** Bars are scaled against this rather than their own max, where it matters. */
  barMax?: number;
  table?: ReportTable;
  findings?: string[];
}

export interface Section { title: string; blocks: Block[] }

export interface Report {
  advertiser: string;
  subtitle: string;
  range: string;
  scope: string;
  generated: string;
  sections: Section[];
}

const MEDIA_HEX: Record<string, string> = {
  display: "58A6FF", email: "E3B341", video: "F778BA",
};

export function buildReport(v: View, data: Data, f: Filters): Report {
  const t = v.totals, p = v.priorTotals;
  const reach = reachOf(v, data);
  const pctDelta = (a: number, b: number) => (b > 0 ? `${a >= b ? "+" : ""}${((a / b - 1) * 100).toFixed(1)}% vs prior` : "");

  const media = v.media.map((m) => {
    const x = v.byMedia[m.key];
    const ids = v.campaigns.filter((c) => c.mediaType === m.key);
    const mReach = ids.reduce((s, c) => s + (reach.perCampaign[c.id]?.reach ?? 0), 0);
    return {
      ...m, ...x,
      hex: MEDIA_HEX[m.key] ?? "8B949E",
      cpa: x.conversions > 0 ? x.spend / x.conversions : 0,
      cpm: x.impressions > 0 ? (x.spend / x.impressions) * 1000 : 0,
      ctr: x.impressions > 0 ? x.clicks / x.impressions : 0,
      cvr: x.clicks > 0 ? x.conversions / x.clicks : 0,
      spendShare: t.spend > 0 ? x.spend / t.spend : 0,
      convShare: t.conversions > 0 ? x.conversions / t.conversions : 0,
      reach: mReach,
      freq: mReach > 0 ? x.impressions / mReach : 0,
    };
  }).filter((m) => m.impressions > 0);

  const byCpa = [...media].sort((a, b) => a.cpa - b.cpa);
  const cheapest = byCpa[0], dearest = byCpa[byCpa.length - 1];
  const overIndex = [...media].sort((a, b) => (b.convShare - b.spendShare) - (a.convShare - a.spendShare));

  const creatives = creativeTotals(v, data.creatives)
    .sort((a, b) => b.conversions - a.conversions);

  const placements = creativeTotals(v, data.creatives)
    .flatMap((c) => placementTotals(c, "conversions").map((pl) => ({
      site: pl.site, conversions: pl.value,
      clicks: c.clicks * pl.clickShare, impressions: c.impressions * pl.impressionShare,
    })))
    .reduce((acc, r) => {
      const hit = acc.find((x) => x.site === r.site);
      if (hit) { hit.conversions += r.conversions; hit.clicks += r.clicks; hit.impressions += r.impressions; }
      else acc.push({ ...r });
      return acc;
    }, [] as { site: string; conversions: number; clicks: number; impressions: number }[])
    .sort((a, b) => b.conversions - a.conversions);

  const zips = geoAll(v, data.geo).sort((a, b) => b.conversions - a.conversions);
  const zipTotal = zips.reduce((s, z) => s + z.conversions, 0);

  const devImp = deviceTotals(v, data.devices, "impressions");
  const devConv = deviceTotals(v, data.devices, "conversions");
  const devImpTot = devImp.reduce((s, d) => s + d.value, 0) || 1;
  const devConvTot = devConv.reduce((s, d) => s + d.value, 0) || 1;

  /* ------------------------------------------------------------- findings */
  const findings: string[] = [];
  if (media.length > 1 && cheapest.cpa > 0) {
    findings.push(`${cheapest.label} brings a conversion in for ${money(cheapest.cpa, 2)}; `
      + `${dearest.label} costs ${money(dearest.cpa, 2)} — ${(dearest.cpa / cheapest.cpa).toFixed(1)}x more.`);
  }
  if (media.length > 1) {
    const best = overIndex[0], worst = overIndex[overIndex.length - 1];
    if (best.key !== worst.key) {
      findings.push(`${best.label} takes ${pct(best.spendShare, 0)} of spend and returns `
        + `${pct(best.convShare, 0)} of conversions; ${worst.label} takes ${pct(worst.spendShare, 0)} `
        + `and returns ${pct(worst.convShare, 0)}.`);
    }
  }
  if (p.conversions > 0 && p.spend > 0) {
    const dc = (t.conversions / p.conversions - 1) * 100, ds = (t.spend / p.spend - 1) * 100;
    findings.push(`Against the prior period conversions ${dc >= 0 ? "rose" : "fell"} `
      + `${Math.abs(dc).toFixed(1)}% while spend ${ds >= 0 ? "rose" : "fell"} ${Math.abs(ds).toFixed(1)}%.`);
  }
  if (zips.length >= 5 && zipTotal > 0) {
    const top5 = zips.slice(0, 5).reduce((s, z) => s + z.conversions, 0);
    findings.push(`Five of ${zips.length} ZIPs carry ${pct(top5 / zipTotal, 0)} of conversions, `
      + `led by ${zips[0].zip} ${zips[0].name}.`);
  }
  const topDev = devImp[0];
  if (topDev) {
    const same = devConv.find((d) => d.device === topDev.device);
    findings.push(`${topDev.device} is ${pct(topDev.value / devImpTot, 0)} of impressions and `
      + `${pct((same?.value ?? 0) / devConvTot, 0)} of conversions.`);
  }
  if (creatives.length > 2) {
    const rank = [...creatives].filter((c) => c.clicks > 20)
      .sort((a, b) => (b.conversions / b.clicks) - (a.conversions / a.clicks));
    if (rank.length > 1) {
      findings.push(`Best creative converts ${pct(rank[0].conversions / rank[0].clicks, 1)} of its clicks `
        + `(${rank[0].name}); the weakest converts ${pct(rank[rank.length - 1].conversions / rank[rank.length - 1].clicks, 1)}.`);
    }
  }
  findings.push(`Reach is ${compact(reach.unique)} unique identifiers at `
    + `${(t.impressions / (reach.unique || 1)).toFixed(1)}x average frequency.`);

  /* -------------------------------------------------------------- assembly */
  const sections: Section[] = [
    { title: "Where the money went", blocks: [
      { kind: "kpi", title: "The period at a glance", kpis: [
        { label: "Spend", value: money(t.spend), sub: pctDelta(t.spend, p.spend) },
        { label: "Impressions", value: compact(t.impressions), sub: pctDelta(t.impressions, p.impressions) },
        { label: "Unique reach", value: compact(reach.unique), sub: `${(t.impressions / (reach.unique || 1)).toFixed(1)}x frequency` },
        { label: "Clicks", value: nf(t.clicks), sub: pct(t.impressions ? t.clicks / t.impressions : 0, 2) + " click rate" },
        { label: "Conversions", value: nf(t.conversions), sub: pctDelta(t.conversions, p.conversions) },
        { label: "Cost per conversion", value: money(t.conversions ? t.spend / t.conversions : 0, 2),
          sub: pctDelta(t.conversions ? t.spend / t.conversions : 0, p.conversions ? p.spend / p.conversions : 0) },
      ] },
      { kind: "bars", title: "Share of spend against share of conversions",
        lede: "A media type above its spend share is returning more than it costs.",
        barMax: 1,
        bars: media.flatMap((m) => [
          { label: `${m.label} — spend`, value: m.spendShare, display: pct(m.spendShare, 0), color: m.hex },
          { label: `${m.label} — conversions`, value: m.convShare, display: pct(m.convShare, 0), color: m.hex, sub: "conversions" },
        ]) },
    ] },
    { title: "What each media type cost", blocks: [
      { kind: "bars", title: "Cost per conversion", lede: "Lower is better.",
        bars: byCpa.map((m) => ({ label: m.label, value: m.cpa, display: money(m.cpa, 2), color: m.hex,
                                  sub: `${nf(m.conversions)} conversions` })) },
      { kind: "table", title: "The full picture by media type", table: {
        cols: [{ label: "Media" }, { label: "Spend", align: "right" }, { label: "Impressions", align: "right" },
               { label: "Reach", align: "right" }, { label: "Freq", align: "right" },
               { label: "Clicks", align: "right" }, { label: "Conv", align: "right" },
               { label: "CPM", align: "right" }, { label: "CPA", align: "right" }],
        rows: media.map((m) => [m.label, money(m.spend), compact(m.impressions), compact(m.reach),
                                `${m.freq.toFixed(1)}x`, nf(m.clicks), nf(m.conversions),
                                money(m.cpm, 2), money(m.cpa, 2)]) } },
    ] },
    { title: "How the funnel behaves", blocks: [
      { kind: "bars", title: "Impression to click", lede: "Each bar against the best in this selection.",
        bars: media.map((m) => ({ label: m.label, value: m.ctr, display: pct(m.ctr, 2), color: m.hex })) },
      { kind: "bars", title: "Click to conversion",
        bars: media.map((m) => ({ label: m.label, value: m.cvr, display: pct(m.cvr, 1), color: m.hex })) },
      { kind: "table", title: "Where impressions stop", table: {
        cols: [{ label: "Outcome" }, { label: "Count", align: "right" }, { label: "Of impressions", align: "right" }],
        rows: [
          ["Impression, stopped", nf(t.impressions - t.clicks), pct((t.impressions - t.clicks) / (t.impressions || 1), 1)],
          ["Clicked, then stopped", nf(t.clicks - t.conversions), pct((t.clicks - t.conversions) / (t.impressions || 1), 3)],
          ["Clicked and converted", nf(t.conversions), pct(t.conversions / (t.impressions || 1), 3)],
        ] } },
    ] },
    { title: "Who and where", blocks: [
      { kind: "table", title: "Devices", lede: "Share of each stage, not counts.", table: {
        cols: [{ label: "Device" }, { label: "Impressions", align: "right" }, { label: "Conversions", align: "right" }],
        rows: devImp.map((d) => [d.device, pct(d.value / devImpTot, 1),
                                 pct((devConv.find((x) => x.device === d.device)?.value ?? 0) / devConvTot, 1)]) } },
      { kind: "table", title: "Top ZIP codes by conversions", table: {
        cols: [{ label: "ZIP" }, { label: "Area" }, { label: "Impressions", align: "right" },
               { label: "Conversions", align: "right" }, { label: "Share", align: "right" }],
        rows: zips.slice(0, 8).map((z) => [z.zip, z.name, nf(z.impressions), nf(z.conversions),
                                           pct(z.conversions / (zipTotal || 1), 1)]) } },
    ] },
    { title: "What carried it", blocks: [
      { kind: "table", title: "Creative, ranked by conversions", table: {
        cols: [{ label: "Creative" }, { label: "Format" }, { label: "Impressions", align: "right" },
               { label: "Reach", align: "right" }, { label: "Clicks", align: "right" },
               { label: "Conv", align: "right" }, { label: "CVR", align: "right" }],
        rows: creatives.slice(0, 10).map((c) => {
          const r = creativeReach(v, data, c.campaign, c.impressionShare);
          return [c.name, c.format, compact(c.impressions), c.sections ? "—" : compact(r.reach),
                  nf(c.clicks), nf(c.conversions), pct(c.clicks ? c.conversions / c.clicks : 0, 1)];
        }) } },
      { kind: "table", title: "Placements, ranked by conversions", table: {
        cols: [{ label: "Placement" }, { label: "Impressions", align: "right" },
               { label: "Clicks", align: "right" }, { label: "Conversions", align: "right" }],
        rows: placements.slice(0, 10).map((pl) => [pl.site, compact(pl.impressions), nf(pl.clicks), nf(pl.conversions)]) } },
    ] },
    { title: "What stands out", blocks: [
      { kind: "findings", title: "Read against each other",
        lede: "Statements of what the period did. What to do about it is the room's call.",
        findings },
    ] },
  ];

  const mediaLabel = Object.fromEntries(data.mediaTypes.map((m) => [m.key, m.label]));
  return {
    advertiser: data.meta.advertiser,
    subtitle: "Ad performance review",
    range: `${f.start} to ${f.end}`,
    scope: [
      f.media.length ? f.media.map((m) => mediaLabel[m]).join(", ") : "All media",
      `${v.campaigns.length} of ${data.campaigns.length} campaigns`,
    ].join(" · "),
    generated: data.meta.generatedAt.slice(0, 10),
    sections,
  };
}
