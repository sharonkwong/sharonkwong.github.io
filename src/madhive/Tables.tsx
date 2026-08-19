import { Box, HStack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { money, nf } from "./data";
import type { CampaignData, Channel, ChannelKey } from "./types";
import { Callout, INK, MUTED, Panel, RULE, SectionHead, Tag } from "./ui";

const ACTIONS = [
  { action: "Shift display budget into online video",
    why: "Display's next conversion costs far more than the ceiling; video's is well under it. Exact amounts move with the lead-value and return inputs above.",
    worth: "see panel", tone: "good", owner: "Media buying" },
  { action: "Hold email at 4 sends — do not increase",
    why: "A 5th send earns $40K and destroys $244K of list asset. Put the extra budget into segmentation, not volume.",
    worth: "$204K saved", tone: "good", owner: "CRM" },
  { action: "Shift open-exchange display to PMP",
    why: "Open exchange is 61.2% viewable vs 84.6% on PMP. Same CPM, more working media.",
    worth: "+$18.6K working", tone: "good", owner: "Media buying" },
  { action: "Rebuild the first 5 seconds of skippable video",
    why: "28.6 of the 37.2 points lost happen at the skip decision. We have no basis to forecast how much a rebuild recovers, so no number is claimed.",
    worth: "—", tone: "neutral", owner: "Creative" },
  { action: "Stop reporting email open rate",
    why: "Inflated 15–20 pts by Apple MPP. It has been driving false “our email is working” reads all year.",
    worth: "Trust", tone: "neutral", owner: "Analytics" },
  { action: "Buy a better-powered video lift test before the full budget move",
    why: "Video's lift is measured on 18 DMA pairs, so its interval is 24 points wide. The right increase is anywhere from +$21K to +$117K. Stage the move: commit what is safe at the bottom of the interval, test, then commit the rest.",
    worth: "de-risks $95K", tone: "good", owner: "Analytics" },
  { action: "Re-run all three lift tests quarterly",
    why: "Incrementality shifts with creative, season and saturation. These ratios have a shelf life.",
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
    .sort((a, b) => a.cpa - b.cpa);

  return (
    <>
      <Box mt={12}>
        <SectionHead
          title="Creative performance"
          sub="Ranked by cost per conversion. Click a row for placement detail."
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
                  {["Creative", "Spend", "Imps / sends", "Completion", "Conv.", "CPA", "Verdict"].map((h, i) => (
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
                          nf(c.conversions), money(c.cpa, 2)].map((v, i) => (
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
                            {[money(p.spend), nf(p.units), "—", nf(p.conversions), money(p.cpa, 2)].map((v, i) => (
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
        <SectionHead
          title="Assumptions"
          sub="Every number here that isn't directly measured, and why it is what it is. Anything we couldn't justify was taken off the dashboard rather than guessed."
        />
        <Panel p={0} overflow="hidden">
          <Box overflowX="auto">
            <Box as="table" w="100%" minW="700px" fontSize="13px" style={{ borderCollapse: "collapse" }}>
              <Box as="thead">
                <Box as="tr">
                  {["Input", "Value", "Type", "Basis"].map((hd, i) => (
                    <Box as="th" key={hd} textAlign={i === 1 ? "right" : "left"} fontFamily="mono"
                      fontSize="9.5px" letterSpacing="0.11em" textTransform="uppercase" color={MUTED}
                      fontWeight={600} py={3} px={3} borderBottom="1px solid" borderColor="gray.300"
                      bg="gray.50" whiteSpace="nowrap">{hd}</Box>
                  ))}
                </Box>
              </Box>
              <Box as="tbody">
                {data.assumptions.map((a) => (
                  <Box as="tr" key={a.key} _hover={{ bg: "gray.50" }}>
                    <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor={RULE}
                      fontWeight={600} color={INK} whiteSpace="nowrap">{a.label}</Box>
                    <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor={RULE}
                      textAlign="right" fontFamily="mono" color={INK} fontWeight={700} whiteSpace="nowrap">
                      {a.unit === "$" ? money(a.value) : `${a.value}${a.unit}`}
                    </Box>
                    <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor={RULE} whiteSpace="nowrap">
                      <Box as="span" fontFamily="mono" fontSize="10px" fontWeight={700} px={2} py="2px"
                        borderRadius="full"
                        bg={a.adjustable ? "orange.100" : "transparent"}
                        color={a.adjustable ? "orange.800" : "gray.500"}
                        border={a.adjustable ? undefined : "1px solid"} borderColor="gray.300">
                        {a.adjustable ? "Editable input" : "Measured"}
                      </Box>
                    </Box>
                    <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor={RULE}
                      color="gray.600" lineHeight={1.55}>{a.basis}</Box>
                  </Box>
                ))}
                <Box as="tr">
                  <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor={RULE}
                    fontWeight={600} color={INK}>Deduped household reach</Box>
                  <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor={RULE}
                    textAlign="right" fontFamily="mono" color={INK} fontWeight={700} whiteSpace="nowrap">
                    {nf(data.reach.dedupedLow / 1000)}K–{nf(data.reach.dedupedHigh / 1000)}K
                  </Box>
                  <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor={RULE} whiteSpace="nowrap">
                    <Box as="span" fontFamily="mono" fontSize="10px" fontWeight={700} px={2} py="2px"
                      borderRadius="full" bg="orange.100" color="orange.800">Modelled range</Box>
                  </Box>
                  <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor={RULE}
                    color="gray.600" lineHeight={1.55}>
                    {data.reach.method}
                    <Text fontFamily="mono" fontSize="11px" color={MUTED} mt={1}>
                      Source: {data.reach.source}
                    </Text>
                  </Box>
                </Box>
                <Box as="tr">
                  <Box as="td" py={3} px={3} fontWeight={600} color={INK}>Response curve per channel</Box>
                  <Box as="td" py={3} px={3} textAlign="right" fontFamily="mono" color={MUTED}>K, Cmax</Box>
                  <Box as="td" py={3} px={3}>
                    <Box as="span" fontFamily="mono" fontSize="10px" fontWeight={700} px={2} py="2px"
                      borderRadius="full" color="gray.500" border="1px solid" borderColor="gray.300">
                      Fitted
                    </Box>
                  </Box>
                  <Box as="td" py={3} px={3} color="gray.600" lineHeight={1.55}>
                    Half-saturation spend fitted from the geo-holdout lift test. Everything on the
                    marginal chart and the reallocation is computed from these two numbers per
                    channel — there is no second, hand-written table that could drift out of step.
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Panel>
        <Box mt={4}>
          <Callout tag="Taken off the dashboard" tone="warn">
            <Box as="ul" pl={5} sx={{ "& li": { mb: 1.5 } }}>
              <li><strong>"~+6 points of VCR" from rebuilding the skippable open.</strong> A guess.
              The action stays — the forecast doesn't.</li>
              <li><strong>Fixed $95 ceiling.</strong> Replaced. It is now lead value ÷ required
              return, both editable, cross-checked against what the budget can actually afford.</li>
            </Box>
          </Callout>
        </Box>
      </Box>

    </>
  );
}


export { Callout };
