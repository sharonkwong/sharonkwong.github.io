import type React from "react";
import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { compact, delta, money, nf, pct, reachOf, seriesByMedia, shortDate } from "./data";
import type { View } from "./data";
import type { Data, MediaKey, Metric } from "./types";
import { Delta, InfoTip, Label, MONO, Panel, T, Tip } from "./ui";

type CardId = "impressions" | "clicks" | "conversions" | "reach" | "spend" | "cpm" | "cpc" | "cpa";

const VOLUME: Record<string, Metric> = {
  impressions: "impressions", clicks: "clicks", conversions: "conversions", spend: "spend",
};

function Card({ label, value, second, delta: d, lowerIsBetter, tip, open, onClick }: {
  label: string; value: string; second?: string; delta: number;
  lowerIsBetter?: boolean; tip?: string; open: boolean; onClick: () => void;
}) {
  return (
    // The click target is an absolutely positioned button underneath the
    // content, so the info tip can be a sibling beside the label rather than a
    // button nested inside another button.
    <Box position="relative" minW={0} bg={open ? T.raised : T.surface}
      border="1px solid" borderColor={open ? T.focus : T.line} borderRadius="8px"
      px={3.5} py={3} _hover={{ borderColor: open ? T.focus : T.dim }}
      transition="border-color .12s, background .12s">
      <Box as="button" type="button" onClick={onClick} aria-expanded={open} aria-label={label}
        position="absolute" inset={0} borderRadius="8px" zIndex={0}
        _focusVisible={{ outline: "2px solid", outlineColor: T.focus, outlineOffset: "1px" }} />
      <Box position="relative" zIndex={1} pointerEvents="none">
        <Flex align="center" gap="6px" mb={2} minH="15px">
          <Label as="div" noOfLines={1}>{label}</Label>
          {tip && (
            <Box pointerEvents="auto" flex="0 0 auto">
              <InfoTip label={label}>{tip}</InfoTip>
            </Box>
          )}
        </Flex>
        <Flex align="baseline" gap={2} wrap="wrap">
          <Text fontSize="21px" fontWeight={650} color={T.ink} letterSpacing="-0.02em"
            sx={{ fontVariantNumeric: "tabular-nums" }} lineHeight={1.1}>{value}</Text>
          {second && (
            <Text fontSize="13px" color={T.muted} fontFamily={MONO} lineHeight={1.1}>
              <Text as="span" color={T.dim}>| </Text>{second}
            </Text>
          )}
        </Flex>
        <Box mt={1.5}><Delta value={d} lowerIsBetter={lowerIsBetter} /></Box>
      </Box>
    </Box>
  );
}

/** Volume metric: distribution over time, plus the split by media type. */
function VolumeDrill({ v, data, metric }: { v: View; data: Data; metric: Metric }) {
  const rows = seriesByMedia(v, data, metric);
  const fmt = metric === "spend" ? (n: number) => money(n) : compact;
  const total = v.totals[metric];
  return (
    <Grid templateColumns={{ base: "1fr", lg: "1fr 240px" }} gap={4}>
      <Box h="200px">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={T.lineSoft} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={44}
              tick={{ fontSize: 10, fill: T.dim, fontFamily: MONO }} stroke={T.line} />
            <YAxis tickFormatter={fmt} width={52}
              tick={{ fontSize: 10, fill: T.dim, fontFamily: MONO }} stroke={T.line} />
            <Tooltip cursor={{ stroke: T.dim }} content={({ active, payload, label }) =>
              active && payload?.length ? (
                <Tip title={shortDate(String(label))}
                  rows={payload.slice().reverse().map((p) => ({
                    label: data.mediaTypes.find((m) => m.key === p.dataKey)?.label ?? "",
                    value: fmt(Number(p.value)), color: String(p.fill),
                  }))} />) : null} />
            {v.media.map((m) => (
              <Area key={m.key} dataKey={m.key} stackId="1" type="monotone"
                stroke={m.color} fill={m.color} fillOpacity={0.22} strokeWidth={1.5}
                isAnimationActive={false} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </Box>
      <Box>
        <Label as="div" mb={2.5}>By media type</Label>
        <Flex direction="column" gap={2.5}>
          {v.media.map((m) => {
            const val = v.byMedia[m.key][metric];
            return (
              <Box key={m.key}>
                <Flex justify="space-between" align="baseline" mb="3px">
                  <Text fontSize="12px" color={T.muted}>{m.label}</Text>
                  <Text fontFamily={MONO} fontSize="12px" color={T.ink} fontWeight={600}>
                    {fmt(val)}
                    <Text as="span" color={T.dim} fontWeight={400}> {pct(val / total, 0)}</Text>
                  </Text>
                </Flex>
                <Box bg={T.bg} borderRadius="3px" h="6px" overflow="hidden">
                  <Box h="100%" bg={m.color} w={`${(val / total) * 100}%`} />
                </Box>
              </Box>
            );
          })}
        </Flex>
      </Box>
    </Grid>
  );
}

/** Reach: unique identifiers, and how hard each media type worked them. */
function ReachDrill({ v, data }: { v: View; data: Data }) {
  const { unique, raw, overlap, perCampaign } = reachOf(v, data);
  const rows = v.media.map((m) => {
    const ids = v.campaigns.filter((c) => c.mediaType === m.key);
    const reach = ids.reduce((s, c) => s + (perCampaign[c.id]?.reach ?? 0), 0);
    const imp = ids.reduce((s, c) => s + (v.byCampaign[c.id]?.impressions ?? 0), 0);
    return { ...m, reach, imp, freq: reach > 0 ? imp / reach : 0,
             ident: data.reach.identifiers[m.key] };
  }).filter((r) => r.imp > 0);
  const max = Math.max(...rows.map((r) => r.reach), 1);

  return (
    <Box>
      <Flex direction="column" gap={4}>
        {rows.map((r) => (
          <Box key={r.key}>
            <Flex align="baseline" gap={2.5} mb={1.5} wrap="wrap">
              <Box w="9px" h="9px" borderRadius="2px" bg={r.color} />
              <Text fontSize="12.5px" color={T.ink}>{r.label}</Text>
              <Text fontFamily={MONO} fontSize="11px" color={T.dim}>{r.ident}</Text>
              <Text ml="auto" fontFamily={MONO} fontSize="12.5px" fontWeight={600} color={T.ink}
                sx={{ fontVariantNumeric: "tabular-nums" }}>
                {nf(r.reach)}
                <Text as="span" color={T.dim} fontWeight={400}> reached · {r.freq.toFixed(1)}x each</Text>
              </Text>
            </Flex>
            <Box bg={T.bg} borderRadius="3px" h="12px" overflow="hidden">
              <Box h="100%" bg={r.color} borderRadius="0 3px 3px 0" opacity={0.85}
                w={`${(r.reach / max) * 100}%`} />
            </Box>
          </Box>
        ))}
      </Flex>
      <Box mt={5} pt={4} borderTop="1px solid" borderColor={T.lineSoft}>
        <Flex gap={7} wrap="wrap">
          {[["Sum of each media", nf(raw)],
            [`Less ${pct(overlap, 0)} shared between them`, `− ${nf(raw - unique)}`],
            ["Unique identifiers", nf(unique)]].map(([k, val], i) => (
            <Box key={k}>
              <Label as="div" mb="3px">{k}</Label>
              <Text fontFamily={MONO} fontSize="15px" fontWeight={600}
                color={i === 2 ? T.ink : T.muted}
                sx={{ fontVariantNumeric: "tabular-nums" }}>{val}</Text>
            </Box>
          ))}
        </Flex>
      </Box>
    </Box>
  );
}

/** Cost metric: the same cost compared across media types. */
function CostDrill({ v, kind }: { v: View; kind: "cpm" | "cpc" | "cpa" }) {
  const rows = v.media.map((m) => {
    const t = v.byMedia[m.key];
    const value = kind === "cpm" ? (t.spend / t.impressions) * 1000
      : kind === "cpc" ? t.spend / t.clicks : t.spend / t.conversions;
    return { label: m.label, value: Number.isFinite(value) ? value : 0, color: m.color };
  }).sort((a, b) => a.value - b.value);
  return (
    <Box h="200px">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={T.lineSoft} horizontal={false} />
          <XAxis type="number" tickFormatter={(n: number) => money(n, kind === "cpa" ? 0 : 2)}
            tick={{ fontSize: 10, fill: T.dim, fontFamily: MONO }} stroke={T.line} />
          <YAxis type="category" dataKey="label" width={92}
            tick={{ fontSize: 12, fill: T.muted }} stroke={T.line} />
          <Tooltip cursor={{ fill: T.lineSoft }} content={({ active, payload }) =>
            active && payload?.length ? (
              <Tip title={String(payload[0].payload.label)}
                rows={[{ label: kind.toUpperCase(), value: money(Number(payload[0].value), 2) }]} />) : null} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={26} isAnimationActive={false}
            label={{ position: "right", formatter: (n: React.ReactNode) => money(Number(n), 2),
              fill: T.ink, fontSize: 11.5, fontFamily: MONO }}>
            {rows.map((r) => <Cell key={r.label} fill={r.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

/**
 * How to use the cards, plus the two caveats that belong to the media mix
 * rather than to any one metric — stated once here instead of repeated inside
 * every tooltip.
 */
function MediaNote() {
  return (
    <Box bg={T.surface} border="1px solid" borderColor={T.line} borderRadius="6px"
      px={4} py={3} mb={3}>
      <Text fontSize="12.5px" color={T.muted} lineHeight={1.65} maxW="104ch">
        <Text as="span" color={T.ink} fontWeight={600}>Note:</Text> click on the cards below to
        view media type distributions. Email has no impression, so its delivered count sits in
        the impressions column. Clicks do not compare across media either — email goes to people
        who opted in, and video mostly converts people who never click at all.
      </Text>
    </Box>
  );
}

export default function TopLine({ v, data }: { v: View; data: Data }) {
  const [open, setOpen] = useState<CardId | null>(null);
  const t = v.totals, p = v.priorTotals;
  const rate = (a: number, b: number) => (b > 0 ? a / b : 0);
  const reach = reachOf(v, data);
  const cost = (a: number, b: number) => (b > 0 ? a / b : 0);
  const toggle = (id: CardId) => setOpen((o) => (o === id ? null : id));

  // Email has no impressions; the same field carries delivered. Label it for
  // whatever is actually in scope rather than averaging two different events
  // under one word.
  const cards: { id: CardId; label: string; value: string; second?: string; delta: number; lower?: boolean; tip?: string }[] = [
    { id: "impressions",
      label: v.email.only ? "Total Delivered" : "Total Impressions",
      value: compact(t.impressions),
      tip: "Times an ad was served. Email counts a delivered email instead.",
      delta: delta(t.impressions, p.impressions) },
    { id: "clicks", label: "Total Clicks / Click Rate", value: nf(t.clicks),
      second: pct(rate(t.clicks, t.impressions), 2),
      tip: "Clicks, and clicks ÷ impressions beside it.",
      delta: delta(t.clicks, p.clicks) },
    { id: "conversions", label: "Total Conversions / Conversion Rate", value: nf(t.conversions),
      second: pct(rate(t.conversions, t.clicks), 1),
      tip: "Conversions credited to the last ad seen, within 30 days. Rate is conversions ÷ clicks.",
      delta: delta(t.conversions, p.conversions) },
    { id: "reach", label: "Unique Reach", value: compact(reach.unique),
      delta: NaN,
      tip: "Unique identifiers reached in the selected dates. Modelled, not counted: display and video dedupe on a device id, email on a hashed address, and the two are matched rather than joined." },
  ];
  const costs: { id: CardId; label: string; value: string; delta: number; lower?: boolean; tip?: string }[] = [
    { id: "spend", label: "Total Spend", value: money(t.spend), delta: delta(t.spend, p.spend), lower: true,
      tip: "Media cost across everything in scope. Straight off the invoices." },
    { id: "cpm", label: v.email.only ? "Cost per Mille Delivered" : "Cost per Mille",
      tip: "Spend ÷ impressions × 1,000.",
      value: money(cost(t.spend, t.impressions) * 1000, 2),
      delta: delta(cost(t.spend, t.impressions), cost(p.spend, p.impressions)) },
    { id: "cpc", label: "Cost per Click", value: money(cost(t.spend, t.clicks), 2),
      tip: "Spend ÷ clicks.",
      delta: delta(cost(t.spend, t.clicks), cost(p.spend, p.clicks)) },
    { id: "cpa", label: "Cost per Conversion", value: money(cost(t.spend, t.conversions), 2),
      tip: "Spend ÷ conversions.",
      delta: delta(cost(t.spend, t.conversions), cost(p.spend, p.conversions)) },
  ];

  const openCard = [...cards, ...costs].find((c) => c.id === open);

  return (
    <Box>
      <MediaNote />
      <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }} gap={3}>
        {cards.map((c) => (
          <Card key={c.id} {...c} lowerIsBetter={c.lower} open={open === c.id} onClick={() => toggle(c.id)} />
        ))}
      </Grid>
      <Box borderTop="1px solid" borderColor={T.line} my={4} />
      <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }} gap={3}>
        {costs.map((c) => (
          <Card key={c.id} {...c} lowerIsBetter open={open === c.id} onClick={() => toggle(c.id)} />
        ))}
      </Grid>
      {open && openCard && (
        <Box mt={3}>
          <Panel title={openCard.label}>
            {open === "reach"
              ? <ReachDrill v={v} data={data} />
              : open in VOLUME
              ? <VolumeDrill v={v} data={data} metric={VOLUME[open]} />
              : <CostDrill v={v} kind={open as "cpm" | "cpc" | "cpa"} />}
          </Panel>
        </Box>
      )}
    </Box>
  );
}

export type { MediaKey };
