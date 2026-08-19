import { Box } from "@chakra-ui/react";
import { money } from "./data";
import type { CampaignData } from "./types";
import { Callout, INK, MUTED, Panel, RULE, SectionHead } from "./ui";

/**
 * Every figure here is computed from the same JSON the charts read, so an action
 * can never quote a number the dashboard above has stopped showing.
 */
function buildActions(data: CampaignData) {
  const { subscriberValue, leadValue } = data.constants;
  const f = data.email.frequency;
  const now = f.find((r) => r.sends === 4)!;
  const fifth = f.find((r) => r.sends === 5)!;
  const fifthEarns = (fifth.conversions - now.conversions) * leadValue;
  const fifthCosts = (now.netList - fifth.netList) * subscriberValue;

  const v = data.display.viewability;
  const pmp = v.find((r) => r.marketplace === "Private marketplace")!;
  const open = v.find((r) => r.marketplace === "Open exchange")!;
  const pmpGain = (open.spend ?? 0) * ((pmp.rate - open.rate) / 100);

  const vid = data.channels.find((c) => c.key === "video")!.lift;
  const skipDrop = data.video.dropoff[0].skip;
  const skipRest = data.video.dropoff.slice(1).reduce((s, d) => s + d.skip, 0);

  return [
    { action: "Move display budget into online video",
      why: "One more order from display costs far more than an order is worth; from video it still costs less. The exact amounts move with the profit-per-order and required-return inputs above.",
      worth: "see panel", tone: "good", owner: "Media buying" },
    { action: "Hold email at 4 sends a month — do not add a 5th",
      why: `A 5th email earns ${money(fifthEarns)} in extra order profit and burns ${money(fifthCosts)} of subscriber value through unsubscribes. Put the extra budget into segmenting the list, not sending to it more often.`,
      worth: `${money(fifthCosts - fifthEarns)} saved`, tone: "good", owner: "CRM" },
    { action: "Move open-exchange display onto the private marketplace",
      why: `Open exchange is ${open.rate}% viewable against ${pmp.rate}% on PMP. Same CPM, more of the money actually reaching a screen.`,
      worth: `+${money(pmpGain)} working`, tone: "good", owner: "Media buying" },
    { action: "Rebuild the first 5 seconds of the skippable video",
      why: `${Math.abs(skipDrop).toFixed(1)} of the ${Math.abs(skipDrop + skipRest).toFixed(1)} points lost go at the skip button. We have no basis for forecasting how much a rebuild wins back, so no number is claimed.`,
      worth: "—", tone: "neutral", owner: "Creative" },
    { action: "Stop reporting email open rate",
      why: "Inflated 15–20 points by Apple Mail Privacy Protection. It has been driving false “the email is working” reads all year.",
      worth: "Trust", tone: "neutral", owner: "Analytics" },
    { action: "Buy a better-powered video lift test before moving the whole budget",
      why: `Video's lift is measured on ${vid.units}, so its interval runs from ${(vid.ciLow * 100).toFixed(0)}% to ${(vid.ciHigh * 100).toFixed(0)}% incremental — ${((vid.ciHigh - vid.ciLow) * 100).toFixed(0)} points wide. Stage the increase: commit what is safe at the bottom of that interval, re-test, then commit the rest.`,
      worth: "de-risks the move", tone: "good", owner: "Analytics" },
    { action: "Re-run all three lift tests every quarter",
      why: "How much the ads cause shifts with creative, season and saturation. These ratios have a shelf life.",
      worth: "—", tone: "neutral", owner: "Analytics" },
  ];
}

export default function Tables({ data }: { data: CampaignData }) {
  const ACTIONS = buildActions(data);
  return (
    <>
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
                  <Box as="td" py={3} px={3} fontWeight={600} color={INK}>Response curve per channel</Box>
                  <Box as="td" py={3} px={3} textAlign="right" fontFamily="mono" color={MUTED}>K, Cmax</Box>
                  <Box as="td" py={3} px={3}>
                    <Box as="span" fontFamily="mono" fontSize="10px" fontWeight={700} px={2} py="2px"
                      borderRadius="full" color="gray.500" border="1px solid" borderColor="gray.300">
                      Fitted
                    </Box>
                  </Box>
                  <Box as="td" py={3} px={3} color="gray.600" lineHeight={1.55}>
                    Half-saturation spend fitted from the geo holdout lift test. Everything on the
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
              <li><strong>A fixed dollar ceiling on what an order may cost.</strong> Replaced. It
              is now profit per order ÷ required return, both editable, cross-checked against what
              the budget can actually afford.</li>
              <li><strong>Deduped household reach.</strong> Removed. IP-to-postal matching is
              13–16% accurate, so any household count carried more error than signal.</li>
            </Box>
          </Callout>
        </Box>
      </Box>

    </>
  );
}


export { Callout };
