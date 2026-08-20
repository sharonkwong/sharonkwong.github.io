import { Box, Grid, HStack, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { compact, money, nf, shortDate } from "./data";
import { allocate, marginalAt } from "./model";
import type { CampaignData, Channel, ChannelKey } from "./types";
import { BarRow, ChartTip, INK, Kpi, KpiRow, MUTED, Panel, RULE, SectionHead } from "./ui";

const KEYS: ChannelKey[] = ["display", "video", "email"];

export default function Dashboard({
  data, channel, setChannel,
}: {
  data: CampaignData;
  channel: ChannelKey | null;
  setChannel: (c: ChannelKey | null) => void;
}) {
  const { channels, constants, totals, offline: off } = data;
  const byKey = useMemo(
    () => Object.fromEntries(channels.map((c) => [c.key, c])) as Record<ChannelKey, Channel>,
    [channels]
  );
  const dim = (k: ChannelKey) => Boolean(channel && channel !== k);

  const [budget, setBudget] = useState(Math.round(totals.spend.current));

  /* ------------------------------------------------------------- model */
  const curves = useMemo(
    () => Object.fromEntries(channels.map((c) =>
      [c.key, { K: c.halfSaturationSpend, Cmax: c.maxConversions }]
    )) as Record<ChannelKey, { K: number; Cmax: number }>,
    [channels]
  );
  /* With no view of the advertiser's margins there is no "what a conversion is
     worth" ceiling to price against. What is left is the budget itself: spread it
     until one more conversion costs the same everywhere, and no dollar is sitting
     somewhere it buys less than it would next door. */
  const plan = useMemo(() => allocate(
    channels.map((c) => ({
      key: c.key, spend: c.spend, curve: curves[c.key],
      cap: c.key === "email" ? { value: constants.emailSpendCap, reason: "list-burn cap" } : undefined,
    })), Number.POSITIVE_INFINITY, budget
  ), [channels, curves, budget, constants.emailSpendCap]);
  const planConv = plan.rows.reduce((s, r) => s + r.proposedConversions, 0);
  const nowConv = plan.rows.reduce((s, r) => s + r.currentConversions, 0);

  /* --------------------------------------------------------- kpi deltas */
  const d = (cur: number, prv: number) => (prv > 0 ? (cur / prv - 1) * 100 : 0);
  const T = totals;
  const rate = (a: { current: number; prior: number }, b: { current: number; prior: number }) =>
    ({ current: a.current / b.current, prior: a.prior / b.prior });
  const ctr = rate(T.clicks, T.impressions);
  const cpa = rate(T.spend, T.conversions);
  const cpc = rate(T.spend, T.clicks);
  const causedConv = channels.reduce((s, c) => s + c.lift.incremental, 0);
  const cpm = { current: (T.spend.current / T.impressions.current) * 1000,
                prior: (T.spend.prior / T.impressions.prior) * 1000 };

  /* ------------------------------------------------------- daily series */
  const recent = data.daily.slice(-data.meta.window);
  const series = (field: "spend" | "conversions" | "impressions" | "clicks") =>
    recent.map((row) => {
      const o: Record<string, number | string> = { date: row.date };
      KEYS.forEach((k) => { o[k] = row[k][field]; });
      o.total = KEYS.reduce((s, k) => s + row[k][field], 0);
      return o;
    });
  /* The marginal curves, sampled once. The axis is derived from these points so it
     can never drift out of step with the data the way a hardcoded domain does. */
  const SPAN = { lo: 0.15, hi: 1.85, step: 0.05 };
  const curvePoints = useMemo(() => {
    const out: Record<ChannelKey, { x: number; y: number; spend: number; key: ChannelKey }[]> =
      { display: [], video: [], email: [] };
    KEYS.forEach((k) => {
      const c = byKey[k];
      for (let m = SPAN.lo; m <= SPAN.hi + 1e-9; m += SPAN.step) {
        const s = c.spend * m;
        out[k].push({ x: +m.toFixed(2), y: marginalAt(curves[k], s), spend: s, key: k });
      }
    });
    return out;
  }, [byKey, curves]);

  const yAxis = useMemo(() => {
    const peak = Math.max(
      ...KEYS.flatMap((k) => curvePoints[k].map((p) => p.y)),
      plan.effectiveCeiling
    );
    // Five gridlines on a round step that clears the peak.
    const raw = peak / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
    const top = step * 4;
    return { top, ticks: [0, 1, 2, 3, 4].map((i) => i * step) };
  }, [curvePoints, plan.effectiveCeiling]);

  const cpaSeries = recent.map((row) => {
    const o: Record<string, number | string> = { date: row.date };
    KEYS.forEach((k) => { o[k] = row[k].conversions > 0 ? row[k].spend / row[k].conversions : 0; });
    return o;
  });

  return (
    <>
      {/* ============ KPI GRID ============ */}
      <KpiRow>
        <Kpi label="Spend" value={money(T.spend.current)} delta={d(T.spend.current, T.spend.prior)} lowerIsBetter
          tip="What the shop paid for advertising over the last 30 days, across all three channels. Measured — this comes straight off the invoices."
          extras={[{ label: "Per day", value: money(T.spend.current / data.meta.window),
                     tip: "Spend ÷ 30. Derived. Useful because media is bought monthly but the shop trades daily." }]} />
        <Kpi label="Impressions" value={compact(T.impressions.current)} delta={d(T.impressions.current, T.impressions.prior)}
          tip="How many times an ad was shown. For email this counts emails that landed in an inbox. Measured."
          extras={[{ label: "Cost per 1,000", value: money(cpm.current, 2),
                     delta: d(cpm.current, cpm.prior), lowerIsBetter: true,
                     tip: "Spend ÷ impressions × 1,000 — the industry calls this CPM. Derived. It is the price of the media itself, before any question of whether it worked." }]} />
        <Kpi label="Clicks" value={nf(T.clicks.current)} delta={d(T.clicks.current, T.clicks.prior)}
          tip="How many times someone clicked an ad or a link in an email. Measured. Worth knowing: clicks are not comparable across channels — an email goes to people who already asked to hear from us, a display ad does not, and video mostly converts people who never click at all."
          extras={[
            { label: "Click rate", value: `${(ctr.current * 100).toFixed(2)}%`,
              delta: d(ctr.current, ctr.prior),
              tip: "Clicks ÷ impressions. Derived. Tells you whether the creative is getting attention, not whether it sold any pizza." },
            { label: "Cost per click", value: money(cpc.current, 2),
              delta: d(cpc.current, cpc.prior), lowerIsBetter: true,
              tip: "Spend ÷ clicks. Derived." },
          ]} />
        <Kpi label="Cost per conversion" value={money(cpa.current, 2)} delta={d(cpa.current, cpa.prior)} lowerIsBetter
          tip="Spend ÷ total conversions, online and in-store together. Derived. It is the average across every conversion — the next one always costs more than the average, which is what the panel further down works out." />

        <Kpi label="Online conversions" value={nf(T.onlineConversions.current)}
          delta={d(T.onlineConversions.current, T.onlineConversions.prior)}
          sub={`${((T.onlineConversions.current / T.conversions.current) * 100).toFixed(0)}% of all conversions`}
          tip="Orders placed on the website or app, credited to the last ad the customer saw beforehand. Measured directly: the ordering system fires a pixel, and we match it back to the impression." />
        <Kpi label="Offline conversions" value={nf(T.offlineConversions.current)}
          delta={d(T.offlineConversions.current, T.offlineConversions.prior)}
          sub={`${off.radiusM}m geofence · ${off.windowDays}-day window`}
          tip={`A visit to one of the shops that we can tie back to an ad. The impression carries a household IP. A third-party location vendor sends us device IDs seen inside a ${off.radiusM}-metre geofence around each shop, along with the IPs those devices used — and where the two IPs match within ${off.windowDays} days, the visit is credited. Derived, and the softest number on this page: only about ${Math.round(off.matchRate * 100)}% of impressions resolve to a device we can follow, so it is a floor, not a count.`} />
        <Kpi label="Total conversions" value={nf(T.conversions.current)}
          delta={d(T.conversions.current, T.conversions.prior)}
          sub={`${((T.offlineConversions.current / T.conversions.current) * 100).toFixed(0)}% of them in-store`}
          tip="Online plus offline. Derived. This is the number the cost figures and the budget model both run on — a pizza shop that only counted online orders would be measuring the smaller half of its own business." />
        <Kpi label="Conversions the ads caused" value={nf(causedConv)}
          sub={`${((causedConv / T.conversions.current) * 100).toFixed(0)}% of the ${nf(T.conversions.current)} credited`}
          tip="Adds up each channel's control-group test: conversions among people who saw the ads, minus what the matched control did anyway. Derived, and the only number here that says the advertising was responsible. It has no period-on-period change because a lift test is a study with a fixed window, not a daily metric." />
      </KpiRow>
      <Text fontSize="11.5px" color={MUTED} mt={2} fontFamily="mono">
        Change is against the previous {data.meta.window} days.
      </Text>

      {/* ============ DAILY TRENDS ============ */}
      <Box mt={10}>
        <SectionHead title="Daily trend" sub={`Last ${data.meta.window} days, by channel.`} />
        <HStack spacing={4} mb={3} wrap="wrap">
          {channels.map((c) => (
            <HStack key={c.key} spacing={1.5} cursor="pointer"
              onClick={() => setChannel(channel === c.key ? null : c.key)}
              opacity={dim(c.key) ? 0.4 : 1}>
              <Box w="10px" h="10px" borderRadius="2px" bg={c.color} />
              <Text fontSize="12.5px" color="gray.600">{c.label}</Text>
            </HStack>
          ))}
          {channel && (
            <Text as="button" fontSize="12px" fontFamily="mono" color="blue.500"
              textDecoration="underline" onClick={() => setChannel(null)}>clear</Text>
          )}
        </HStack>
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
          <TrendCard title="Spend" data={series("spend")} channels={channels} dim={dim}
            fmt={(v) => money(v)} area />
          <TrendCard title="Conversions" data={series("conversions")} channels={channels} dim={dim}
            fmt={(v) => nf(v)} area />
          <TrendCard title="Cost per conversion" data={cpaSeries} channels={channels} dim={dim}
            fmt={(v) => money(v, 2)} />
          <TrendCard title="Impressions" data={series("impressions")} channels={channels} dim={dim}
            fmt={(v) => compact(v)} area />
        </Grid>
      </Box>

      {/* ============ BY CHANNEL ============ */}
      <Box mt={10}>
        <SectionHead title="By channel"
          sub="Click a bar to filter the whole page. Cheapest today is not the same as room to grow — the panel on the right is the one that should decide the budget." />
        <Grid templateColumns={{ base: "1fr", lg: "1fr 1.3fr" }} gap={4} alignItems="start">
          <Panel title="Cost per conversion" sub="Lower is better. Online and in-store together.">
            <Box display="flex" flexDirection="column" gap={2.5}>
              {[...channels].sort((a, b) => a.cpa - b.cpa).map((c) => (
                <BarRow key={c.key} label={c.label} value={c.cpa}
                  max={Math.max(...channels.map((x) => x.cpa))} color={c.color}
                  display={money(c.cpa, 2)} sub={`${nf(c.conversions)} conv`}
                  dim={dim(c.key)} onClick={() => setChannel(channel === c.key ? null : c.key)} />
              ))}
            </Box>
            <Box mt={5}>
              <Text fontSize="12px" fontWeight={700} color={INK} mb={2}>Share of spend vs conversions</Text>
              <Stack label="Spend" parts={channels.map((c) => ({ k: c.key, v: c.spend, color: c.color, dim: dim(c.key) }))} />
              <Box h={2} />
              <Stack label="Conversions" parts={channels.map((c) => ({ k: c.key, v: c.conversions, color: c.color, dim: dim(c.key) }))} />
            </Box>
            <Box mt={5} pt={4} borderTop="1px solid" borderColor={RULE}>
              <Text fontSize="12px" fontWeight={700} color={INK} mb={1}>Online vs in-store</Text>
              <Text fontSize="11.5px" color={MUTED} mb={3} lineHeight={1.5}>
                Counting online only, display looks cheaper than video ({money(byKey.display.onlineCpa, 2)}{" "}
                against {money(byKey.video.onlineCpa, 2)}). Counting store visits too, it is the
                other way round ({money(byKey.display.cpa, 2)} against {money(byKey.video.cpa, 2)}).
              </Text>
              <Box display="flex" flexDirection="column" gap={2.5}>
                {channels.map((c) => (
                  <Box key={c.key} opacity={dim(c.key) ? 0.35 : 1} transition="opacity .2s">
                    <HStack justify="space-between" mb="4px">
                      <Text fontSize="12px" color="gray.600">{c.label}</Text>
                      <Text fontFamily="mono" fontSize="10.5px" color={MUTED}>
                        {(c.offlineShare * 100).toFixed(0)}% in-store
                      </Text>
                    </HStack>
                    <Box display="flex" h="18px" borderRadius="4px" overflow="hidden" gap="2px">
                      <Box flex={`0 0 ${(1 - c.offlineShare) * 100}%`} bg={c.color} minW={0} />
                      <Box flex="1" bg={c.color} opacity={0.3} minW={0} />
                    </Box>
                  </Box>
                ))}
              </Box>
              <HStack spacing={4} mt={3} wrap="wrap">
                <HStack spacing={1.5}>
                  <Box w="10px" h="10px" borderRadius="2px" bg="gray.500" />
                  <Text fontSize="11px" color={MUTED}>Online</Text>
                </HStack>
                <HStack spacing={1.5}>
                  <Box w="10px" h="10px" borderRadius="2px" bg="gray.500" opacity={0.3} />
                  <Text fontSize="11px" color={MUTED}>In-store, matched</Text>
                </HStack>
              </HStack>
            </Box>
          </Panel>

          <Panel
            title="What would one more conversion cost?"
            sub="Every channel gets more expensive the more you spend on it. Move money until the next conversion costs the same everywhere — that is the point where a fixed budget is working as hard as it can."
            right={
              <NumIn label="Monthly budget" prefix="$" value={budget} step={1000} onChange={setBudget} width="74px" />
            }
          >
            <Text fontSize="12px" color={MUTED} mb={3}>
              At {money(budget)} the next conversion prices out at{" "}
              <strong>{money(plan.effectiveCeiling, 2)}</strong> across the board. Anything whose
              line sits above that is being over-bought; anything below it is being starved.{" "}
              {budget !== Math.round(totals.spend.current) && (
                <Text as="span" color="orange.600" fontWeight={600}>
                  (Editing the budget re-solves everything below.)
                </Text>
              )}
            </Text>
            <Box h="230px">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={{ top: 10, right: 16, bottom: 22, left: 0 }}>
                  <CartesianGrid stroke="#eceef1" vertical={false} />
                  <XAxis type="number" dataKey="x" domain={[0.15, 1.85]}
                    ticks={[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75]}
                    tickFormatter={(v: number) => `${v}x`}
                    tick={{ fontSize: 10, fill: "#8a8f98", fontFamily: "monospace" }} stroke="#c9ced6"
                    label={{ value: "spend vs today", position: "insideBottom", offset: -12,
                      style: { fontSize: 10, fill: "#8a8f98", fontFamily: "monospace" } }} />
                  <YAxis domain={[0, yAxis.top]} ticks={yAxis.ticks} allowDataOverflow
                    tickFormatter={(v: number) => `$${v}`}
                    tick={{ fontSize: 10, fill: "#8a8f98", fontFamily: "monospace" }}
                    stroke="#c9ced6" width={42} />
                  <ReferenceLine y={plan.effectiveCeiling} stroke="#d03b3b" strokeDasharray="5 3"
                    label={{ value: `${money(plan.effectiveCeiling, 2)} everywhere`, position: "insideTopLeft",
                      style: { fontSize: 10, fill: "#d03b3b", fontWeight: 700, fontFamily: "monospace" } }} />
                  <ReferenceLine x={1} stroke="#c9ced6"
                    label={{ value: "today", position: "top",
                      style: { fontSize: 10, fill: "#4a4e57", fontWeight: 700, fontFamily: "monospace" } }} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as { key: ChannelKey; x: number; y: number; spend: number };
                    const over = p.y > plan.effectiveCeiling;
                    return <ChartTip title={byKey[p.key].label}
                      rows={[{ label: `at ${money(p.spend)} spend`, value: money(p.y, 2) }]}
                      footer={<Text as="span" color={over ? "red.500" : "green.600"} fontWeight={600}>
                        {over ? "dearer than elsewhere — buy less" : "cheaper than elsewhere — buy more"}
                      </Text>} />;
                  }} />
                  {KEYS.map((k) => {
                    const c = byKey[k];
                    return <Line key={k} data={curvePoints[k]} dataKey="y" type="monotone" stroke={c.color}
                      strokeWidth={dim(k) ? 1.5 : 2.5} strokeOpacity={dim(k) ? 0.3 : 1}
                      dot={(p: { cx?: number; cy?: number; payload?: { x: number } }) =>
                        p.payload?.x === 1
                          ? <circle key={`${k}-now`} cx={p.cx} cy={p.cy} r={5} fill={c.color}
                              stroke="#fff" strokeWidth={2} opacity={dim(k) ? 0.3 : 1} />
                          : <g key={`${k}-${p.cx}`} />}
                      activeDot={{ r: 5 }} isAnimationActive={false} />;
                  })}
                </LineChart>
              </ResponsiveContainer>
            </Box>

            <Box mt={4} pt={4} borderTop="1px solid" borderColor={RULE}>
              <Text fontSize="12px" fontWeight={700} color={INK} mb={3}>
                Suggested move — {money(budget)} budget
              </Text>
              <Box display="grid" gridTemplateColumns={{ base: "1fr", sm: "repeat(3, 1fr)" }} gap={3}>
                {plan.rows.map((r) => {
                  const c = byKey[r.key as ChannelKey];
                  const up = r.delta > 0;
                  return (
                    <Box key={r.key} borderTop="2px solid" borderColor={c.color} pt={2}>
                      <Text fontSize="12.5px" fontWeight={700} color={INK}>{c.label}</Text>
                      <Text fontFamily="mono" fontSize="15px" fontWeight={700}
                        color={up ? "green.600" : "red.500"}>
                        {up ? "+" : "−"}{money(Math.abs(r.delta))}
                      </Text>
                      <Text fontSize="11px" color={MUTED} fontFamily="mono">
                        {money(r.current)} → {money(r.proposed)}
                      </Text>
                      <Text fontSize="11px" color={MUTED} mt="2px" lineHeight={1.4}>
                        {r.cappedBy ? "Held by the list-burn cap." : `Next conversion costs ${money(r.marginalNow, 2)} today.`}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
              <HStack spacing={6} mt={4} wrap="wrap">
                <Box>
                  <Text fontFamily="mono" fontSize="9px" letterSpacing="0.11em" textTransform="uppercase" color={MUTED}>Conversions</Text>
                  <Text fontFamily="mono" fontSize="16px" fontWeight={700} color="green.600">
                    {nf(nowConv)} → {nf(planConv)}
                  </Text>
                </Box>
                <Box>
                  <Text fontFamily="mono" fontSize="9px" letterSpacing="0.11em" textTransform="uppercase" color={MUTED}>Cost per conversion</Text>
                  <Text fontFamily="mono" fontSize="16px" fontWeight={700} color="green.600">
                    {money(budget / nowConv, 2)} → {money(budget / planConv, 2)}
                  </Text>
                </Box>
              </HStack>
            </Box>
          </Panel>
        </Grid>

        {/* ---- lift ---- */}
        <Box mt={4}>
          <Panel
            title="How many of these conversions did the ads actually cause?"
            sub="A control group was deliberately kept away from each channel's ads. The gap between how often people who saw the ads converted and how often the control converted is what the advertising caused. The rest was going to happen anyway."
          >
            <Box display="flex" flexDirection="column" gap={4}>
              {channels.map((c) => {
                const L = c.lift;
                const maxConv = Math.max(...channels.map((x) => x.conversions));
                const w = (c.conversions / maxConv) * 100;
                const causedPct = L.incrementality * 100;
                return (
                  <Box key={c.key} opacity={dim(c.key) ? 0.35 : 1} transition="opacity .2s">
                    <HStack justify="space-between" mb={1.5} align="baseline" wrap="wrap" gap={2}>
                      <HStack spacing={2}>
                        <Box w="9px" h="9px" borderRadius="2px" bg={c.color} />
                        <Text fontSize="13.5px" fontWeight={700} color={INK}>{c.label}</Text>
                        <Text fontFamily="mono" fontSize="11.5px" color={MUTED}>
                          {nf(c.conversions)} conversions credited
                        </Text>
                      </HStack>
                      <Text fontFamily="mono" fontSize="11.5px" color={MUTED}>
                        exposed {(L.exposedRate * 100).toFixed(3)}% vs control{" "}
                        {(L.controlRate * 100).toFixed(3)}%
                      </Text>
                    </HStack>
                    <Box display="flex" h="26px" w={`${w}%`} minW="120px" borderRadius="4px"
                      overflow="hidden" gap="2px">
                      <Box flex={`0 0 ${causedPct}%`} bg={c.color} display="flex"
                        alignItems="center" justifyContent="center" minW={0}
                        fontFamily="mono" fontSize="10.5px" fontWeight={700} color="white">
                        {causedPct > 14 ? `${causedPct.toFixed(0)}%` : ""}
                      </Box>
                      <Box flex="1" bg="gray.200" minW={0} />
                    </Box>
                    <HStack spacing={4} mt={1.5} wrap="wrap">
                      <Text fontFamily="mono" fontSize="11.5px" color={INK} fontWeight={700}>
                        {nf(L.incremental)} caused by the ads
                      </Text>
                      <Text fontFamily="mono" fontSize="11.5px" color={MUTED}>
                        {nf(L.baseline)} would have happened anyway
                      </Text>
                      <Text fontSize="11.5px" color={MUTED}>{L.why}</Text>
                    </HStack>
                  </Box>
                );
              })}
            </Box>

            <Box mt={5} pt={4} borderTop="1px solid" borderColor={RULE}>
              <HStack spacing={5} wrap="wrap" mb={3}>
                <HStack spacing={2}>
                  <Box w="11px" h="11px" borderRadius="2px" bg="gray.600" />
                  <Text fontSize="12px" color="gray.600">Caused by the ads</Text>
                </HStack>
                <HStack spacing={2}>
                  <Box w="11px" h="11px" borderRadius="2px" bg="gray.200" />
                  <Text fontSize="12px" color="gray.600">Would have happened anyway</Text>
                </HStack>
              </HStack>
              <Text fontSize="13.5px" color="gray.700" lineHeight={1.6} maxW="82ch">
                <strong>Email looks like the best channel, and it is mostly taking credit.</strong>{" "}
                People on the list who were kept out of the sends still converted{" "}
                {(byKey.email.lift.controlRate * 100).toFixed(2)}% of the time, against{" "}
                {(byKey.email.lift.exposedRate * 100).toFixed(2)}% for people who got them — so{" "}
                {nf(byKey.email.lift.baseline)} of its {nf(byKey.email.conversions)} conversions were
                regulars buying pizza the way they always do. Online video is the reverse: its
                control group barely converted at all, so nearly everything it gets credit for, it
                earned.
              </Text>
            </Box>
          </Panel>
        </Box>
      </Box>
    </>
  );
}

/* ------------------------------------------------------------- trend card */
function TrendCard({
  title, data, channels, dim, fmt, area,
}: {
  title: string;
  data: Record<string, number | string>[];
  channels: Channel[];
  dim: (k: ChannelKey) => boolean;
  fmt: (v: number) => string;
  area?: boolean;
}) {
  const Chart = area ? AreaChart : LineChart;
  return (
    <Panel title={title}>
      <Box h="180px">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#eceef1" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} interval={9}
              tick={{ fontSize: 9.5, fill: "#8a8f98", fontFamily: "monospace" }} stroke="#c9ced6" />
            <YAxis tickFormatter={fmt} width={50}
              tick={{ fontSize: 9.5, fill: "#8a8f98", fontFamily: "monospace" }} stroke="#c9ced6" />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return <ChartTip title={shortDate(String(label))}
                rows={payload.map((p) => ({
                  label: channels.find((c) => c.key === p.dataKey)?.label ?? String(p.dataKey),
                  value: fmt(Number(p.value)),
                  color: String(p.stroke ?? p.fill),
                }))} />;
            }} />
            {channels.map((c) => area ? (
              <Area key={c.key} dataKey={c.key} type="monotone" stackId="1"
                stroke={c.color} fill={c.color} fillOpacity={dim(c.key) ? 0.08 : 0.18}
                strokeOpacity={dim(c.key) ? 0.25 : 1} strokeWidth={1.5} isAnimationActive={false} />
            ) : (
              <Line key={c.key} dataKey={c.key} type="monotone" stroke={c.color}
                strokeWidth={dim(c.key) ? 1 : 1.8} strokeOpacity={dim(c.key) ? 0.25 : 1}
                dot={false} activeDot={{ r: 3.5 }} isAnimationActive={false} />
            ))}
          </Chart>
        </ResponsiveContainer>
      </Box>
    </Panel>
  );
}

/* ------------------------------------------------------------ share stack */
function Stack({ label, parts }: {
  label: string; parts: { k: string; v: number; color: string; dim: boolean }[];
}) {
  const sum = parts.reduce((s, p) => s + p.v, 0);
  return (
    <Box>
      <Text fontFamily="mono" fontSize="9.5px" letterSpacing="0.1em" textTransform="uppercase"
        color={MUTED} mb="4px">{label}</Text>
      <Box display="flex" h="22px" borderRadius="4px" overflow="hidden" gap="2px" bg="gray.100">
        {parts.map((p) => {
          const share = (p.v / sum) * 100;
          return (
            <Box key={p.k} display="flex" alignItems="center" justifyContent="center"
              bg={p.color} opacity={p.dim ? 0.35 : 1} flex={`0 0 ${share}%`} minW={0}
              transition="opacity .2s" fontFamily="mono" fontSize="10px" fontWeight={700} color="white">
              {share > 10 ? `${share.toFixed(0)}%` : ""}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/* ---------------------------------------------------------- number input */
function NumIn({ label, value, onChange, step, prefix, suffix, width }: {
  label: string; value: number; onChange: (v: number) => void;
  step: number; prefix?: string; suffix?: string; width?: string;
}) {
  return (
    <Box>
      <Text fontFamily="mono" fontSize="9px" letterSpacing="0.11em" textTransform="uppercase"
        color={MUTED} fontWeight={600} mb="3px">{label}</Text>
      <HStack spacing={0} border="1px solid" borderColor={RULE} borderRadius="6px"
        bg="white" px={2} py="3px">
        {prefix && <Text fontFamily="mono" fontSize="12px" color={MUTED}>{prefix}</Text>}
        <Box as="input" type="number" value={value} step={step} min={0}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v > 0) onChange(v);
          }}
          w={width ?? (suffix ? "42px" : "56px")} border="none" outline="none" bg="transparent"
          fontFamily="mono" fontSize="13px" fontWeight={700} color={INK} />
        {suffix && <Text fontFamily="mono" fontSize="12px" color={MUTED}>{suffix}</Text>}
      </HStack>
    </Box>
  );
}
