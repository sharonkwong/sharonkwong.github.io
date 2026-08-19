import { Box, Grid, HStack, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { compact, money, nf, shortDate } from "./data";
import { allocate, marginalAt, valueCeiling } from "./model";
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
  const { channels, constants, totals, reach } = data;
  const byKey = useMemo(
    () => Object.fromEntries(channels.map((c) => [c.key, c])) as Record<ChannelKey, Channel>,
    [channels]
  );
  const dim = (k: ChannelKey) => Boolean(channel && channel !== k);

  const [leadValue, setLeadValue] = useState(constants.leadValue);
  const [targetReturn, setTargetReturn] = useState(constants.targetReturn);

  /* ------------------------------------------------------------- model */
  const curves = useMemo(
    () => Object.fromEntries(channels.map((c) =>
      [c.key, { K: c.halfSaturationSpend, Cmax: c.maxConversions }]
    )) as Record<ChannelKey, { K: number; Cmax: number }>,
    [channels]
  );
  const budget = totals.spend.current;
  const vCeil = valueCeiling(leadValue, targetReturn);
  const plan = useMemo(() => allocate(
    channels.map((c) => ({
      key: c.key, spend: c.spend, curve: curves[c.key],
      cap: c.key === "email" ? { value: constants.emailSpendCap, reason: "list-burn cap" } : undefined,
    })), vCeil, budget
  ), [channels, curves, vCeil, budget, constants.emailSpendCap]);
  const planConv = plan.rows.reduce((s, r) => s + r.proposedConversions, 0);
  const nowConv = plan.rows.reduce((s, r) => s + r.currentConversions, 0);
  const budgetBinds = plan.effectiveCeiling < vCeil - 0.01;

  /* --------------------------------------------------------- kpi deltas */
  const d = (cur: number, prv: number) => (prv > 0 ? (cur / prv - 1) * 100 : 0);
  const T = totals;
  const rate = (a: { current: number; prior: number }, b: { current: number; prior: number }) =>
    ({ current: a.current / b.current, prior: a.prior / b.prior });
  const ctr = rate(T.clicks, T.impressions);
  const cpa = rate(T.spend, T.conversions);
  const cvr = rate(T.conversions, T.clicks);
  const cpc = rate(T.spend, T.clicks);
  const cpm = { current: (T.spend.current / T.impressions.current) * 1000,
                prior: (T.spend.prior / T.impressions.prior) * 1000 };
  const roas = { current: (T.conversions.current * leadValue) / T.spend.current,
                 prior: (T.conversions.prior * leadValue) / T.spend.prior };
  const blendedMarginal = plan.rows.reduce((s, r) => s + r.marginalNow * r.current, 0) / budget;

  /* ------------------------------------------------------- daily series */
  const recent = data.daily.slice(-data.meta.window);
  const series = (field: "spend" | "conversions" | "impressions" | "clicks") =>
    recent.map((row) => {
      const o: Record<string, number | string> = { date: row.date };
      KEYS.forEach((k) => { o[k] = row[k][field]; });
      o.total = KEYS.reduce((s, k) => s + row[k][field], 0);
      return o;
    });
  const cpaSeries = recent.map((row) => {
    const o: Record<string, number | string> = { date: row.date };
    KEYS.forEach((k) => { o[k] = row[k].conversions > 0 ? row[k].spend / row[k].conversions : 0; });
    return o;
  });

  return (
    <>
      {/* ============ KPI GRID ============ */}
      <KpiRow>
        <Kpi label="Spend" value={money(T.spend.current)} delta={d(T.spend.current, T.spend.prior)} lowerIsBetter />
        <Kpi label="Impressions" value={compact(T.impressions.current)} delta={d(T.impressions.current, T.impressions.prior)} />
        <Kpi label="Clicks" value={nf(T.clicks.current)} delta={d(T.clicks.current, T.clicks.prior)} />
        <Kpi label="Conversions" value={nf(T.conversions.current)} delta={d(T.conversions.current, T.conversions.prior)} />
        <Kpi label="Cost per conversion" value={money(cpa.current, 2)} delta={d(cpa.current, cpa.prior)} lowerIsBetter />
        <Kpi label="Cost of next conversion" value={money(blendedMarginal)} sub="what one more would cost" />
        <Kpi label="Click-through rate" value={`${(ctr.current * 100).toFixed(2)}%`} delta={d(ctr.current, ctr.prior)} />
        <Kpi label="Conversion rate" value={`${(cvr.current * 100).toFixed(1)}%`} delta={d(cvr.current, cvr.prior)} />
        <Kpi label="CPM" value={money(cpm.current, 2)} delta={d(cpm.current, cpm.prior)} lowerIsBetter />
        <Kpi label="Cost per click" value={money(cpc.current, 2)} delta={d(cpc.current, cpc.prior)} lowerIsBetter />
        <Kpi label="Return on ad spend" value={`${roas.current.toFixed(2)}x`} delta={d(roas.current, roas.prior)} />
        <Kpi label="Households reached"
          value={`${compact(reach.dedupedLow)}–${compact(reach.dedupedHigh)}`}
          sub="modelled range" />
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
          sub="Click a bar to filter the page. Cheapest today is not the same as room to grow — the panel on the right is the one that decides budget." />
        <Grid templateColumns={{ base: "1fr", lg: "1fr 1.3fr" }} gap={4} alignItems="start">
          <Panel title="Cost per conversion" sub="Lower is better.">
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
          </Panel>

          <Panel
            title="What would one more conversion cost?"
            sub="Every channel gets more expensive as you spend more. Above the red line it stops being worth buying."
            right={
              <HStack spacing={3} wrap="wrap">
                <NumIn label="Lead worth" prefix="$" value={leadValue} step={10} onChange={setLeadValue} />
                <NumIn label="Return needed" suffix="x" value={targetReturn} step={0.25} onChange={setTargetReturn} />
              </HStack>
            }
          >
            <Text fontSize="12px" color={MUTED} mb={3}>
              {money(leadValue)} ÷ {targetReturn}x = <strong>{money(vCeil)}</strong> is worth paying.{" "}
              {budgetBinds
                ? <>Spending to that costs more than the {money(budget)} budget, so the real bar is <strong>{money(plan.effectiveCeiling)}</strong>.</>
                : <>The budget covers it.</>}
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
                  <YAxis domain={[0, 160]} ticks={[0, 40, 80, 120, 160]} allowDataOverflow
                    tickFormatter={(v: number) => `$${v}`}
                    tick={{ fontSize: 10, fill: "#8a8f98", fontFamily: "monospace" }}
                    stroke="#c9ced6" width={42} />
                  <ReferenceLine y={plan.effectiveCeiling} stroke="#d03b3b" strokeDasharray="5 3"
                    label={{ value: `${money(plan.effectiveCeiling)} bar`, position: "insideTopLeft",
                      style: { fontSize: 10, fill: "#d03b3b", fontWeight: 700, fontFamily: "monospace" } }} />
                  <ReferenceLine x={1} stroke="#c9ced6"
                    label={{ value: "today", position: "top",
                      style: { fontSize: 10, fill: "#4a4e57", fontWeight: 700, fontFamily: "monospace" } }} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as { key: ChannelKey; x: number; y: number; spend: number };
                    const over = p.y > plan.effectiveCeiling;
                    return <ChartTip title={byKey[p.key].label}
                      rows={[{ label: `at ${money(p.spend)}`, value: money(p.y) }]}
                      footer={<Text as="span" color={over ? "red.500" : "green.600"} fontWeight={600}>
                        {over ? "over the bar — stop buying" : "under the bar — keep buying"}
                      </Text>} />;
                  }} />
                  {KEYS.map((k) => {
                    const c = byKey[k];
                    const pts = [];
                    for (let m = 0.15; m <= 1.85; m += 0.05) {
                      const s = c.spend * m;
                      const y = marginalAt(curves[k], s);
                      if (y <= 175) pts.push({ x: +m.toFixed(2), y, spend: s, key: k });
                    }
                    return <Line key={k} data={pts} dataKey="y" type="monotone" stroke={c.color}
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
                Suggested move — same {money(budget)} budget
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
                        {r.cappedBy ? "Held by the list-burn cap." : `Next conv. ${money(r.marginalNow)} today.`}
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
            sub="A control group was held out of each channel. The gap between how often exposed people converted and how often the control converted is what the advertising caused — the rest was going to happen anyway."
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
                <strong>Email looks like the best channel and is mostly taking credit.</strong>{" "}
                Its control group converted at {(byKey.email.lift.controlRate * 100).toFixed(2)}%
                against {(byKey.email.lift.exposedRate * 100).toFixed(2)}% for people who got the
                emails — so {nf(byKey.email.lift.baseline)} of its{" "}
                {nf(byKey.email.conversions)} conversions were existing customers returning on
                their own. Online video is the reverse: its control barely converted at all, so
                almost everything it is credited with, it earned.
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
function NumIn({ label, value, onChange, step, prefix, suffix }: {
  label: string; value: number; onChange: (v: number) => void;
  step: number; prefix?: string; suffix?: string;
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
          w={suffix ? "42px" : "56px"} border="none" outline="none" bg="transparent"
          fontFamily="mono" fontSize="13px" fontWeight={700} color={INK} />
        {suffix && <Text fontFamily="mono" fontSize="12px" color={MUTED}>{suffix}</Text>}
      </HStack>
    </Box>
  );
}
