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

function Detail({ row, data }: { row: Row; data: Data }) {
  const [metric, setMetric] = useState<ShareMetric>("impressions");
  const color = data.mediaTypes.find(
    (m) => m.key === data.campaigns.find((c) => c.id === row.campaign)!.mediaType)!.color;
  const places = placementTotals(row, metric);
  const max = Math.max(...places.map((p) => p.value), 1);
  return (
    <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={5}>
      <Box>
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
        <Flex gap={5} mt={3} wrap="wrap">
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
                <Text fontFamily={MONO} fontSize="10.5px" color={T.dim} w="16px" flex="0 0 auto">
                  {i + 1}
                </Text>
                <Text fontSize="12px" color={T.muted} w="120px" flex="0 0 auto" noOfLines={1}>
                  {p.site}
                </Text>
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

export default function Creatives({ v, data }: { v: View; data: Data }) {
  const [open, setOpen] = useState<string | null>(null);
  const campaignName = Object.fromEntries(data.campaigns.map((c) => [c.id, c.name]));
  const rows = useMemo(() => creativeTotals(v, data.creatives), [v, data.creatives]);
  const selected = rows.find((r) => r.id === open);

  const columns: Column<Row>[] = [
    { key: "name", label: "Creative", sort: (r) => r.name,
      render: (r) => (
        <>
          <Text as="span" color={T.dim} fontSize="10px" mr={1.5}>{open === r.id ? "▾" : "▸"}</Text>
          {r.name}
        </>
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
      <Panel>
        <DataTable
          columns={columns} rows={rows} rowKey={(r) => r.id} minW="860px"
          initialSort={{ key: "conversions", dir: "desc" }}
          onRowClick={(r) => setOpen(open === r.id ? null : r.id)}
          isOpen={(r) => open === r.id} />
      </Panel>
      {selected && (
        <Box mt={3}>
          <Panel title={selected.name}>
            <Detail row={selected} data={data} />
          </Panel>
        </Box>
      )}
    </>
  );
}
