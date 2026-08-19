import { Box, HStack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { money, nf } from "./data";
import type { CampaignData, Channel, ChannelKey } from "./types";
import { Callout, INK, MUTED, Panel, RULE, SectionHead, Tag } from "./ui";

const ACTIONS = [
  { action: "Move $83K from display to online video",
    why: "Display's marginal cost per incremental conversion is $198 — more than double the $95 ceiling. Video's is $71.",
    worth: "+1,015 conv", tone: "good", owner: "Media buying" },
  { action: "Hold email at 4 sends — do not increase",
    why: "A 5th send earns $40K and destroys $244K of list asset. Put the extra budget into segmentation, not volume.",
    worth: "$204K saved", tone: "good", owner: "CRM" },
  { action: "Shift open-exchange display to PMP",
    why: "Open exchange is 61.2% viewable vs 84.6% on PMP. Same CPM, more working media.",
    worth: "+$18.6K working", tone: "good", owner: "Media buying" },
  { action: "Rebuild the first 5 seconds of skippable video",
    why: "28.6 of the 37.2 points lost happen at the skip decision. Everything after it is already fine.",
    worth: "~+6 pts VCR", tone: "neutral", owner: "Creative" },
  { action: "Stop reporting email open rate",
    why: "Inflated 15–20 pts by Apple MPP. It has been driving false “our email is working” reads all year.",
    worth: "Trust", tone: "neutral", owner: "Analytics" },
  { action: "Re-run the lift test in 6 weeks",
    why: "Incrementality shifts as the mix changes. These ratios have a shelf life.",
    worth: "—", tone: "neutral", owner: "Analytics" },
];

export default function Tables({
  data, channel, setChannel,
}: {
  data: CampaignData;
  channel: ChannelKey | null;
  setChannel: (c: ChannelKey | null) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const byKey = Object.fromEntries(data.channels.map((c) => [c.key, c])) as Record<ChannelKey, Channel>;
  const rows = data.creatives
    .filter((c) => !channel || c.channel === channel)
    .sort((a, b) => a.cpic - b.cpic);

  return (
    <>
      <Box mt={12}>
        <SectionHead
          title="Creative performance"
          sub="Ranked by cost per incremental conversion. Click any row to drill into placement-level detail."
        />
        {channel && (
          <HStack mb={3} spacing={2}>
            <Text fontSize="12px" color={MUTED} fontFamily="mono">
              Showing {byKey[channel].label} only.
            </Text>
            <Box as="button" type="button" onClick={() => setChannel(null)}
              fontSize="12px" fontFamily="mono" color="blue.500" textDecoration="underline"
              _hover={{ color: "blue.700" }}>
              Show all channels
            </Box>
          </HStack>
        )}
        <Panel p={0} overflow="hidden">
          <Box overflowX="auto">
            <Box as="table" w="100%" minW="760px" fontSize="13px" style={{ borderCollapse: "collapse" }}>
              <Box as="thead">
                <Box as="tr">
                  {["Creative", "Spend", "Imps / sends", "Completion", "Conv.", "CPiC", "Verdict"].map((h, i) => (
                    <Box as="th" key={h} textAlign={i === 0 || i === 6 ? "left" : "right"}
                      fontFamily="mono" fontSize="9.5px" letterSpacing="0.11em" textTransform="uppercase"
                      color={MUTED} fontWeight={600} py={3} px={3} borderBottom="1px solid"
                      borderColor="gray.300" bg="gray.50" whiteSpace="nowrap">{h}</Box>
                  ))}
                </Box>
              </Box>
              <Box as="tbody">
                {rows.map((c) => {
                  const isOpen = open[c.id];
                  return (
                    <Box as={"tbody" as const} key={c.id} display="table-row-group">
                      <Box as="tr" cursor="pointer" _hover={{ bg: "gray.50" }}
                        onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
                        role="button" tabIndex={0}
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpen((o) => ({ ...o, [c.id]: !o[c.id] }));
                          }
                        }}>
                        <Box as="td" py={2.5} px={3} borderBottom="1px solid" borderColor={RULE}
                          fontWeight={600} color={INK}>
                          <HStack spacing={2}>
                            <Text as="span" fontFamily="mono" color="gray.400" fontSize="11px">
                              {isOpen ? "▾" : "▸"}
                            </Text>
                            <Box w="8px" h="8px" borderRadius="2px" bg={byKey[c.channel].color} flex="0 0 auto" />
                            <Text>{c.name}</Text>
                          </HStack>
                        </Box>
                        {[money(c.spend), nf(c.units), c.completion ? `${c.completion}%` : "—",
                          nf(c.conversions), money(c.cpic, 2)].map((v, i) => (
                          <Box as="td" key={i} py={2.5} px={3} borderBottom="1px solid" borderColor={RULE}
                            textAlign="right" fontFamily="mono" whiteSpace="nowrap"
                            color={i === 4 ? INK : "gray.600"} fontWeight={i === 4 ? 700 : 400}>{v}</Box>
                        ))}
                        <Box as="td" py={2.5} px={3} borderBottom="1px solid" borderColor={RULE}>
                          <Tag kind={c.verdict} />
                        </Box>
                      </Box>
                      {isOpen &&
                        c.placements.map((p) => (
                          <Box as="tr" key={p.name} bg="gray.50">
                            <Box as="td" py={2} px={3} pl={12} borderBottom="1px solid" borderColor={RULE}
                              color="gray.600" fontSize="12.5px">{p.name}</Box>
                            {[money(p.spend), nf(p.units), "—", nf(p.conversions), money(p.cpic, 2)].map((v, i) => (
                              <Box as="td" key={i} py={2} px={3} borderBottom="1px solid" borderColor={RULE}
                                textAlign="right" fontFamily="mono" color="gray.600" fontSize="12.5px"
                                whiteSpace="nowrap">{v}</Box>
                            ))}
                            <Box as="td" borderBottom="1px solid" borderColor={RULE} />
                          </Box>
                        ))}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        </Panel>
        <Text fontSize="11.5px" color={MUTED} mt={2} fontFamily="mono">
          Creative-level CPiC is directional — the lift test powers to channel level, not creative.
        </Text>
      </Box>

      <Box mt={12}>
        <SectionHead title="What to do next" sub="Ordered by value, with the number that justifies each." />
        <Panel p={0} overflow="hidden">
          <Box overflowX="auto">
            <Box as="table" w="100%" minW="720px" fontSize="13px" style={{ borderCollapse: "collapse" }}>
              <Box as="thead">
                <Box as="tr">
                  {["Action", "Why", "Worth", "Owner"].map((h, i) => (
                    <Box as="th" key={h} textAlign={i === 2 ? "right" : "left"} fontFamily="mono"
                      fontSize="9.5px" letterSpacing="0.11em" textTransform="uppercase" color={MUTED}
                      fontWeight={600} py={3} px={3} borderBottom="1px solid" borderColor="gray.300"
                      bg="gray.50" whiteSpace="nowrap">{h}</Box>
                  ))}
                </Box>
              </Box>
              <Box as="tbody">
                {ACTIONS.map((a) => (
                  <Box as="tr" key={a.action} _hover={{ bg: "gray.50" }}>
                    <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor={RULE}
                      fontWeight={600} color={INK}>{a.action}</Box>
                    <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor={RULE}
                      color="gray.600">{a.why}</Box>
                    <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor={RULE}
                      textAlign="right" fontFamily="mono" fontWeight={a.tone === "good" ? 700 : 400}
                      color={a.tone === "good" ? "green.600" : "gray.600"} whiteSpace="nowrap">{a.worth}</Box>
                    <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor={RULE}
                      color="gray.600" whiteSpace="nowrap">{a.owner}</Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Panel>
      </Box>

      <Box mt={12}>
        <SectionHead title="Why these metrics"
          sub="The design decisions behind the dashboard — the part worth defending in a review." />
        <Box display="flex" flexDirection="column" gap={4}>
          <Method n="1" title="Clicks can't be the comparison currency">
            <p>
              The obvious dashboard headlines Total Clicks and Click Rate. That ranking is decided
              before you look at it: email's click rate on delivered runs around <strong>2.09%</strong>{" "}
              and display's around <strong>0.09%</strong> — a 23× gap that says nothing about which
              drove more business. Different denominators over different audiences. Email reaches
              people who already opted in; display reaches cold prospects. And on non-skippable video
              the click is close to meaningless.
            </p>
            <p>
              So every channel is compared on <strong>cost per incremental conversion</strong>, and
              channel-native metrics stay in the diagnostics tabs where they belong.
            </p>
          </Method>
          <Method n="2" title="Attribution model is a control, not an assumption">
            <p>
              Flip the toggle at the top and the ranking inverts. On last-touch, email costs{" "}
              <strong>$3.74</strong> per conversion and looks 15× better than video. Lift-tested, only{" "}
              <strong>25%</strong> of email conversions were incremental — the rest were people who'd
              have bought anyway. Display is worse still at <strong>27%</strong>, because 64% of its
              spend is retargeting.
            </p>
            <p>
              Putting both models one click apart is what ends the argument. Hiding the one you don't
              like is what starts it.
            </p>
          </Method>
          <Method n="3" title="Efficiency ranking doesn't answer the question that was asked">
            <p>
              Even lift-tested, email wins on cost — $14.97 per incremental conversion. But the goal
              is <em>"run more of what works."</em> Email can't absorb more budget: the list is finite
              and mailing it harder burns it. The decision metric is <strong>marginal</strong> cost at
              the next increment of spend, not average cost at the current one.
            </p>
            <p>
              That's why the reallocation panel sits directly under the ranking. Average efficiency
              tells you who's winning; marginal efficiency tells you where to put the money.
            </p>
          </Method>
          <Method n="4" title="What this dashboard deliberately doesn't do">
            <Box as="ul" pl={5} sx={{ "& li": { mb: 1.5 } }}>
              <li><strong>No cross-channel rate comparisons.</strong> No chart puts email CTR next to display CTR. The layout makes the invalid comparison impossible rather than trusting people not to make it.</li>
              <li><strong>No forecasting past the tested range.</strong> The marginal curves stop where the lift test has support. Extrapolating to 3× spend would be fabrication.</li>
              <li><strong>No creative-level incrementality.</strong> The lift test powers to channel level. Creative rows inherit channel ratios and are labelled directional.</li>
              <li><strong>No real-time refresh.</strong> Daily at 06:00. A number that moves mid-meeting loses the room.</li>
            </Box>
          </Method>
        </Box>
      </Box>
    </>
  );
}

function Method({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <Box>
      <HStack spacing={3} align="baseline" mb={2}>
        <Text fontFamily="mono" fontSize="12px" fontWeight={700} color="gray.400">{n}</Text>
        <Text fontSize="17px" fontWeight={700} letterSpacing="-0.012em" color={INK}>{title}</Text>
      </HStack>
      <Box pl={{ base: 0, md: 7 }} fontSize="14.5px" color="gray.600" lineHeight={1.65}
        maxW="76ch" sx={{ "& p + p": { mt: 3 } }}>
        {children}
      </Box>
    </Box>
  );
}

export { Callout };
