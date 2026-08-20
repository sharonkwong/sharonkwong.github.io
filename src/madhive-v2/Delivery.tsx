import type React from "react";
import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { compact, defaultGrain, deviceTotals, geoAll, geoTotals, nf, pct, rollup, seriesByMedia, shortDate, useShapes } from "./data";
import type { View } from "./data";
import type { Data, ShareMetric } from "./types";
import GeoMap from "./GeoMap";
import { DataTable, Label, MONO, Panel, Question, T, Tip, Toggle } from "./ui";
import type { Column } from "./ui";

const METRIC_OPTS = [
  { value: "impressions" as ShareMetric, label: "Impressions" },
  { value: "clicks" as ShareMetric, label: "Clicks" },
  { value: "conversions" as ShareMetric, label: "Conversions" },
];

/* --------------------------------------------------------------- delivery */
function Pacing({ v, data, days }: { v: View; data: Data; days: number }) {
  const [grain, setGrain] = useState<"day" | "week">(defaultGrain(days));
  const series = rollup(seriesByMedia(v, data, "impressions"), grain);
  // Display runs ~5x video and ~12x email. On one shared axis the two smaller
  // series flatten into the floor, so each gets its own panel and its own scale.
  return (
    <Panel right={
      <Toggle ariaLabel="Granularity" value={grain} onChange={setGrain}
        options={[{ value: "day" as const, label: "Day" }, { value: "week" as const, label: "Week" }]} />
    }>
      <Grid templateColumns={{ base: "1fr", md: `repeat(${v.media.length}, 1fr)` }} gap={4}>
        {v.media.map((m) => {
          const peak = Math.max(...series.map((r) => r[m.key]));
          const mean = series.reduce((s, r) => s + r[m.key], 0) / series.length;
          return (
            <Box key={m.key}>
              <Flex align="baseline" gap={2} mb={1.5}>
                <Box w="9px" h="9px" borderRadius="2px" bg={m.color} />
                <Text fontSize="12px" color={T.ink}>{m.label}</Text>
                <Text ml="auto" fontFamily={MONO} fontSize="11px" color={T.dim}>
                  avg {compact(mean)}/{grain === "day" ? "day" : "wk"}
                </Text>
              </Flex>
              <Box h="170px">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={T.lineSoft} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40}
                      tick={{ fontSize: 9.5, fill: T.dim, fontFamily: MONO }} stroke={T.line} />
                    <YAxis domain={[0, Math.ceil(peak * 1.12)]} tickFormatter={compact} width={44}
                      tick={{ fontSize: 9.5, fill: T.dim, fontFamily: MONO }} stroke={T.line} />
                    <Tooltip cursor={{ stroke: T.dim }} content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <Tip title={shortDate(String(label))}
                          rows={[{ label: m.label, value: compact(Number(payload[0].value)), color: m.color }]} />
                      ) : null} />
                    <ReferenceLine y={mean} stroke={T.dim} strokeDasharray="3 3" />
                    <Line dataKey={m.key} type="monotone" stroke={m.color} strokeWidth={2}
                      dot={false} activeDot={{ r: 3.5 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          );
        })}
      </Grid>
    </Panel>
  );
}

/* ----------------------------------------------------------------- device */
function Devices({ v, data }: { v: View; data: Data }) {
  const [metric, setMetric] = useState<ShareMetric>("impressions");
  const rows = deviceTotals(v, data.devices, metric);
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <Panel right={<Toggle ariaLabel="Device measure" options={METRIC_OPTS} value={metric} onChange={setMetric} />}>
      <Box h="220px">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 18, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={T.lineSoft} vertical={false} />
            <XAxis dataKey="device" tick={{ fontSize: 12, fill: T.muted }} stroke={T.line} />
            <YAxis tickFormatter={compact} width={52}
              tick={{ fontSize: 10, fill: T.dim, fontFamily: MONO }} stroke={T.line} />
            <Tooltip cursor={{ fill: T.lineSoft }} content={({ active, payload }) =>
              active && payload?.length ? (
                <Tip title={String(payload[0].payload.device)} rows={[
                  { label: metric, value: nf(Number(payload[0].value)) },
                  { label: "share", value: pct(Number(payload[0].value) / total, 1) },
                ]} />) : null} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={92} fill={T.ramp[4]}
              isAnimationActive={false}
              label={{ position: "top", formatter: (n: React.ReactNode) => compact(Number(n)),
                fill: T.muted, fontSize: 11, fontFamily: MONO }} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Panel>
  );
}

/* -------------------------------------------------------------------- geo */
function Geo({ v, data }: { v: View; data: Data }) {
  const [metric, setMetric] = useState<ShareMetric>("impressions");
  const [pinned, setPinned] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const shapes = useShapes();
  const zips = useMemo(() => geoTotals(v, data.geo, metric), [v, data.geo, metric]);
  const byZip = useMemo(() => new Map(zips.map((z) => [z.zip, z.value])), [zips]);
  const total = zips.reduce((s, z) => s + z.value, 0);
  const max = Math.max(...zips.map((z) => z.value), 1);
  const min = Math.min(...zips.map((z) => z.value));
  const shown = pinned ?? hover;
  const detail = zips.find((z) => z.zip === shown);
  const rank = [...zips].sort((a, b) => b.value - a.value);

  const step = (val: number) => {
    const t = max > min ? (val - min) / (max - min) : 1;
    return T.ramp[Math.min(5, Math.max(1, Math.ceil(t * 5) || 1))];
  };
  const bright = (val: number) =>
    (max > min ? (val - min) / (max - min) : 1) > 0.6;

  return (
    <Panel right={<Toggle ariaLabel="Geo measure" options={METRIC_OPTS} value={metric} onChange={setMetric} />}>
      <Grid templateColumns={{ base: "1fr", lg: "1fr 268px" }} gap={5}>
        <Box>
          {shapes && (
            <Box>
              <GeoMap shapes={shapes}
                colorFor={(z) => step(byZip.get(z) ?? 0)}
                isBright={(z) => bright(byZip.get(z) ?? 0)}
                labelFor={(z) => {
                  const g = zips.find((x) => x.zip === z);
                  return g ? `${g.name} · ${compact(g.value)} ${metric}` : "";
                }}
                selected={shown ?? null}
                onHover={setHover}
                onSelect={(z) => setPinned((p) => (p === z ? null : z))} />
            </Box>
          )}
          <Flex align="center" gap={2} mt={3}>
            <Label>Low</Label>
            <Flex gap="2px">
              {T.ramp.slice(1).map((c) => <Box key={c} w="26px" h="9px" bg={c} borderRadius="1px" />)}
            </Flex>
            <Label>High</Label>
            <Text fontFamily={MONO} fontSize="10.5px" color={T.dim} ml="auto">
              {compact(total)} {metric} · {zips.length} ZIPs
            </Text>
          </Flex>
        </Box>

        <Box borderLeft={{ lg: "1px solid" }} borderColor={{ lg: T.line }} pl={{ lg: 5 }}>
          {detail ? (
            <>
              <Flex align="baseline" gap={2} mb={0.5}>
                <Text fontFamily={MONO} fontSize="15px" fontWeight={650} color={T.ink}>{detail.zip}</Text>
                <Text fontSize="12px" color={T.muted}>{detail.name}</Text>
              </Flex>
              <Text fontSize="11px" color={T.dim} mb={3}>
                #{rank.findIndex((r) => r.zip === detail.zip) + 1} of {rank.length}
              </Text>
              <Flex direction="column" gap={2}>
                {METRIC_OPTS.map((o) => {
                  const zz = geoTotals(v, [detail], o.value)[0];
                  const tt = geoTotals(v, data.geo, o.value).reduce((s, z) => s + z.value, 0);
                  return (
                    <Flex key={o.value} justify="space-between" align="baseline"
                      borderBottom="1px solid" borderColor={T.lineSoft} pb={1.5}>
                      <Text fontSize="12px" color={T.muted}>{o.label}</Text>
                      <Text fontFamily={MONO} fontSize="12.5px" color={T.ink} fontWeight={600}>
                        {nf(zz.value)}
                        <Text as="span" color={T.dim} fontWeight={400}> {pct(zz.value / tt, 1)}</Text>
                      </Text>
                    </Flex>
                  );
                })}
              </Flex>
              <Label as="div" mt={4} mb={2}>Area profile</Label>
              <Flex direction="column" gap={2}>
                {[["Median income", `$${detail.medianIncome.toLocaleString("en-US")}`],
                  ["Median age", detail.medianAge.toFixed(1)],
                  ["Bachelor's or higher", pct(detail.degreeShare, 0)]].map(([k, val]) => (
                  <Flex key={k} justify="space-between" align="baseline">
                    <Text fontSize="12px" color={T.muted}>{k}</Text>
                    <Text fontFamily={MONO} fontSize="12.5px" color={T.ink}>{val}</Text>
                  </Flex>
                ))}
              </Flex>
            </>
          ) : (
            <Flex h="100%" minH="200px" align="center" justify="center">
              <Text fontSize="12.5px" color={T.muted} textAlign="center">
                Hover a ZIP for its numbers,<br />click to pin its profile
              </Text>
            </Flex>
          )}
        </Box>
      </Grid>
    </Panel>
  );
}

function ZipTable({ v, data }: { v: View; data: Data }) {
  const rows = useMemo(() => geoAll(v, data.geo), [v, data.geo]);
  type R = (typeof rows)[number];
  const columns: Column<R>[] = [
    { key: "zip", label: "ZIP", sort: (r) => r.zip, width: "78px",
      render: (r) => <Text as="span" fontFamily={MONO} fontSize="12px">{r.zip}</Text> },
    { key: "name", label: "Area", sort: (r) => r.name },
    { key: "impressions", label: "Impressions", align: "right", numeric: true,
      sort: (r) => r.impressions, render: (r) => nf(r.impressions) },
    { key: "clicks", label: "Clicks", align: "right", numeric: true,
      sort: (r) => r.clicks, render: (r) => nf(r.clicks) },
    { key: "conversions", label: "Conversions", align: "right", numeric: true,
      sort: (r) => r.conversions, render: (r) => nf(r.conversions) },
    { key: "ctr", label: "CTR", align: "right", numeric: true,
      sort: (r) => r.ctr, render: (r) => pct(r.ctr, 2) },
    { key: "cvr", label: "CVR", align: "right", numeric: true,
      sort: (r) => r.cvr, render: (r) => pct(r.cvr, 1) },
  ];
  return (
    <Panel>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.zip} minW="700px"
        initialSort={{ key: "impressions", dir: "desc" }} />
    </Panel>
  );
}

export default function Delivery({ v, data, days }: { v: View; data: Data; days: number }) {
  return (
    <>
      <Question>Are your ads delivering each day properly?</Question>
      <Pacing v={v} data={data} days={days} />
      <Box mt={5}>
        <Question>What does the device distribution look like for your campaign?</Question>
        <Devices v={v} data={data} />
      </Box>
      <Box mt={5}>
        <Question>How well did your ads do across geographic locations?</Question>
        <Geo v={v} data={data} />
        <Box mt={3}><ZipTable v={v} data={data} /></Box>
      </Box>
    </>
  );
}
