import { Box, Grid, HStack, Text } from "@chakra-ui/react";
import { useState } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { money, nf } from "./data";
import type { CampaignData } from "./types";
import { BarRow, Callout, ChartTip, INK, Kpi, KpiRow, MUTED, Panel, RULE, SectionHead } from "./ui";

type Tab = "video" | "email" | "display";

export default function Diagnostics({ data }: { data: CampaignData }) {
  const [tab, setTab] = useState<Tab>("video");
  const tabs: { k: Tab; label: string }[] = [
    { k: "video", label: "Online video" },
    { k: "email", label: "Email" },
    { k: "display", label: "Display" },
  ];

  return (
    <Box mt={12}>
      <SectionHead
        title="Channel diagnostics"
        sub="Each channel's own native metrics — deliberately not comparable across tabs."
      />
      <HStack spacing={0} borderBottom="1px solid" borderColor={RULE} mb={4} wrap="wrap" role="tablist">
        {tabs.map((t) => (
          <Box
            key={t.k} as="button" type="button" role="tab" aria-selected={tab === t.k}
            onClick={() => setTab(t.k)} px={4} py={2.5} fontSize="13.5px" fontWeight={650}
            color={tab === t.k ? INK : MUTED} borderBottom="2px solid"
            borderColor={tab === t.k ? INK : "transparent"} mb="-1px"
            _hover={{ color: INK }} transition="color .15s"
          >
            {t.label}
          </Box>
        ))}
      </HStack>

      {tab === "video" && <VideoTab data={data} />}
      {tab === "email" && <EmailTab data={data} />}
      {tab === "display" && <DisplayTab data={data} />}
    </Box>
  );
}

/* ==================================================================== video */
function VideoTab({ data }: { data: CampaignData }) {
  const { quartiles, types, dropoff } = data.video;
  const maxDrop = Math.max(...dropoff.map((d) => Math.abs(d.skip)));

  return (
    <>
      <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={4}>
        <Panel
          title="Quartile completion — the retention curve"
          sub="Share of impressions still playing at each quartile. Same creative, two formats."
        >
          <Box h="250px">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={quartiles} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="#eceef1" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 10, fill: "#8a8f98", fontFamily: "monospace" }} stroke="#c9ced6" />
                <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 10, fill: "#8a8f98", fontFamily: "monospace" }} stroke="#c9ced6" width={40} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const i = quartiles.findIndex((q) => q.stage === label);
                    return (
                      <ChartTip
                        title={String(label)}
                        rows={payload.map((p) => {
                          const key = p.dataKey as "nonskip" | "skip";
                          const prev = i > 0 ? quartiles[i - 1][key] : null;
                          return {
                            label: key === "nonskip" ? "Non-skippable" : "Skippable",
                            value: `${Number(p.value).toFixed(1)}%${prev !== null ? `  (${(Number(p.value) - prev).toFixed(1)})` : ""}`,
                            color: String(p.stroke),
                          };
                        })}
                      />
                    );
                  }}
                />
                <Line dataKey="nonskip" type="monotone" stroke="#eb6834" strokeWidth={2.5}
                  dot={{ r: 4, fill: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
                <Line dataKey="skip" type="monotone" stroke="#8f9aab" strokeWidth={2.5}
                  dot={{ r: 4, fill: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <HStack spacing={4} mt={2} wrap="wrap">
            <HStack spacing={1.5}><Box w="10px" h="10px" borderRadius="2px" bg="#eb6834" />
              <Text fontSize="12px" color="gray.600">Non-skippable + bumper — 94.6%</Text></HStack>
            <HStack spacing={1.5}><Box w="10px" h="10px" borderRadius="2px" bg="#8f9aab" />
              <Text fontSize="12px" color="gray.600">Skippable in-stream — 62.8%</Text></HStack>
          </HStack>
        </Panel>

        <Panel title="The drop-off is all in one place" sub="Percentage points lost between each stage.">
          <Box display="flex" flexDirection="column" gap={2.5}>
            {dropoff.map((d) => (
              <BarRow key={d.stage} label={d.stage} value={Math.abs(d.skip)} max={maxDrop}
                color="#8f9aab" display={d.skip.toFixed(1)} sub={`non-skip ${d.nonskip.toFixed(1)}`}
                labelWidth="118px" />
            ))}
          </Box>
          <Box mt={4}>
            <Callout tag="Finding" tone="finding">
              <p>
                <strong>Skippable loses 28.6 points in the first quartile</strong> — that's the skip
                button at 5 seconds, not gradual disinterest. After it, only 8.6 more points leak away.
              </p>
              <p>
                So the fix is the first 5 seconds of the skippable cut. Non-skippable is already at
                94.6% — nothing left to win there.
              </p>
            </Callout>
          </Box>
        </Panel>
      </Grid>

      <Box mt={4}>
        <Panel>
          <Box overflowX="auto">
            <Box as="table" w="100%" minW="620px" fontSize="13px" style={{ borderCollapse: "collapse" }}>
              <Box as="thead">
                <Box as="tr">
                  {["Video type", "Spend", "Impressions", "CPM", "VCR", "CPCV", "Viewable", "CPA"].map((h, i) => (
                    <Box as="th" key={h} textAlign={i === 0 ? "left" : "right"} fontFamily="mono"
                      fontSize="9.5px" letterSpacing="0.11em" textTransform="uppercase" color={MUTED}
                      fontWeight={600} py={2.5} px={3} borderBottom="1px solid" borderColor="gray.300"
                      bg="gray.50" whiteSpace="nowrap">{h}</Box>
                  ))}
                </Box>
              </Box>
              <Box as="tbody">
                {types.map((t) => (
                  <Box as="tr" key={t.type} _hover={{ bg: "gray.50" }}>
                    <Box as="td" py={2.5} px={3} borderBottom="1px solid" borderColor={RULE}
                      fontWeight={600} color={INK}>{t.type}</Box>
                    {[money(t.spend), nf(t.impressions), money(t.cpm, 2), `${t.vcr}%`,
                      `$${t.cpcv.toFixed(3)}`, `${t.viewability}%`, money(t.cpa, 2)].map((v, i) => (
                      <Box as="td" key={i} py={2.5} px={3} borderBottom="1px solid" borderColor={RULE}
                        textAlign="right" fontFamily="mono" color="gray.600" whiteSpace="nowrap">{v}</Box>
                    ))}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Panel>
      </Box>

      <Box mt={4}>
        <Callout tag="Why CPCV is identical and CPA is not">
          <p>
            Both video types cost the same per <em>completed view</em> — $0.030. The market already
            prices completion in: skippable is cheaper per impression because fewer complete.
          </p>
          <p>
            So CPCV can't rank them. <strong>Cost per conversion can</strong> — it says
            non-skippable is 19% better. Completion is a diagnostic, not an outcome.
          </p>
        </Callout>
      </Box>
    </>
  );
}

/* ==================================================================== email */
function EmailTab({ data }: { data: CampaignData }) {
  const { funnel, listHealth, frequency } = data.email;
  const { subscriberValue, leadValue } = data.constants;
  const [idx, setIdx] = useState(2); // index of the 4-sends row = current
  const cur = frequency[idx];
  const base = frequency[2];
  const assetDelta = (cur.netList - base.netList) * subscriberValue;
  const convDelta = (cur.conversions - base.conversions) * leadValue;
  const netVal = convDelta + assetDelta;
  const maxF = funnel[0].value;

  return (
    <>
      <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={4}>
        <Panel title="Send → convert funnel" sub="Two open numbers are shown. Only one is real.">
          <Box display="flex" flexDirection="column" gap={2.5}>
            {funnel.map((f) => (
              <BarRow key={f.stage} label={f.stage} value={f.value} max={maxF}
                color={f.suspect ? "#d03b3b" : "#1baf7a"} display={nf(f.value)}
                sub={f.note ?? undefined} labelWidth="152px" />
            ))}
          </Box>
        </Panel>

        <Panel title="Open rate is not a usable metric" sub="Apple Mail Privacy Protection pre-loads tracking pixels on delivery.">
          <Callout tag="The metric is broken, not the campaign" tone="warn">
            <p>
              Apple's Mail Privacy Protection fires the tracking pixel whether or not anyone opens the
              message — inflating opens by an estimated <strong>15–20 points</strong>. Our reported
              43.5% is really about <strong>27.9%</strong>. Roughly 280,000 of those "opens" never
              happened.
            </p>
            <p>
              It breaks click-to-open too, since opens are the denominator. We use click rate on{" "}
              <em>delivered</em> instead — no pixel required.
            </p>
          </Callout>
        </Panel>
      </Grid>

      <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={4} mt={4}>
        <Panel title="List health — the asset behind the channel"
          sub="Email's constraint isn't budget — it's subscribers, and they don't come back.">
          <Box as="table" w="100%" fontSize="13px" style={{ borderCollapse: "collapse" }}>
            <Box as="tbody">
              {listHealth.map((r) => (
                <Box as="tr" key={r.metric} _hover={{ bg: "gray.50" }}>
                  <Box as="td" py={2.5} px={2} borderBottom="1px solid" borderColor={RULE}
                    fontWeight={600} color={INK}>{r.metric}</Box>
                  <Box as="td" py={2.5} px={2} borderBottom="1px solid" borderColor={RULE}
                    textAlign="right" fontFamily="mono" fontWeight={r.metric.startsWith("Net") ? 700 : 400}
                    color={r.metric.startsWith("Net") ? "green.600" : r.value < 0 ? "red.500" : "gray.600"}>
                    {r.value > 0 && (r.metric.startsWith("New") || r.metric.startsWith("Net")) ? "+" : ""}
                    {nf(r.value)}
                  </Box>
                  <Box as="td" py={2.5} px={2} borderBottom="1px solid" borderColor={RULE}
                    textAlign="right" fontFamily="mono" color={MUTED} fontSize="11px">
                    {r.benchmark ?? ""}
                  </Box>
                </Box>
              ))}
              <Box as="tr">
                <Box as="td" py={2.5} px={2} fontWeight={600} color={INK}>Modelled subscriber value</Box>
                <Box as="td" py={2.5} px={2} textAlign="right" fontFamily="mono" color="gray.600">
                  {money(subscriberValue)}
                </Box>
                <Box as="td" />
              </Box>
            </Box>
          </Box>
        </Panel>

        <Panel title="Frequency simulator" sub="Drag to change monthly send frequency. Watch what it costs.">
          <Box bg="gray.50" border="1px solid" borderColor={RULE} borderRadius="8px" p={4}>
            <Text as="label" htmlFor="freq" display="block" fontFamily="mono" fontSize="10px"
              letterSpacing="0.12em" textTransform="uppercase" color={MUTED} fontWeight={600} mb={3}>
              Sends per subscriber per month —{" "}
              <Text as="span" color="green.600" fontWeight={700} fontSize="12px">{cur.sends}</Text>
            </Text>
            <Box as="input" id="freq" type="range" min={0} max={frequency.length - 1} step={1}
              value={idx} w="100%" cursor="pointer"
              sx={{ accentColor: "#1baf7a" }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIdx(Number(e.target.value))}
              aria-label="Email sends per subscriber per month" />
            <Box mt={4}>
              <KpiRow>
                <Kpi label="Conversions" value={nf(cur.conversions)}
                  sub={cur.sends === 4 ? "current" : `${cur.conversions > base.conversions ? "+" : ""}${nf(cur.conversions - base.conversions)} vs now`} />
                <Kpi label="Unsubscribe rate" value={`${cur.unsubRate.toFixed(2)}%`}
                  sub="healthy is <0.50%" tone={cur.unsubRate > 0.5 ? "bad" : "good"} />
                <Kpi label="Net list change" value={`${cur.netList > 0 ? "+" : ""}${nf(cur.netList)}`}
                  sub="subscribers / month" tone={cur.netList > 0 ? "good" : "bad"} />
                <Kpi label="Net value vs now" value={`${netVal >= 0 ? "+" : "−"}${money(Math.abs(netVal))}`}
                  sub="conv. value + list asset" tone={netVal >= 0 ? "good" : "bad"} />
              </KpiRow>
            </Box>
          </Box>
          <Box mt={4}>
            <Callout tag="The trap this exists to show" tone="warn">
              <p>
                A 5th send gains <strong>472 conversions</strong> (~$160,480) for $4,200 in production —
                a clear win on any media-cost dashboard. It also cuts net list growth from +8,028 to
                +1,600, destroying <strong>$244,264</strong> of subscriber value a month — more than it earns.
              </p>
            </Callout>
          </Box>
        </Panel>
      </Grid>
    </>
  );
}

/* ================================================================== display */
function DisplayTab({ data }: { data: CampaignData }) {
  const { viewability, metrics } = data.display;
  const totalWasted = viewability.reduce((s, v) => s + (v.wasted ?? 0), 0);
  const totalSpend = viewability.reduce((s, v) => s + (v.spend ?? 0), 0);

  return (
    <>
      <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={4}>
        <Panel title="Viewability by marketplace"
          sub="MRC standard: 50% of pixels in view for 1 continuous second.">
          <Box display="flex" flexDirection="column" gap={2.5}>
            {viewability.map((v) => (
              <BarRow key={v.marketplace} label={v.marketplace} value={v.rate} max={100}
                color={v.isBenchmark ? "#8f9aab" : v.rate < 72 ? "#d03b3b" : "#2a78d6"}
                display={`${v.rate.toFixed(1)}%`} labelWidth="164px" />
            ))}
          </Box>
          <Text fontSize="12px" color={MUTED} mt={3}>
            Blended 68.4% — below the 72% cross-network average for 2026.
          </Text>
        </Panel>

        <Panel title="What we paid for that nobody could see"
          sub="Non-viewable impressions, costed at each marketplace's CPM.">
          <Box as="table" w="100%" fontSize="13px" style={{ borderCollapse: "collapse" }}>
            <Box as="thead">
              <Box as="tr">
                {["Marketplace", "Spend", "Viewable", "Wasted"].map((h, i) => (
                  <Box as="th" key={h} textAlign={i === 0 ? "left" : "right"} fontFamily="mono"
                    fontSize="9.5px" letterSpacing="0.11em" textTransform="uppercase" color={MUTED}
                    fontWeight={600} py={2} px={2} borderBottom="1px solid" borderColor="gray.300">{h}</Box>
                ))}
              </Box>
            </Box>
            <Box as="tbody">
              {viewability.filter((v) => !v.isBenchmark).map((v) => (
                <Box as="tr" key={v.marketplace} _hover={{ bg: "gray.50" }}>
                  <Box as="td" py={2.5} px={2} borderBottom="1px solid" borderColor={RULE}
                    fontWeight={600} color={INK}>{v.marketplace}</Box>
                  <Box as="td" py={2.5} px={2} borderBottom="1px solid" borderColor={RULE}
                    textAlign="right" fontFamily="mono" color="gray.600">{money(v.spend ?? 0)}</Box>
                  <Box as="td" py={2.5} px={2} borderBottom="1px solid" borderColor={RULE}
                    textAlign="right" fontFamily="mono" color="gray.600">{v.rate.toFixed(1)}%</Box>
                  <Box as="td" py={2.5} px={2} borderBottom="1px solid" borderColor={RULE}
                    textAlign="right" fontFamily="mono" fontWeight={700}
                    color={v.marketplace === "Open exchange" ? "red.500" : "gray.600"}>
                    {money(v.wasted ?? 0)}
                  </Box>
                </Box>
              ))}
              <Box as="tr">
                <Box as="td" py={2.5} px={2} fontWeight={700} color={INK}>Total</Box>
                <Box as="td" py={2.5} px={2} textAlign="right" fontFamily="mono" fontWeight={700} color={INK}>
                  {money(totalSpend)}
                </Box>
                <Box as="td" py={2.5} px={2} textAlign="right" fontFamily="mono" fontWeight={700} color={INK}>68.4%</Box>
                <Box as="td" py={2.5} px={2} textAlign="right" fontFamily="mono" fontWeight={700} color="red.500">
                  {money(totalWasted)}
                </Box>
              </Box>
            </Box>
          </Box>
          <Box mt={4}>
            <Callout tag="Finding" tone="finding">
              <p>
                <strong>{money(totalWasted)} — 28% of display spend — bought impressions nobody could
                see.</strong> Open exchange is almost all of it. Moving that budget to PMP at the same
                CPM recovers about $18,600 of working media for free.
              </p>
            </Callout>
          </Box>
        </Panel>
      </Grid>

      <Box mt={4}>
        <Panel>
          <Box as="table" w="100%" fontSize="13px" style={{ borderCollapse: "collapse" }}>
            <Box as="thead">
              <Box as="tr">
                {["Metric", "Value", "What it tells you"].map((h, i) => (
                  <Box as="th" key={h} textAlign={i === 1 ? "right" : "left"} fontFamily="mono"
                    fontSize="9.5px" letterSpacing="0.11em" textTransform="uppercase" color={MUTED}
                    fontWeight={600} py={2.5} px={3} borderBottom="1px solid" borderColor="gray.300"
                    bg="gray.50" whiteSpace="nowrap">{h}</Box>
                ))}
              </Box>
            </Box>
            <Box as="tbody">
              {metrics.map((m) => (
                <Box as="tr" key={m.metric} _hover={{ bg: "gray.50" }}>
                  <Box as="td" py={2.5} px={3} borderBottom="1px solid" borderColor={RULE}
                    fontWeight={600} color={INK} whiteSpace="nowrap">{m.metric}</Box>
                  <Box as="td" py={2.5} px={3} borderBottom="1px solid" borderColor={RULE}
                    textAlign="right" fontFamily="mono" color="gray.600">{m.value}</Box>
                  <Box as="td" py={2.5} px={3} borderBottom="1px solid" borderColor={RULE}
                    color="gray.600">{m.reads}</Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Panel>
      </Box>
    </>
  );
}
