import { Box, Flex, Grid, HStack, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { compact, convOf, cpaOf, money, nf, shortDate, totals } from "./data";
import { allocate, marginalAt, valueCeiling } from "./model";
import type { AttrModel, CampaignData, Channel, ChannelKey } from "./types";
import {
  BarRow, Callout, ChartTip, INK, Kpi, KpiRow, MUTED, Panel, RULE, Segmented,
} from "./ui";

type TrendMetric = "conv" | "spend" | "cpa" | "imps";

export default function Dashboard({
  data, attr, channel, setView,
}: {
  data: CampaignData;
  attr: AttrModel;
  channel: ChannelKey | null;
  setView: (p: { attr?: AttrModel; channel?: ChannelKey | null }) => void;
}) {
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("conv");
  const { channels, constants } = data;
  // The two assumptions the ceiling is built from — editable, because they are
  // inputs the advertiser owns, not things we measured.
  const [leadValue, setLeadValue] = useState(constants.valuePerConversion);
  const [targetReturn, setTargetReturn] = useState(constants.targetReturn);
  const byKey = useMemo(
    () => Object.fromEntries(channels.map((c) => [c.key, c])) as Record<ChannelKey, Channel>,
    [channels]
  );
  const t = totals(channels, attr);
  const isIncr = attr === "incr";
  const dimmed = (k: ChannelKey) => Boolean(channel && channel !== k);

  /* ------------------------------------------------- response model */
  const curves = useMemo(
    () => Object.fromEntries(
      channels.map((c) => [c.key, { K: c.halfSaturationSpend, Cmax: c.maxConversions }])
    ) as Record<ChannelKey, { K: number; Cmax: number }>,
    [channels]
  );
  const budget = channels.reduce((s, c) => s + c.spend, 0);
  const vCeil = valueCeiling(leadValue, targetReturn);
  const plan = useMemo(
    () => allocate(
      channels.map((c) => ({
        key: c.key,
        spend: c.spend,
        curve: curves[c.key],
        cap: c.key === "email"
          ? { value: constants.emailSpendCap, reason: "list-burn cap" }
          : undefined,
      })),
      vCeil, budget
    ),
    [channels, curves, vCeil, budget, constants.emailSpendCap]
  );
  const planConv = plan.rows.reduce((s, r) => s + r.proposedConversions, 0);
  const nowConv = plan.rows.reduce((s, r) => s + r.currentConversions, 0);
  const budgetBinds = plan.effectiveCeiling < vCeil - 0.01;

  /* ------------------------------------------------------- trend series */
  const trendData = useMemo(
    () =>
      data.daily.map((d) => {
        const row: Record<string, number | string> = { date: d.date };
        (["display", "video", "email"] as ChannelKey[]).forEach((k) => {
          const m = d[k];
          const conv = isIncr ? m.conversionsIncr : m.conversionsLast;
          row[k] =
            trendMetric === "conv" ? conv
            : trendMetric === "spend" ? m.spend
            : trendMetric === "imps" ? m.impressions
            : conv > 0 ? m.spend / conv : 0;
        });
        return row;
      }),
    [data.daily, trendMetric, isIncr]
  );
  const trendFmt = (v: number) =>
    trendMetric === "spend" ? money(v)
    : trendMetric === "cpa" ? money(v)
    : compact(v);

  /* -------------------------------------------------- marginal series */
  // Sampled straight off the response curve, so the line and the recommendation
  // are the same maths — they cannot disagree.
  const marginalSeries = (["display", "video", "email"] as ChannelKey[]).map((k) => {
    const c = byKey[k];
    const pts = [];
    for (let mult = 0.15; mult <= 1.85; mult += 0.05) {
      const s = c.spend * mult;
      const m = marginalAt(curves[k], s);
      if (m <= 340) pts.push({ x: +mult.toFixed(2), y: m, spendK: s / 1000, key: k });
    }
    return { key: k, color: c.color, points: pts, currentX: 1 };
  });

  const verdictRows = [...channels].sort((a, b) => cpaOf(a, attr) - cpaOf(b, attr));
  const maxCpa = Math.max(...channels.map((c) => cpaOf(c, attr)));
  const best = verdictRows[0];
  const worst = verdictRows[verdictRows.length - 1];

  return (
    <>
      {/* ---------------- control bar ---------------- */}
      <Flex
        justify="space-between" align="center" gap={3} wrap="wrap"
        bg="white" border="1px solid" borderColor={RULE} borderRadius="10px"
        px={4} py={3} mb={4}
        boxShadow="0 1px 2px rgba(16,24,40,.04), 0 8px 24px -18px rgba(16,24,40,.25)"
      >
        <HStack spacing={3} wrap="wrap">
          <Text fontFamily="mono" fontSize="10px" letterSpacing="0.13em"
            textTransform="uppercase" color={MUTED} fontWeight={600}>
            Attribution
          </Text>
          <Segmented<AttrModel>
            ariaLabel="Attribution model"
            value={attr}
            onChange={(v) => setView({ attr: v })}
            options={[
              { value: "last", label: "Last-touch" },
              { value: "incr", label: "Incremental (lift-tested)" },
            ]}
          />
          <Text fontFamily="mono" fontSize="11px" color={MUTED}>
            {isIncr
              ? "Holdout-validated. This is the one that should drive budget."
              : "What most platforms report by default. Kept so the gap is visible."}
          </Text>
        </HStack>
        {channel && (
          <HStack spacing={2}>
            <Text fontFamily="mono" fontSize="11px" color={MUTED}>Filtered:</Text>
            <Box as="button" type="button" onClick={() => setView({ channel: null })}
              fontFamily="mono" fontSize="11px" fontWeight={700} px={2} py="3px"
              borderRadius="full" bg={byKey[channel].color} color="white"
              _hover={{ opacity: 0.85 }}>
              {byKey[channel].label} ✕
            </Box>
          </HStack>
        )}
      </Flex>

      {/* ---------------- attribution warning ---------------- */}
      {!isIncr && (
        <Box mb={4}>
          <Callout tag="You just changed the ranking" tone="warn">
            <p>
              Email now reads <strong>{money(byKey.email.cpaLast, 2)}</strong> and looks{" "}
              {(byKey.video.cpaLast / byKey.email.cpaLast).toFixed(0)}× better than online video. But
              only <strong>{(byKey.email.incrementalityRate * 100).toFixed(0)}%</strong> of those
              conversions were incremental — the rest would have happened anyway. Budget set on this
              view over-funds retargeting and email.
            </p>
          </Callout>
        </Box>
      )}

      {/* ---------------- KPIs ---------------- */}
      <KpiRow>
        <Kpi label="Total spend" value={money(t.spend)} sub="across 3 channels" />
        <Kpi
          label={isIncr ? "Incremental conversions" : "Attributed conversions"}
          value={nf(t.conv)}
          sub={isIncr ? "holdout-validated" : "last-touch credit"}
        />
        <Kpi
          label={isIncr ? "Cost per incremental conv." : "Cost per conversion"}
          value={money(t.blended, 2)}
          sub={isIncr ? "the decision metric" : "flatters cheap channels"}
        />
        <Kpi
          label={isIncr ? "Incremental ROAS" : "Reported ROAS"}
          value={`${((t.conv * constants.valuePerConversion) / t.spend).toFixed(2)}x`}
          sub={`at ${money(constants.valuePerConversion)} per lead`}
        />
        <Kpi label="Ceiling on next conv." value={money(plan.effectiveCeiling)}
          sub={budgetBinds ? "set by budget, not value" : "set by lead value ÷ return"} />
        <Kpi label="Qualified leads / day" value={nf(t.conv / data.daily.length)} sub={`${data.daily.length}-day flight`} />
      </KpiRow>

      {/* ---------------- the answer ---------------- */}
      <Grid templateColumns={{ base: "1fr", lg: "1.35fr 1fr" }} gap={4} mt={4}>
        <Panel
          title="Cost per conversion, by channel"
          sub={
            isIncr
              ? "Conversions that would not have happened otherwise. Lower is better — click a bar to filter the page."
              : "Credits whatever the customer touched last. Lower is better."
          }
        >
          <Box display="flex" flexDirection="column" gap={2.5}>
            {verdictRows.map((c) => (
              <BarRow
                key={c.key}
                label={c.label}
                value={cpaOf(c, attr)}
                max={maxCpa}
                color={c.color}
                display={money(cpaOf(c, attr), 2)}
                sub={`${nf(convOf(c, attr))} conv`}
                dim={dimmed(c.key)}
                onClick={() => setView({ channel: channel === c.key ? null : c.key })}
              />
            ))}
          </Box>
          <Text fontSize="12px" color={MUTED} mt={4} lineHeight={1.6}>
            {isIncr ? (
              <>
                <strong>{best.label}</strong> is cheapest — but see the panel below. Cheap today is
                not the same as room to grow.
              </>
            ) : (
              <>
                On last-touch, <strong>{best.label}</strong> looks{" "}
                {(cpaOf(worst, attr) / cpaOf(best, attr)).toFixed(0)}× better than {worst.label}.
                Switch to Incremental to see how much of that is real.
              </>
            )}
          </Text>
        </Panel>

        <Panel
          title="Where the money goes vs. what it buys"
          sub="Wider on top than bottom means over-funded."
        >
          <ShareStack label="Share of spend" total={money(t.spend)}
            parts={channels.map((c) => ({ key: c.key, v: c.spend, color: c.color, dim: dimmed(c.key) }))} />
          <Box h={3} />
          <ShareStack
            label="Share of conversions"
            total={`${nf(t.conv)} ${isIncr ? "incremental" : "attributed"}`}
            parts={channels.map((c) => ({ key: c.key, v: convOf(c, attr), color: c.color, dim: dimmed(c.key) }))}
          />
          <HStack spacing={4} mt={3} wrap="wrap">
            {channels.map((c) => (
              <HStack key={c.key} spacing={1.5}>
                <Box w="10px" h="10px" borderRadius="2px" bg={c.color} />
                <Text fontSize="12px" color="gray.600">{c.label}</Text>
              </HStack>
            ))}
          </HStack>
          <Text fontSize="12px" color={MUTED} mt={3} lineHeight={1.6}>
            Display takes <strong>{((byKey.display.spend / t.spend) * 100).toFixed(0)}%</strong> of
            spend and returns <strong>{((convOf(byKey.display, attr) / t.conv) * 100).toFixed(0)}%</strong>{" "}
            of {isIncr ? "incremental " : ""}conversions — the clearest over-funding on the chart.
          </Text>
        </Panel>
      </Grid>

      {/* ---------------- marginal + realloc ---------------- */}
      <Grid templateColumns={{ base: "1fr", lg: "1.35fr 1fr" }} gap={4} mt={4}>
        <Panel
          title="How much more can each channel absorb?"
          sub="What the NEXT conversion costs as you spend more. Above the red line it stops being worth buying. Everything below is computed from these two inputs — change them and the whole recommendation moves."
          right={
            <HStack spacing={3} wrap="wrap">
              <NumIn label="Lead worth" prefix="$" value={leadValue} step={10}
                onChange={setLeadValue} />
              <NumIn label="Return needed" suffix="x" value={targetReturn} step={0.25}
                onChange={setTargetReturn} />
            </HStack>
          }
        >
          <Text fontSize="12px" color={MUTED} mb={3}>
            {money(leadValue)} ÷ {targetReturn}x = <strong>{money(vCeil)}</strong> a conversion is
            worth paying.{" "}
            {budgetBinds ? (
              <>But spending to that bar costs more than the {money(budget)} budget, so the binding
              bar is <strong>{money(plan.effectiveCeiling)}</strong> — you can't afford every
              conversion that would pay back.</>
            ) : (
              <>The budget covers that, so {money(vCeil)} is the bar.</>
            )}
          </Text>
          <Box h="260px">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart margin={{ top: 16, right: 18, bottom: 24, left: 4 }}>
                <CartesianGrid stroke="#eceef1" vertical={false} />
                <XAxis
                  type="number" dataKey="x" domain={[0.15, 1.8]}
                  ticks={[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75]}
                  tickFormatter={(v: number) => `${v}x`}
                  tick={{ fontSize: 10, fill: "#8a8f98", fontFamily: "monospace" }}
                  stroke="#c9ced6"
                  label={{ value: "spend vs today  ·  1x = current spend", position: "insideBottom",
                    offset: -14, style: { fontSize: 10, fill: "#8a8f98", fontFamily: "monospace" } }}
                />
                <YAxis
                  domain={[0, 320]} ticks={[0, 80, 160, 240, 320]} allowDataOverflow
                  tickFormatter={(v: number) => `$${v}`}
                  tick={{ fontSize: 10, fill: "#8a8f98", fontFamily: "monospace" }}
                  stroke="#c9ced6" width={44}
                />
                <ReferenceLine y={plan.effectiveCeiling} stroke="#d03b3b" strokeDasharray="5 3"
                  label={{ value: `$${plan.effectiveCeiling.toFixed(0)} ceiling`, position: "insideTopLeft",
                    style: { fontSize: 10, fill: "#d03b3b", fontWeight: 700, fontFamily: "monospace" } }} />
                <ReferenceLine x={1} stroke="#c9ced6"
                  label={{ value: "today", position: "top",
                    style: { fontSize: 10, fill: "#4a4e57", fontWeight: 700, fontFamily: "monospace" } }} />
                <Tooltip
                  cursor={{ stroke: "#c9ced6", strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as { key: ChannelKey; x: number; y: number; spendK: number; isCurrent: boolean };
                    const over = p.y > plan.effectiveCeiling;
                    return (
                      <ChartTip
                        title={byKey[p.key].label}
                        rows={[
                          { label: `${p.x.toFixed(2)}x current`, value: money(p.spendK * 1000) },
                          { label: "Marginal cost", value: money(p.y) },
                        ]}
                        footer={
                          <Text as="span" color={over ? "red.500" : "green.600"} fontWeight={600}>
                            {over ? "Above the ceiling — stop buying" : "Under the ceiling — keep buying"}
                            {p.isCurrent ? " · where we are today" : ""}
                          </Text>
                        }
                      />
                    );
                  }}
                />
                {marginalSeries.map((s) => (
                  <Line
                    key={s.key} data={s.points} dataKey="y" type="monotone"
                    stroke={s.color} strokeWidth={dimmed(s.key) ? 1.5 : 2.5}
                    strokeOpacity={dimmed(s.key) ? 0.3 : 1}
                    dot={(props: { cx?: number; cy?: number; payload?: { x: number } }) =>
                      props.payload?.x === 1 ? (
                        <circle key={`${s.key}-now`} cx={props.cx} cy={props.cy} r={5.5}
                          fill={s.color} stroke="#fff" strokeWidth={2}
                          opacity={dimmed(s.key) ? 0.3 : 1} />
                      ) : <g key={`${s.key}-${props.cx}`} />
                    }
                    activeDot={{ r: 6 }} isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <Box display="grid" gridTemplateColumns={{ base: "1fr", sm: "repeat(3, 1fr)" }}
            gap={2} mt={3}>
            {plan.rows.map((r) => {
              const c = byKey[r.key as ChannelKey];
              const up = r.delta > 0;
              return (
                <Box key={r.key} borderTop="2px solid" borderColor={c.color} pt={2}>
                  <Text fontSize="12.5px" fontWeight={700} color={INK}>{c.label}</Text>
                  <Text fontFamily="mono" fontSize="15px" fontWeight={700} mt="2px"
                    color={up ? "green.600" : "red.500"}>
                    {up ? "+" : "−"}{money(Math.abs(r.delta))}
                  </Text>
                  <Text fontSize="11.5px" color={MUTED} mt="2px" lineHeight={1.45}>
                    Next conversion costs {money(r.marginalNow)} today.{" "}
                    {r.cappedBy
                      ? `Held at ${money(r.proposed)} by the ${r.cappedBy}.`
                      : `Reaches the ${money(plan.effectiveCeiling)} bar at ${money(r.proposed)}.`}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Panel>

        <Panel title="Recommended reallocation"
          sub="Same total budget, moved to where each channel still pays back.">
          <Box overflowX="auto">
            <Box as="table" w="100%" fontSize="13px" style={{ borderCollapse: "collapse" }}>
              <Box as="thead">
                <Box as="tr">
                  {["Channel", "Now", "Proposed", "Δ"].map((h, i) => (
                    <Box as="th" key={h} textAlign={i === 0 ? "left" : "right"}
                      fontFamily="mono" fontSize="9.5px" letterSpacing="0.11em" textTransform="uppercase"
                      color={MUTED} fontWeight={600} py={2} px={2} borderBottom="1px solid" borderColor="gray.300">
                      {h}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box as="tbody">
                {plan.rows.map((r) => {
                  const c = byKey[r.key as ChannelKey];
                  return (
                    <Box as="tr" key={r.key} _hover={{ bg: "gray.50" }}>
                      <Box as="td" py={2.5} px={2} borderBottom="1px solid" borderColor={RULE}
                        fontWeight={600} color={INK}>
                        <HStack spacing={2}>
                          <Box w="8px" h="8px" borderRadius="2px" bg={c.color} />
                          <Text>{c.label}</Text>
                          {r.cappedBy && (
                            <Text as="span" fontFamily="mono" fontSize="9px" color={MUTED}
                              border="1px solid" borderColor="gray.300" borderRadius="full" px={1.5}>
                              capped
                            </Text>
                          )}
                        </HStack>
                      </Box>
                      <Box as="td" py={2.5} px={2} borderBottom="1px solid" borderColor={RULE}
                        textAlign="right" fontFamily="mono" color="gray.600">{money(r.current)}</Box>
                      <Box as="td" py={2.5} px={2} borderBottom="1px solid" borderColor={RULE}
                        textAlign="right" fontFamily="mono" color="gray.600">{money(r.proposed)}</Box>
                      <Box as="td" py={2.5} px={2} borderBottom="1px solid" borderColor={RULE}
                        textAlign="right" fontFamily="mono" fontWeight={700}
                        color={r.delta > 0 ? "green.600" : "red.500"}>
                        {r.delta > 0 ? "+" : "−"}{money(Math.abs(r.delta))}
                      </Box>
                    </Box>
                  );
                })}
                <Box as="tr">
                  <Box as="td" py={2.5} px={2} fontWeight={700} color={INK}>Total</Box>
                  <Box as="td" py={2.5} px={2} textAlign="right" fontFamily="mono" fontWeight={700} color={INK}>
                    {money(budget)}
                  </Box>
                  <Box as="td" py={2.5} px={2} textAlign="right" fontFamily="mono" fontWeight={700} color={INK}>
                    {money(plan.rows.reduce((s, r) => s + r.proposed, 0))}
                  </Box>
                  <Box as="td" py={2.5} px={2} textAlign="right" fontFamily="mono" color={MUTED}>—</Box>
                </Box>
              </Box>
            </Box>
          </Box>
          <Box mt={4}>
            <KpiRow>
              <Kpi label="Incr. conversions" value={nf(planConv)}
                sub={`▲ ${(((planConv / nowConv) - 1) * 100).toFixed(1)}% vs ${nf(nowConv)}`} tone="good" />
              <Kpi label="Blended CPiC" value={money(budget / planConv, 2)}
                sub={`▼ ${((1 - (budget / planConv) / (budget / nowConv)) * 100).toFixed(1)}% vs ${money(budget / nowConv, 2)}`}
                tone="good" />
              <Kpi label="Equal at the margin"
                value={plan.equimarginal ? "Yes" : "No"}
                sub={plan.equimarginal ? "optimal allocation" : "not yet optimal"}
                tone={plan.equimarginal ? "good" : "bad"} />
            </KpiRow>
          </Box>
        </Panel>
      </Grid>

      {/* ---------------- trend ---------------- */}
      <Box mt={4}>
        <Panel
          title="Daily trend"
          right={
            <Segmented<TrendMetric>
              ariaLabel="Trend metric" value={trendMetric} onChange={setTrendMetric}
              options={[
                { value: "conv", label: "Conversions" },
                { value: "spend", label: "Spend" },
                { value: "cpa", label: "Cost per conv." },
                { value: "imps", label: "Impressions" },
              ]}
            />
          }
          sub={
            trendMetric === "imps"
              ? "Impressions for display and video; delivered messages for email."
              : trendMetric === "spend"
              ? "Daily spend. Email is billed as flat production plus platform, spread across send days."
              : trendMetric === "cpa"
              ? "Email spikes on send days — it only sends twice a week, so the between-days are near zero."
              : `${isIncr ? "Incremental" : "Last-touch"} conversions per day.`
          }
        >
          <Box h="270px">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 6, right: 14, bottom: 4, left: 4 }}>
                <CartesianGrid stroke="#eceef1" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} interval={4}
                  tick={{ fontSize: 10, fill: "#8a8f98", fontFamily: "monospace" }} stroke="#c9ced6" />
                <YAxis tickFormatter={trendFmt}
                  tick={{ fontSize: 10, fill: "#8a8f98", fontFamily: "monospace" }} stroke="#c9ced6" width={54} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <ChartTip
                        title={shortDate(String(label))}
                        rows={payload.map((p) => ({
                          label: byKey[p.dataKey as ChannelKey].label,
                          value: trendFmt(Number(p.value)),
                          color: String(p.stroke),
                        }))}
                      />
                    );
                  }}
                />
                {channels.map((c) => (
                  <Line key={c.key} dataKey={c.key} type="monotone" stroke={c.color}
                    strokeWidth={dimmed(c.key) ? 1.2 : 2} strokeOpacity={dimmed(c.key) ? 0.28 : 1}
                    dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <HStack spacing={4} mt={2} wrap="wrap">
            {channels.map((c) => (
              <HStack key={c.key} spacing={1.5}>
                <Box w="10px" h="10px" borderRadius="2px" bg={c.color} />
                <Text fontSize="12px" color="gray.600">{c.label}</Text>
              </HStack>
            ))}
          </HStack>
        </Panel>
      </Box>
    </>
  );
}

/* ---------------------------------------------------------- number input */
function NumIn({
  label, value, onChange, step, prefix, suffix,
}: {
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
          fontFamily="mono" fontSize="13px" fontWeight={700} color={INK}
          sx={{ "&::-webkit-outer-spin-button,&::-webkit-inner-spin-button": { opacity: 1 } }} />
        {suffix && <Text fontFamily="mono" fontSize="12px" color={MUTED}>{suffix}</Text>}
      </HStack>
    </Box>
  );
}

/* ------------------------------------------------------------- share bar */
function ShareStack({
  label, total, parts,
}: {
  label: string;
  total: string;
  parts: { key: string; v: number; color: string; dim: boolean }[];
}) {
  const sum = parts.reduce((s, p) => s + p.v, 0);
  return (
    <Box>
      <Flex justify="space-between" mb={1.5}>
        <Text fontFamily="mono" fontSize="10px" letterSpacing="0.1em" textTransform="uppercase" color={MUTED}>
          {label}
        </Text>
        <Text fontFamily="mono" fontSize="10px" color={MUTED}>{total}</Text>
      </Flex>
      <Flex h="26px" borderRadius="5px" overflow="hidden" gap="2px" bg="gray.100">
        {parts.map((p) => {
          const share = (p.v / sum) * 100;
          return (
            <Flex key={p.key} align="center" justify="center" bg={p.color} opacity={p.dim ? 0.35 : 1}
              flex={`0 0 ${share}%`} minW={0} transition="flex-basis .35s ease, opacity .2s"
              fontFamily="mono" fontSize="10.5px" fontWeight={700} color="white">
              {share > 9 ? `${share.toFixed(0)}%` : ""}
            </Flex>
          );
        })}
      </Flex>
    </Box>
  );
}
