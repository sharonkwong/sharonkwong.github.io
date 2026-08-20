import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { compact, creativeTotals, nf, pct, placementTotals } from "./data";
import type { View } from "./data";
import type { Data, ShareMetric } from "./types";
import { DataTable, Label, MONO, Panel, Question, T, Tip, Toggle } from "./ui";
import type { Column } from "./ui";

export type Row = ReturnType<typeof creativeTotals>[number];

const MAX_OPEN = 3;

/* ------------------------------------------------------------ select dot */
function Dot({ on, disabled }: { on: boolean; disabled: boolean }) {
  return (
    <Box as="span" display="inline-flex" alignItems="center" justifyContent="center"
      w="14px" h="14px" borderRadius="full" mr={2} flex="0 0 auto"
      border="1.5px solid"
      borderColor={on ? T.focus : disabled ? T.lineSoft : T.dim}
      bg={on ? T.focus : "transparent"}
      opacity={disabled && !on ? 0.45 : 1} transition="all .12s">
      {on && <Box w="5px" h="5px" borderRadius="full" bg={T.bg} />}
    </Box>
  );
}

/* --------------------------------------------------------- video quartiles */
function Quartiles({ q, color }: { q: number[]; color: string }) {
  const rows = q.map((v, i) => ({ stage: ["Start", "25%", "50%", "75%", "100%"][i], value: v }));
  const drops = q.slice(1).map((v, i) => v - q[i]);
  const worst = drops.indexOf(Math.min(...drops));
  return (
    <Box>
      <Label as="div" mb={2}>Completion drop-off</Label>
      <Box h="132px">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={T.lineSoft} vertical={false} />
            <XAxis dataKey="stage" tick={{ fontSize: 10.5, fill: T.dim, fontFamily: MONO }} stroke={T.line} />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(n: number) => `${n}%`}
              width={38} tick={{ fontSize: 10, fill: T.dim, fontFamily: MONO }} stroke={T.line} />
            <Tooltip cursor={{ stroke: T.dim }} content={({ active, payload, label }) =>
              active && payload?.length ? (
                <Tip title={String(label)}
                  rows={[{ label: "still playing", value: `${Number(payload[0].value).toFixed(1)}%` }]} />) : null} />
            <Line dataKey="value" type="monotone" stroke={color} strokeWidth={2}
              dot={{ r: 3, fill: color, strokeWidth: 0 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <Text fontFamily={MONO} fontSize="11px" color={T.muted} mt={1}>
        biggest drop {rows[worst].stage} → {rows[worst + 1].stage}: {drops[worst].toFixed(1)} pts
      </Text>
    </Box>
  );
}

/* ------------------------------------------------------- email sections */
const IMG_W = 250;   // rendered width of the creative
const ELBOW = 30;    // horizontal run before the line turns
const GUTTER = 62;   // total space between creative and label column
const LABEL_H = 40;  // vertical room each label needs

/**
 * Clicks by band, with a leader line from the band to its number. Label
 * positions start at each band's midpoint, then get pushed apart so two
 * lines never end at the same height.
 */
function Sections({ row, color }: { row: Row; color: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const sections = row.sections!;
  const [w, h] = row.dimensions.split("x").map(Number);
  const imgH = Math.round(IMG_W * (h / w));

  const laid = useMemo(() => {
    const want = sections.map((s) => ({
      ...s,
      clicks: row.clicks * s.clickShare,
      midY: (s.y + s.h / 2) * imgH,
      top: (s.y + s.h / 2) * imgH,
    }));
    // Declutter downward, then pull the stack back if it overran the bottom.
    for (let i = 1; i < want.length; i++) {
      want[i].top = Math.max(want[i].top, want[i - 1].top + LABEL_H);
    }
    const overflow = want[want.length - 1].top + LABEL_H / 2 - imgH;
    if (overflow > 0) for (const s of want) s.top -= overflow;
    return want;
  }, [sections, row.clicks, imgH]);

  const maxClicks = Math.max(...laid.map((s) => s.clicks));

  return (
    <Box>
      <Label as="div" mb={2.5}>Clicks by email section</Label>
      <Flex align="flex-start" position="relative">
        {/* creative + band overlay */}
        <Box position="relative" w={`${IMG_W}px`} h={`${imgH}px`} flex="0 0 auto">
          <Box as="img" src={row.asset} alt={`${row.name} creative`}
            w={`${IMG_W}px`} h={`${imgH}px`} display="block" borderRadius="4px" />
          {sections.map((s) => {
            const on = hover === s.key;
            return (
              <Box key={s.key} position="absolute" left={0} right={0}
                top={`${s.y * imgH}px`} h={`${s.h * imgH}px`}
                onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}
                border="1px solid" borderColor={on ? color : "transparent"}
                bg={on ? `${color}22` : "transparent"} cursor="default"
                transition="all .12s" />
            );
          })}
        </Box>

        {/* leader lines */}
        <Box as="svg" width={`${GUTTER}px`} height={`${imgH}px`} flex="0 0 auto"
          viewBox={`0 0 ${GUTTER} ${imgH}`} style={{ overflow: "visible" }}>
          {laid.map((s) => {
            const on = hover === s.key;
            return (
              <g key={s.key} opacity={on ? 1 : 0.6}>
                <polyline
                  points={`0,${s.midY.toFixed(1)} ${ELBOW},${s.midY.toFixed(1)} ${GUTTER},${s.top.toFixed(1)}`}
                  fill="none" stroke={on ? color : T.dim} strokeWidth={on ? 1.6 : 1} />
                <circle cx={0} cy={s.midY} r={on ? 2.6 : 2} fill={on ? color : T.dim} />
              </g>
            );
          })}
        </Box>

        {/* numbers */}
        <Box position="relative" h={`${imgH}px`} flex="1" minW="150px">
          {laid.map((s) => (
            <Box key={s.key} position="absolute" left={0} right={0}
              top={`${s.top - LABEL_H / 2}px`} h={`${LABEL_H}px`}
              onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}>
              <Flex align="baseline" gap={1.5}>
                <Text fontSize="11.5px" color={hover === s.key ? T.ink : T.muted}>{s.label}</Text>
                <Text ml="auto" fontFamily={MONO} fontSize="12.5px" fontWeight={600} color={T.ink}
                  sx={{ fontVariantNumeric: "tabular-nums" }}>{nf(s.clicks)}</Text>
                <Text fontFamily={MONO} fontSize="10.5px" color={T.dim} w="30px" textAlign="right">
                  {pct(s.clickShare, 0)}
                </Text>
              </Flex>
              <Box mt="3px" bg={T.bg} borderRadius="2px" h="5px" overflow="hidden">
                <Box h="100%" bg={color} opacity={hover === s.key ? 1 : 0.7}
                  w={`${(s.clicks / maxClicks) * 100}%`} transition="opacity .12s" />
              </Box>
            </Box>
          ))}
        </Box>
      </Flex>
    </Box>
  );
}

/* ---------------------------------------------------------------- detail */
function Detail({ row, data }: { row: Row; data: Data }) {
  const [metric, setMetric] = useState<ShareMetric>("impressions");
  const color = data.mediaTypes.find(
    (m) => m.key === data.campaigns.find((c) => c.id === row.campaign)!.mediaType)!.color;
  const places = placementTotals(row, metric);
  const max = Math.max(...places.map((p) => p.value), 1);

  return (
    <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={5}>
      <Box>
        {row.sections ? <Sections row={row} color={color} /> : (
          <Box bg={T.bg} border="1px solid" borderColor={T.line} borderRadius="6px" p={3}
            display="flex" alignItems="center" justifyContent="center" minH="200px">
            {row.assetKind === "video" ? (
              <Box as="video" src={row.asset} poster={row.poster ?? undefined} controls muted
                playsInline preload="none" w="100%" borderRadius="4px"
                sx={{ aspectRatio: "16 / 9" }} />
            ) : (
              <Box as="img" src={row.asset} alt={`${row.name} creative`} maxW="100%" maxH="300px"
                borderRadius="4px" />
            )}
          </Box>
        )}
        <Flex gap={5} mt={4} wrap="wrap">
          {[["Impressions", compact(row.impressions)], ["Clicks", nf(row.clicks)],
            ["Conversions", nf(row.conversions)],
            ["CTR", pct(row.clicks / row.impressions, 2)],
            ["CVR", pct(row.conversions / row.clicks, 1)]].map(([k, val]) => (
            <Box key={k}>
              <Label as="div">{k}</Label>
              <Text fontFamily={MONO} fontSize="14px" fontWeight={600} color={T.ink}
                sx={{ fontVariantNumeric: "tabular-nums" }}>{val}</Text>
            </Box>
          ))}
        </Flex>
        {row.quartiles && <Box mt={4}><Quartiles q={row.quartiles} color={color} /></Box>}
      </Box>

      <Box borderLeft={{ lg: "1px solid" }} borderColor={{ lg: T.line }} pl={{ lg: 5 }}>
        <Flex justify="space-between" align="center" mb={3} gap={3} wrap="wrap">
          <Label>Site placements</Label>
          <Toggle ariaLabel="Placement ranking" value={metric} onChange={setMetric}
            options={[
              { value: "impressions" as ShareMetric, label: "Impressions" },
              { value: "clicks" as ShareMetric, label: "Clicks" },
              { value: "conversions" as ShareMetric, label: "Conversions" },
            ]} />
        </Flex>
        <Box maxH="340px" overflowY="auto" pr={2}
          sx={{ "&::-webkit-scrollbar": { width: "8px" },
                "&::-webkit-scrollbar-thumb": { background: T.line, borderRadius: "4px" } }}>
          <Flex direction="column" gap={2}>
            {places.map((p, i) => (
              <Flex key={p.site} align="center" gap={2.5}>
                <Text fontFamily={MONO} fontSize="10.5px" color={T.dim} w="16px" flex="0 0 auto">{i + 1}</Text>
                <Text fontSize="12px" color={T.muted} w="120px" flex="0 0 auto" noOfLines={1}>{p.site}</Text>
                <Box flex="1" bg={T.bg} borderRadius="3px" h="14px" overflow="hidden" minW={0}>
                  <Box h="100%" bg={color} borderRadius="0 3px 3px 0" opacity={0.85}
                    w={`${(p.value / max) * 100}%`} transition="width .25s" />
                </Box>
                <Text fontFamily={MONO} fontSize="11.5px" color={T.ink} w="52px" textAlign="right"
                  flex="0 0 auto" sx={{ fontVariantNumeric: "tabular-nums" }}>{compact(p.value)}</Text>
              </Flex>
            ))}
          </Flex>
        </Box>
        <Text fontFamily={MONO} fontSize="10.5px" color={T.dim} mt={3}>
          {places.length} placements · ranked by {metric}
        </Text>
      </Box>
    </Grid>
  );
}

/* ----------------------------------------------------------------- table */
export default function Creatives({ v, data }: { v: View; data: Data }) {
  const [open, setOpen] = useState<string[]>([]);
  const campaignName = Object.fromEntries(data.campaigns.map((c) => [c.id, c.name]));
  const rows = useMemo(() => creativeTotals(v, data.creatives), [v, data.creatives]);
  const full = open.length >= MAX_OPEN;

  const toggle = (id: string) => setOpen((o) =>
    o.includes(id) ? o.filter((x) => x !== id) : o.length < MAX_OPEN ? [...o, id] : o);

  const columns: Column<Row>[] = [
    { key: "name", label: "Creative", sort: (r) => r.name,
      render: (r) => (
        <Flex align="center">
          <Dot on={open.includes(r.id)} disabled={full} />
          {r.name}
        </Flex>
      ) },
    { key: "campaign", label: "Campaign", sort: (r) => campaignName[r.campaign],
      render: (r) => campaignName[r.campaign] },
    { key: "format", label: "Format", sort: (r) => r.format },
    { key: "size", label: "Size", sort: (r) => r.dimensions,
      render: (r) => (
        <Text as="span" fontFamily={MONO} fontSize="11.5px">
          {r.dimensions}{r.seconds ? ` · :${r.seconds}` : ""}
        </Text>
      ) },
    { key: "impressions", label: "Impressions", align: "right", numeric: true,
      sort: (r) => r.impressions, render: (r) => compact(r.impressions) },
    { key: "clicks", label: "Clicks", align: "right", numeric: true,
      sort: (r) => r.clicks, render: (r) => nf(r.clicks) },
    { key: "conversions", label: "Conversions", align: "right", numeric: true,
      sort: (r) => r.conversions, render: (r) => nf(r.conversions) },
    { key: "ctr", label: "CTR", align: "right", numeric: true,
      sort: (r) => r.clicks / r.impressions, render: (r) => pct(r.clicks / r.impressions, 2) },
    { key: "cvr", label: "CVR", align: "right", numeric: true,
      sort: (r) => r.conversions / r.clicks, render: (r) => pct(r.conversions / r.clicks, 1) },
  ];

  return (
    <>
      <Question>Which creative performed the best?</Question>
      <Panel right={
        <Text fontFamily={MONO} fontSize="10.5px" color={full ? T.muted : T.dim}>
          {open.length} / {MAX_OPEN} selected
        </Text>
      }>
        <DataTable
          columns={columns} rows={rows} rowKey={(r) => r.id} minW="860px"
          initialSort={{ key: "conversions", dir: "desc" }}
          onRowClick={(r) => toggle(r.id)}
          isOpen={(r) => open.includes(r.id)} />
      </Panel>
      {open.map((id) => {
        const r = rows.find((x) => x.id === id);
        return r ? (
          <Box key={id} mt={3}>
            <Panel title={r.name}><Detail row={r} data={data} /></Panel>
          </Box>
        ) : null;
      })}
    </>
  );
}
