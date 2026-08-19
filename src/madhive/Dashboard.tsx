import { Box, Flex, Grid, HStack, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { compact, convOf, cpaOf, money, nf, shortDate, totals } from "./data";
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
  const byKey = useMemo(
    () => Object.fromEntries(channels.map((c) => [c.key, c])) as Record<ChannelKey, Channel>,
    [channels]
  );
  const t = totals(channels, attr);
  const isIncr = attr === "incr";
  const dimmed = (k: ChannelKey) => Boolean(channel && channel !== k);

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
  const marginalSeries = (["display", "video", "email"] as ChannelKey[]).map((k) => ({
    key: k,
    color: byKey[k].color,
    points: data.marginal[k].map((p) => ({
      x: p.multiple, y: p.marginalCpic, spendK: p.spendK, isCurrent: p.isCurrent, key: k,
    })),
  }));

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
              You're looking at <strong>last-touch</strong>. Email reads{" "}
              <strong>{money(byKey.email.cpaLast, 2)}</strong> per conversion and appears to beat
              online video by {(byKey.video.cpaLast / byKey.email.cpaLast).toFixed(0)}×. Lift testing
              says only <strong>{(byKey.email.incrementalityRate * 100).toFixed(0)}%</strong> of
              those conversions were incremental — the rest were customers who would have bought
              anyway. Budget decisions made on this view systematically over-fund retargeting and
              email, and starve the channels that actually create demand.
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
        <Kpi label="Households reached" value={nf(constants.dedupedHouseholds)} sub="deduped across channels" />
        <Kpi label="Qualified leads / day" value={nf(t.conv / data.daily.length)} sub={`${data.daily.length}-day flight`} />
      </KpiRow>

      {/* ---------------- the answer ---------------- */}
      <Grid templateColumns={{ base: "1fr", lg: "1.35fr 1fr" }} gap={4} mt={4}>
        <Panel
          title="Cost per conversion, by channel"
          sub={
            isIncr
              ? "Cost per INCREMENTAL conversion — conversions that would not have happened otherwise. Lower is better. Click a bar to filter the page."
              : "Cost per LAST-TOUCH conversion — credits whatever the customer touched last. Lower is better."
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
                <strong>{best.label}</strong> is most efficient per incremental conversion — but read
                the panel below before moving budget. Efficiency at today's spend is not headroom for
                tomorrow's.
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
          sub="Share of spend against share of conversions. A channel wider on top than bottom is over-funded."
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
          title="Where the next dollar still works"
          sub={`Marginal cost per incremental conversion, plotted against each channel's own current spend. Three channels spending $22K, $148K and $232K can't share a dollar axis — email would occupy 8% of it — and the question here is marginal behaviour, so this normalises to "the next dollar relative to today".`}
        >
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
                  label={{ value: "multiple of that channel's current spend", position: "insideBottom",
                    offset: -14, style: { fontSize: 10, fill: "#8a8f98", fontFamily: "monospace" } }}
                />
                <YAxis
                  domain={[0, 300]} tickFormatter={(v: number) => `$${v}`}
                  tick={{ fontSize: 10, fill: "#8a8f98", fontFamily: "monospace" }}
                  stroke="#c9ced6" width={44}
                />
                <ReferenceLine y={constants.ceiling} stroke="#d03b3b" strokeDasharray="5 3"
                  label={{ value: `$${constants.ceiling} ceiling`, position: "insideTopLeft",
                    style: { fontSize: 10, fill: "#d03b3b", fontWeight: 700, fontFamily: "monospace" } }} />
                <ReferenceLine x={1} stroke="#c9ced6"
                  label={{ value: "today", position: "top",
                    style: { fontSize: 10, fill: "#4a4e57", fontWeight: 700, fontFamily: "monospace" } }} />
                <Tooltip
                  cursor={{ stroke: "#c9ced6", strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as { key: ChannelKey; x: number; y: number; spendK: number; isCurrent: boolean };
                    const over = p.y > constants.ceiling;
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
                    dot={(props: { cx?: number; cy?: number; payload?: { isCurrent: boolean } }) => (
                      <circle
                        key={`${s.key}-${props.cx}`}
                        cx={props.cx} cy={props.cy}
                        r={props.payload?.isCurrent ? 5.5 : 3.5}
                        fill={props.payload?.isCurrent ? s.color : "#fff"}
                        stroke={s.color} strokeWidth={2}
                        opacity={dimmed(s.key) ? 0.3 : 1}
                      />
                    )}
                    activeDot={{ r: 6 }} isAnimationActive={false}
                  />
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
            <HStack spacing={1.5}>
              <Box w="10px" h="10px" borderRadius="2px" bg="#d03b3b" />
              <Text fontSize="12px" color="gray.600">${constants.ceiling} ceiling</Text>
            </HStack>
          </HStack>
        </Panel>

        <Panel title="Recommended reallocation"
          sub="Same total budget. Moves each channel to where its marginal cost sits under the ceiling.">
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
                {data.reallocation.map((r) => {
                  const d = r.proposed - r.now;
                  return (
                    <Box as="tr" key={r.key} _hover={{ bg: "gray.50" }}>
                      <Box as="td" py={2.5} px={2} borderBottom="1px solid" borderColor={RULE}
                        fontWeight={600} color={INK}>
                        <HStack spacing={2}>
                          <Box w="8px" h="8px" borderRadius="2px" bg={byKey[r.key].color} />
                          <Text>{r.channel}</Text>
                        </HStack>
                      </Box>
                      <Box as="td" py={2.5} px={2} borderBottom="1px solid" borderColor={RULE}
                        textAlign="right" fontFamily="mono" color="gray.600">{money(r.now)}</Box>
                      <Box as="td" py={2.5} px={2} borderBottom="1px solid" borderColor={RULE}
                        textAlign="right" fontFamily="mono" color="gray.600">{money(r.proposed)}</Box>
                      <Box as="td" py={2.5} px={2} borderBottom="1px solid" borderColor={RULE}
                        textAlign="right" fontFamily="mono" fontWeight={700}
                        color={d > 0 ? "green.600" : "red.500"}>
                        {d > 0 ? "+" : "−"}{money(Math.abs(d))}
                      </Box>
                    </Box>
                  );
                })}
                <Box as="tr">
                  <Box as="td" py={2.5} px={2} fontWeight={700} color={INK}>Total</Box>
                  <Box as="td" py={2.5} px={2} textAlign="right" fontFamily="mono" fontWeight={700} color={INK}>
                    {money(data.reallocation.reduce((s, r) => s + r.now, 0))}
                  </Box>
                  <Box as="td" py={2.5} px={2} textAlign="right" fontFamily="mono" fontWeight={700} color={INK}>
                    {money(data.reallocation.reduce((s, r) => s + r.proposed, 0))}
                  </Box>
                  <Box as="td" py={2.5} px={2} textAlign="right" fontFamily="mono" color={MUTED}>—</Box>
                </Box>
              </Box>
            </Box>
          </Box>
          <Box mt={4}>
            <KpiRow>
              <Kpi label="Incr. conversions" value="7,160" sub="▲ 16.5% vs 6,145" tone="good" />
              <Kpi label="Blended CPiC" value="$56.15" sub="▼ 14.2% vs $65.42" tone="good" />
              <Kpi label="Budget change" value="$0" sub="same $402K" />
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
