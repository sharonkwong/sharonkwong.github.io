/**
 * Where impressions end up: stopped, clicked and stopped, or clicked and
 * converted.
 *
 * The three end-states are stated as counts against impressions rather than
 * drawn as a stacked bar. A bar would be honest and say nothing -- 99.5% stop
 * at the impression, so both other segments come out sub-pixel.
 *
 * The per-media table underneath names each stage once as a column heading.
 * Each column scales against the best value in that column, so the bars
 * compare within a stage and never across the two: an impression-to-click rate
 * and a click-to-conversion rate share no denominator.
 */
import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { compact, nf, pct } from "./data";
import type { View } from "./data";
import { Label, MONO, Panel, T } from "./ui";

export default function Funnel({ v }: { v: View }) {
  const { impressions, clicks, conversions } = v.totals;
  if (impressions === 0) {
    return <Panel><Text fontSize="13px" color={T.muted}>Nothing delivered in this selection.</Text></Panel>;
  }
  const stopped = impressions - clicks;
  const clickedOnly = clicks - conversions;

  const ends = [
    { label: "Impression, stopped", value: stopped, color: T.dim },
    { label: "Impression to click, stopped", value: clickedOnly, color: T.ramp[4] },
    { label: "Impression to click to conversion", value: conversions, color: T.up },
  ];

  return (
    <Panel right={
      <Text fontFamily={MONO} fontSize="10.5px" color={T.dim}>
        {compact(impressions)} impressions
      </Text>
    }>
      <Box>
        <Label as="div" mb={2.5}>Every impression ends in one of three places</Label>
        <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
          {ends.map((e) => (
            <Box key={e.label} borderTop="2px solid" borderColor={e.color} pt={2}>
              <Text fontSize="11.5px" color={T.muted} mb={1} noOfLines={2} minH="30px">{e.label}</Text>
              <Flex align="baseline" gap={2}>
                <Text fontFamily={MONO} fontSize="17px" fontWeight={600} color={T.ink}
                  sx={{ fontVariantNumeric: "tabular-nums" }}>{nf(e.value)}</Text>
                <Text fontFamily={MONO} fontSize="11px" color={T.dim}>
                  {pct(e.value / impressions, e.value / impressions < 0.01 ? 3 : 1)}
                </Text>
              </Flex>
            </Box>
          ))}
        </Grid>
      </Box>

      {v.media.length > 1 && (
        <Box mt={6} pt={5} borderTop="1px solid" borderColor={T.lineSoft}>
          <Label as="div" mb={3}>Shape by media type</Label>
          {(() => {
            const stages = [
              { key: "ctr" as const, head: "Impression to click", color: T.ramp[4], dp: 2 },
              { key: "cvr" as const, head: "Click to conversion", color: T.up, dp: 1 },
            ];
            const rows = v.media
              .filter((m) => v.byMedia[m.key].impressions > 0)
              .map((m) => {
                const x = v.byMedia[m.key];
                return {
                  ...m,
                  ctr: x.clicks / x.impressions,
                  cvr: x.clicks > 0 ? x.conversions / x.clicks : 0,
                };
              });
            // Each column is scaled against the best in that column, so the
            // bars compare within a stage and never across the two.
            const max = Object.fromEntries(stages.map((s) =>
              [s.key, Math.max(...rows.map((r) => r[s.key]), 0.0001)]));
            const cols = { base: "1fr", md: "128px 1fr 1fr" };
            return (
              <>
                <Grid templateColumns={cols} gap={{ base: 2, md: 7 }}
                  display={{ base: "none", md: "grid" }} mb={2}>
                  <Box />
                  {stages.map((s) => (
                    <Label key={s.key} pb={1.5} borderBottom="1px solid" borderColor={T.lineSoft}>
                      {s.head}
                    </Label>
                  ))}
                </Grid>
                <Flex direction="column" gap={{ base: 4, md: 3 }}>
                  {rows.map((m) => (
                    <Grid key={m.key} templateColumns={cols} gap={{ base: 1.5, md: 7 }}
                      alignItems="center">
                      <Flex align="center" gap={1.5}>
                        <Box w="9px" h="9px" borderRadius="2px" bg={m.color} flex="0 0 auto" />
                        <Text fontSize="12.5px" color={T.ink} noOfLines={1}>{m.label}</Text>
                      </Flex>
                      {stages.map((s) => (
                        <Flex key={s.key} align="center" gap={2.5} minW={0}>
                          <Text fontSize="10.5px" color={T.dim} flex="0 0 auto"
                            display={{ base: "block", md: "none" }} w="104px" noOfLines={1}>
                            {s.head}
                          </Text>
                          <Box flex="1" bg={T.bg} borderRadius="3px" h="16px" overflow="hidden" minW={0}>
                            <Box h="100%" bg={s.color} borderRadius="0 3px 3px 0" opacity={0.85}
                              w={`${(m[s.key] / max[s.key]) * 100}%`} transition="width .3s" />
                          </Box>
                          <Text fontFamily={MONO} fontSize="12.5px" fontWeight={600} color={T.ink}
                            w="54px" textAlign="right" flex="0 0 auto"
                            sx={{ fontVariantNumeric: "tabular-nums" }}>
                            {pct(m[s.key], s.dp)}
                          </Text>
                        </Flex>
                      ))}
                    </Grid>
                  ))}
                </Flex>
              </>
            );
          })()}
        </Box>
      )}
    </Panel>
  );
}
