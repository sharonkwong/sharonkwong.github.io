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
  const { channels, constants, totals } = data;
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
  const cpc = rate(T.spend, T.clicks);
  const causedOrders = channels.reduce((s, c) => s + c.lift.incremental, 0);
  const cpm = { current: (T.spend.current / T.impressions.current) * 1000,
                prior: (T.spend.prior / T.impressions.prior) * 1000 };
  const roas = { current: (T.conversions.current * leadValue) / T.spend.current,
                 prior: (T.conversions.prior * leadValue) / T.spend.prior };

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
          tip="What the shop paid for advertising over the last 30 days, across all three channels. Measured — this comes straight off the invoices." />
        <Kpi label="Impressions" value={compact(T.impressions.current)} delta={d(T.impressions.current, T.impressions.prior)}
          tip="How many times an ad was shown. For email this counts emails that landed in an inbox. Measured." />
        <Kpi label="Clicks" value={nf(T.clicks.current)} delta={d(T.clicks.current, T.clicks.prior)}
          tip="How many times someone clicked an ad or a link in an email. Measured. Worth knowing: clicks are not comparable across channels — an email goes to people who already asked to hear from us, a display ad does not." />
        <Kpi label="Online orders" value={nf(T.conversions.current)} delta={d(T.conversions.current, T.conversions.prior)}
          tip="Orders placed on the website or app, credited to the last ad the customer saw beforehand. Measured by the ordering system, then matched back to ad exposure. This is the outcome the whole dashboard is about." />
        <Kpi label="Cost per order" value={money(cpa.current, 2)} delta={d(cpa.current, cpa.prior)} lowerIsBetter
          tip="Spend ÷ online orders. Derived. This is the average across every order — the next order always costs more than the average, which is what the panel further down works out." />
        <Kpi label="Return on ad spend" value={`${roas.current.toFixed(2)}x`} delta={d(roas.current, roas.prior)}
          tip={`Orders × ${money(leadValue)} profit per order ÷ spend. Derived. The ${money(leadValue)} is the owner's own number — you can change it in the panel below and every figure that depends on it moves.`} />
        <Kpi label="Click-through rate" value={`${(ctr.current * 100).toFixed(2)}%`} delta={d(ctr.current, ctr.prior)}
          tip="Clicks ÷ impressions. Derived. Tells you whether the creative is getting attention, not whether it sold any pizza." />
        <Kpi label="Orders the ads caused" value={nf(causedOrders)}
          sub={`${((causedOrders / T.conversions.current) * 100).toFixed(0)}% of the ${nf(T.conversions.current)} credited`}
          tip="Adds up each channel's control-group test: orders by people who saw the ads, minus what the matched control ordered anyway. Derived, and the only number here that says the advertising was responsible. It has no period-on-period change because a lift test is a study with a fixed window, not a daily metric." />
        <Kpi label="Cost per click" value={money(cpc.current, 2)} delta={d(cpc.current, cpc.prior)} lowerIsBetter
          tip="Spend ÷ clicks. Derived." />
        <Kpi label="Cost per 1,000 views" value={money(cpm.current, 2)} delta={d(cpm.current, cpm.prior)} lowerIsBetter
          tip="Spend ÷ impressions × 1,000 — the industry calls this CPM. Derived. It is the price of the media itself, before any question of whether it worked." />
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
          <TrendCard title="Orders" data={series("conversions")} channels={channels} dim={dim}
            fmt={(v) => nf(v)} area />
          <TrendCard title="Cost per order" data={cpaSeries} channels={channels} dim={dim}
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
          <Panel title="Cost per order" sub="Lower is better.">
            <Box display="flex" flexDirection="column" gap={2.5}>
              {[...channels].sort((a, b) => a.cpa - b.cpa).map((c) => (
                <BarRow key={c.key} label={c.label} value={c.cpa}
                  max={Math.max(...channels.map((x) => x.cpa))} color={c.color}
                  display={money(c.cpa, 2)} sub={`${nf(c.conversions)} orders`}
                  dim={dim(c.key)} onClick={() => setChannel(channel === c.key ? null : c.key)} />
              ))}
            </Box>
            <Box mt={5}>
              <Text fontSize="12px" fontWeight={700} color={INK} mb={2}>Share of spend vs orders</Text>
              <Stack label="Spend" parts={channels.map((c) => ({ k: c.key, v: c.spend, color: c.color, dim: dim(c.key) }))} />
              <Box h={2} />
              <Stack label="Orders" parts={channels.map((c) => ({ k: c.key, v: c.conversions, color: c.color, dim: dim(c.key) }))} />
            </Box>
          </Panel>

          <Panel
            title="What would one more order cost?"
            sub="Every channel gets more expensive the more you spend on it. Above the red line, one more order costs more than it earns."
            right={
              <HStack spacing={3} wrap="wrap">
                <NumIn label="Profit per order" prefix="$" value={leadValue} step={1} onChange={setLeadValue} />
                <NumIn label="Return needed" suffix="x" value={targetReturn} step={0.25} onChange={setTargetReturn} />
              </HStack>
            }
          >
            <Text fontSize="12px" color={MUTED} mb={3}>
              {money(leadValue)} ÷ {targetReturn}x = <strong>{money(vCeil, 2)}</strong> is worth paying for an order.{" "}
              {budgetBinds
                ? <>Spending to that costs more than the {money(budget)} budget, so the real bar is <strong>{money(plan.effectiveCeiling, 2)}</strong>.</>
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
                  <YAxis domain={[0, yAxis.top]} ticks={yAxis.ticks} allowDataOverflow
                    tickFormatter={(v: number) => `$${v}`}
                    tick={{ fontSize: 10, fill: "#8a8f98", fontFamily: "monospace" }}
                    stroke="#c9ced6" width={42} />
                  <ReferenceLine y={plan.effectiveCeiling} stroke="#d03b3b" strokeDasharray="5 3"
                    label={{ value: `${money(plan.effectiveCeiling, 2)} bar`, position: "insideTopLeft",
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
                        {over ? "over the bar — stop buying" : "under the bar — keep buying"}
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
                        {r.cappedBy ? "Held by the list-burn cap." : `Next order costs ${money(r.marginalNow, 2)} today.`}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
              <HStack spacing={6} mt={4} wrap="wrap">
                <Box>
                  <Text fontFamily="mono" fontSize="9px" letterSpacing="0.11em" textTransform="uppercase" color={MUTED}>Orders</Text>
                  <Text fontFamily="mono" fontSize="16px" fontWeight={700} color="green.600">
                    {nf(nowConv)} → {nf(planConv)}
                  </Text>
                </Box>
                <Box>
                  <Text fontFamily="mono" fontSize="9px" letterSpacing="0.11em" textTransform="uppercase" color={MUTED}>Cost per order</Text>
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
            title="How many of these orders did the ads actually cause?"
            sub="A control group was deliberately kept away from each channel's ads. The gap between how often people who saw the ads ordered and how often the control ordered is what the advertising caused. The rest was going to order anyway."
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
                          {nf(c.conversions)} orders credited
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
                        {nf(L.baseline)} would have ordered anyway
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
                  <Text fontSize="12px" color="gray.600">Would have ordered anyway</Text>
                </HStack>
              </HStack>
              <Text fontSize="13.5px" color="gray.700" lineHeight={1.6} maxW="82ch">
                <strong>Email looks like the best channel, and it is mostly taking credit.</strong>{" "}
                People on the list who were kept out of the sends still ordered{" "}
                {(byKey.email.lift.controlRate * 100).toFixed(2)}% of the time, against{" "}
                {(byKey.email.lift.exposedRate * 100).toFixed(2)}% for people who got them — so{" "}
                {nf(byKey.email.lift.baseline)} of its {nf(byKey.email.conversions)} orders were
                regulars ordering pizza the way they always do. Online video is the reverse: its
                control group barely ordered at all, so nearly everything it gets credit for, it
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
