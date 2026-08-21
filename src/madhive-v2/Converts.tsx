import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { compact, defaultGrain, GRAIN_OPTIONS, money, nf, pct, rollup, seriesByMedia, shortDate } from "./data";
import type { Grain, View } from "./data";
import type { Data, MediaKey, Metric } from "./types";
import Funnel from "./Funnel";
import { Label, Legend, MONO, Panel, Question, T, Tip, Toggle } from "./ui";

function DemoBars({ title, rows, color }: {
  title: string; rows: { label: string; share: number }[]; color: string;
}) {
  const max = Math.max(...rows.map((r) => r.share));
  // First index only, so a tie highlights one bar rather than two.
  const top = rows.findIndex((r) => r.share === max);
  return (
    <Box>
      <Label as="div" mb={2}>{title}</Label>
      <Flex direction="column" gap="7px">
        {rows.map((r, i) => {
          const lead = i === top;
          return (
            <Flex key={r.label} align="center" gap={2.5}>
              <Text fontSize="11.5px" color={lead ? T.ink : T.muted} fontWeight={lead ? 600 : 400}
                w="94px" flex="0 0 auto" noOfLines={1}>{r.label}</Text>
              <Box flex="1" bg={T.bg} borderRadius="3px" h="14px" overflow="hidden" minW={0}>
                <Box h="100%" bg={lead ? T.highlight : color} borderRadius="0 3px 3px 0"
                  w={`${(r.share / max) * 100}%`} opacity={lead ? 1 : 0.85}
                  transition="width .25s" />
              </Box>
              <Text fontFamily={MONO} fontSize="11.5px" color={T.ink}
                fontWeight={lead ? 700 : 400} w="38px" textAlign="right" flex="0 0 auto"
                sx={{ fontVariantNumeric: "tabular-nums" }}>{pct(r.share, 0)}</Text>
            </Flex>
          );
        })}
      </Flex>
    </Box>
  );
}

export default function Converts({ v, data, days }: { v: View; data: Data; days: number }) {
  const [picked, setPicked] = useState<MediaKey | null>(null);
  const [metric, setMetric] = useState<Metric>("clicks");
  const [grain, setGrain] = useState<Grain>(defaultGrain(days));

  const rows = v.media.map((m) => {
    const t = v.byMedia[m.key];
    return { ...m, cpa: t.conversions > 0 ? t.spend / t.conversions : 0, ...t };
  });
  const maxCpa = Math.max(...rows.map((r) => r.cpa), 1);
  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
  const totalConv = rows.reduce((s, r) => s + r.conversions, 0);
  const sel = picked ? rows.find((r) => r.key === picked) : null;
  const demo = picked ? data.demographics[picked] : null;

  const series = rollup(seriesByMedia(v, data, metric), grain);

  /* Launches and endings, pinned to the line they belong to. The marker sits at
     the media type's own value on that date, so an event reads against the
     series it changed rather than floating on the axis. Snapped to the bucket
     containing the date, since a weekly or monthly view has no 14th of June. */
  const events = useMemo(() => {
    const buckets = series.map((r) => r.date);
    const snap = (iso: string) => {
      let hit: string | null = null;
      for (const b of buckets) if (b <= iso) hit = b; else break;
      return hit;
    };
    const out: { key: string; date: string; y: number; color: string; label: string;
                 anchor: "start" | "middle" | "end" }[] = [];
    for (const c of v.campaigns) {
      const m = v.media.find((x) => x.key === c.mediaType);
      if (!m) continue;
      for (const [when, verb] of [[c.flightStart, "launched"], [c.flightEnd, "ended"]] as const) {
        // An end on the last day on record is the flight still running, not an end.
        if (verb === "ended" && when >= data.meta.lastDate) continue;
        const b = snap(when);
        if (!b || when < buckets[0] || when > v.dates[v.dates.length - 1]) continue;
        const row = series.find((r) => r.date === b);
        if (!row) continue;
        // A centred label runs off the plot when its dot is near an edge, so
        // the anchor follows where the dot sits along the axis.
        const at = buckets.indexOf(b) / Math.max(1, buckets.length - 1);
        out.push({ key: `${c.id}-${verb}`, date: b, y: row[m.key], color: m.color,
                   label: `${c.name} ${verb}`,
                   anchor: at < 0.2 ? "start" : at > 0.8 ? "end" : "middle" });
      }
    }
    return out;
  }, [series, v, data.meta.lastDate]);
  const fmt = metric === "spend" ? (n: number) => money(n) : compact;

  return (
    <>
      <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={3} alignItems="stretch">
        <Panel title="Cost per conversion">
          <Flex direction="column" gap={2.5}>
            {[...rows].sort((a, b) => a.cpa - b.cpa).map((r) => {
              const on = picked === r.key;
              return (
                <Flex key={r.key} as="button" type="button" align="center" gap={3} w="100%"
                  onClick={() => setPicked(on ? null : r.key)} aria-pressed={on}
                  opacity={picked && !on ? 0.42 : 1} transition="opacity .15s"
                  _focusVisible={{ outline: "2px solid", outlineColor: T.focus, outlineOffset: "2px" }}>
                  <Text fontSize="12.5px" color={on ? T.ink : T.muted} w="86px" flex="0 0 auto"
                    textAlign="right">{r.label}</Text>
                  <Box flex="1" bg={T.bg} borderRadius="4px" h="22px" overflow="hidden" minW={0}>
                    <Box h="100%" bg={r.color} borderRadius="0 4px 4px 0"
                      w={`${(r.cpa / maxCpa) * 100}%`} transition="width .3s" />
                  </Box>
                  <Box w="86px" flex="0 0 auto" textAlign="right">
                    <Text fontFamily={MONO} fontSize="12.5px" fontWeight={600} color={T.ink}
                      sx={{ fontVariantNumeric: "tabular-nums" }}>{money(r.cpa, 2)}</Text>
                    <Text fontFamily={MONO} fontSize="10.5px" color={T.dim}>{nf(r.conversions)} conv</Text>
                  </Box>
                </Flex>
              );
            })}
          </Flex>

          <Box mt={5}>
            {[["Spend", "spend", totalSpend], ["Conversions", "conversions", totalConv]].map(
              ([lbl, key, tot]) => (
                <Box key={lbl as string} mb={2.5}>
                  <Label as="div" mb="5px">{lbl as string}</Label>
                  <Flex h="20px" borderRadius="4px" overflow="hidden" gap="2px">
                    {rows.map((r) => {
                      const share = (r[key as "spend" | "conversions"] / (tot as number)) * 100;
                      return (
                        <Flex key={r.key} bg={r.color} flex={`0 0 ${share}%`} minW={0}
                          opacity={picked && picked !== r.key ? 0.35 : 1} transition="opacity .15s"
                          align="center" justify="center" fontFamily={MONO} fontSize="10px"
                          fontWeight={700} color={T.bg}>
                          {share > 9 ? `${share.toFixed(0)}%` : ""}
                        </Flex>
                      );
                    })}
                  </Flex>
                </Box>
              ))}
          </Box>
        </Panel>

        <Panel title={sel ? `${sel.label} — who converted` : "Who converted"}>
          {!sel || !demo ? (
            <Flex h="100%" minH="240px" align="center" justify="center" direction="column" gap={2}>
              <Text fontSize="12.5px" color={T.muted}>Select a media type to see who converted</Text>
              <Legend items={v.media.map((m) => ({
                label: m.label, color: m.color, onClick: () => setPicked(m.key),
              }))} />
            </Flex>
          ) : (
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={5}>
              <DemoBars title="Income" rows={demo.income} color={sel.color} />
              <DemoBars title="Age" rows={demo.age} color={sel.color} />
              <DemoBars title="Education" rows={demo.education} color={sel.color} />
              <DemoBars title="Device" rows={demo.device} color={sel.color} />
            </Grid>
          )}
        </Panel>
      </Grid>

      <Box mt={5}>
        <Question>Where do impressions stop?</Question>
        <Funnel v={v} />
      </Box>

      <Box mt={5}>
        <Question>Which days did your customers engage with the ad the most?</Question>
        <Panel
          right={
            <Flex gap={3} align="center" wrap="wrap">
              <Legend items={v.media.map((m) => ({ label: m.label, color: m.color }))} />
              <Toggle ariaLabel="Engagement measure" value={metric} onChange={setMetric}
                options={[
                  { value: "clicks" as Metric, label: "Clicks" },
                  { value: "conversions" as Metric, label: "Conversions" },
                ]} />
              <Toggle ariaLabel="Granularity" value={grain} onChange={setGrain} options={GRAIN_OPTIONS} />
            </Flex>
          }>
          <Box h="260px">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={T.lineSoft} vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={48}
                  tick={{ fontSize: 10, fill: T.dim, fontFamily: MONO }} stroke={T.line} />
                <YAxis tickFormatter={fmt} width={52}
                  tick={{ fontSize: 10, fill: T.dim, fontFamily: MONO }} stroke={T.line} />
                <Tooltip cursor={{ stroke: T.dim }} content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <Tip title={shortDate(String(label))}
                      rows={payload.map((p) => ({
                        label: data.mediaTypes.find((m) => m.key === p.dataKey)?.label ?? "",
                        value: fmt(Number(p.value)), color: String(p.stroke),
                      }))} />) : null} />
                {v.media.map((m) => (
                  <Line key={m.key} dataKey={m.key} type="monotone" stroke={m.color}
                    strokeWidth={2} dot={false} activeDot={{ r: 3.5 }} isAnimationActive={false} />
                ))}
                {/* Recharts' ReferenceDot props are typed narrowly; the label
                    shape it accepts at runtime is wider than the declaration. */}
                {events.map((e: (typeof events)[number], i: number) => (
                  <ReferenceDot key={e.key} {...({
                    x: e.date, y: e.y, r: 4.5,
                    fill: e.color, stroke: T.bg, strokeWidth: 2,
                    label: {
                      content: ({ viewBox }: { viewBox?: { x?: number; y?: number } }) => (
                        <text
                          x={(viewBox?.x ?? 0)
                            + (e.anchor === "start" ? 8 : e.anchor === "end" ? -8 : 0)}
                          // Stagger, or two events a few buckets apart print on
                          // top of each other.
                          y={(viewBox?.y ?? 0) - 10 - (i % 2) * 14}
                          textAnchor={e.anchor} fontSize={10} fill={T.muted} fontFamily={MONO}>
                          {e.label}
                        </text>
                      ),
                    },
                  } as Record<string, unknown>)} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Panel>
      </Box>
    </>
  );
}
