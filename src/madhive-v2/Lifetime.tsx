/**
 * The lifetime tiles in the masthead, and the campaign table they open.
 *
 * Deliberately unfiltered. These are the account's standing totals across every
 * campaign and every day on record, so the table ignores the filter bar --
 * otherwise "lifetime" would mean something different depending on what
 * happened to be selected. Clicking a row is the one place it works the other
 * way: it focuses the dashboard on that campaign.
 */
import { Box, Flex, Text, Tooltip } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { compact, daysBetween, money, nf } from "./data";
import type { Data } from "./types";
import { DataTable, Label, MONO, Panel, T } from "./ui";
import type { Column } from "./ui";

interface Row {
  id: string; name: string; mediaType: string; color: string; media: string;
  start: string; end: string; days: number;
  impressions: number; clicks: number; conversions: number; spend: number;
  cpm: number; cpc: number; cpa: number;
}

const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

export default function Lifetime({ data, focused, onFocus }: {
  data: Data;
  focused: string[];
  onFocus: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const rows: Row[] = useMemo(() => {
    const acc: Record<string, { impressions: number; clicks: number; conversions: number; spend: number }> = {};
    for (const c of data.campaigns) acc[c.id] = { impressions: 0, clicks: 0, conversions: 0, spend: 0 };
    for (const r of data.daily) {
      const a = acc[r.campaign];
      a.impressions += r.impressions; a.clicks += r.clicks;
      a.conversions += r.conversions; a.spend += r.spend;
    }
    return data.campaigns.map((c) => {
      const a = acc[c.id];
      const m = data.mediaTypes.find((x) => x.key === c.mediaType)!;
      return {
        id: c.id, name: c.name, mediaType: c.mediaType, color: m.color, media: m.label,
        start: c.flightStart, end: c.flightEnd,
        days: daysBetween(c.flightStart, c.flightEnd),
        ...a,
        cpm: a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0,
        cpc: a.clicks > 0 ? a.spend / a.clicks : 0,
        cpa: a.conversions > 0 ? a.spend / a.conversions : 0,
      };
    });
  }, [data]);

  const totals = rows.reduce((s, r) => ({
    impressions: s.impressions + r.impressions, clicks: s.clicks + r.clicks,
    conversions: s.conversions + r.conversions, spend: s.spend + r.spend,
  }), { impressions: 0, clicks: 0, conversions: 0, spend: 0 });

  /* Conditional fill on cost per conversion. Cheapest is strongest, because on
     a cost column lower is better. It varies by intensity within one column
     rather than by hue, so it stays readable for every viewer, and the figure
     is printed on top either way. */
  const costs = rows.map((r) => r.cpa).filter((n) => n > 0);
  const lo = Math.min(...costs), hi = Math.max(...costs);
  const fill = (v: number) => {
    if (!v) return "transparent";
    const t = hi > lo ? (hi - v) / (hi - lo) : 1;      // 1 = cheapest
    return `rgba(63, 185, 80, ${(0.10 + t * 0.42).toFixed(3)})`;
  };

  const tiles = [
    { label: "Campaigns", value: nf(data.campaigns.length) },
    { label: "Impressions", value: compact(totals.impressions) },
    { label: "Conversions", value: nf(totals.conversions) },
    { label: "Spend", value: money(totals.spend) },
  ];

  const cols: Column<Row>[] = [
    { key: "name", label: "Campaign name", sort: (r) => r.name, width: "230px",
      render: (r) => (
        <Tooltip hasArrow placement="top" openDelay={120} bg={T.raised} color={T.ink}
          border="1px solid" borderColor={T.line} borderRadius="6px" px={3} py={2}
          fontSize="11.5px" fontWeight={400}
          label={
            <Box>
              <Text fontFamily={MONO} fontSize="11px" color={T.muted}>Lifetime</Text>
              <Text fontFamily={MONO}>{shortDay(r.start)} — {shortDay(r.end)}</Text>
              <Text fontFamily={MONO} color={T.dim}>{r.days} days · {r.media}</Text>
            </Box>
          }>
          <Flex align="center" gap={2} display="inline-flex">
            <Box w="8px" h="8px" borderRadius="2px" bg={r.color} flex="0 0 auto" />
            <Text as="span" borderBottom="1px dotted" borderColor={T.dim}>{r.name}</Text>
          </Flex>
        </Tooltip>
      ) },
    { key: "start", label: "Start", sort: (r) => r.start, width: "104px",
      render: (r) => <Text as="span" fontFamily={MONO} fontSize="11.5px">{shortDay(r.start)}</Text> },
    { key: "end", label: "End", sort: (r) => r.end, width: "104px",
      render: (r) => <Text as="span" fontFamily={MONO} fontSize="11.5px">{shortDay(r.end)}</Text> },
    { key: "impressions", label: "Impressions", align: "right", numeric: true,
      sort: (r) => r.impressions, render: (r) => nf(r.impressions) },
    { key: "clicks", label: "Clicks", align: "right", numeric: true,
      sort: (r) => r.clicks, render: (r) => nf(r.clicks) },
    { key: "conversions", label: "Conversions", align: "right", numeric: true,
      sort: (r) => r.conversions, render: (r) => nf(r.conversions) },
    { key: "spend", label: "Spend", align: "right", numeric: true,
      sort: (r) => r.spend, render: (r) => money(r.spend) },
    { key: "cpm", label: "CP mille", align: "right", numeric: true,
      sort: (r) => r.cpm, render: (r) => money(r.cpm, 2) },
    { key: "cpc", label: "CP click", align: "right", numeric: true,
      sort: (r) => r.cpc, render: (r) => money(r.cpc, 2) },
    { key: "cpa", label: "CP conversion", align: "right", numeric: true,
      sort: (r) => r.cpa, width: "132px",
      render: (r) => (
        <Box as="span" display="inline-block" bg={fill(r.cpa)} borderRadius="3px"
          px={2} py="2px" minW="76px" textAlign="right">
          {r.cpa > 0 ? money(r.cpa, 2) : "—"}
        </Box>
      ) },
  ];

  return (
    <>
      <Flex gap={{ base: 4, md: 5 }} wrap="wrap" pt={1}>
        {tiles.map((t) => (
          <Box key={t.label} as="button" type="button" aria-expanded={open}
            aria-label={`Lifetime ${t.label}. Opens the campaign table.`}
            onClick={() => setOpen((o) => !o)}
            textAlign={{ base: "left", sm: "right" }} px={2} py={1.5} borderRadius="6px"
            border="1px solid" borderColor={open ? T.focus : "transparent"}
            bg={open ? T.raised : "transparent"}
            _hover={{ bg: open ? T.raised : T.surface }}
            _focusVisible={{ outline: "2px solid", outlineColor: T.focus, outlineOffset: "1px" }}
            transition="all .12s">
            <Label as="div" mb="3px" color={open ? T.muted : T.dim}>Lifetime {t.label}</Label>
            <Text fontFamily={MONO} fontSize="16px" fontWeight={600} color={T.ink}
              sx={{ fontVariantNumeric: "tabular-nums" }}>{t.value}</Text>
          </Box>
        ))}
      </Flex>

      {open && (
        <Box mt={5}>
          <Panel
            title="All campaigns, lifetime"
            right={
              <Text fontFamily={MONO} fontSize="10.5px" color={T.dim}>
                click a row to focus the dashboard
              </Text>
            }>
            <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} minW="1080px"
              initialSort={{ key: "spend", dir: "desc" }}
              onRowClick={(r) => onFocus(r.id)}
              isOpen={(r) => focused.includes(r.id)} />
          </Panel>
        </Box>
      )}
    </>
  );
}
