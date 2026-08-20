/**
 * Where impressions end up: stopped, clicked and stopped, or clicked and
 * converted.
 *
 * Drawn as two bars rather than one. A single stacked bar of impressions is
 * honest but says nothing -- 99.5% stop at the impression, so both other
 * segments are sub-pixel. Each bar therefore declares its own base: the first
 * splits impressions, the second splits the clicks the first one found. The
 * three end-states are then stated in full underneath, against impressions, so
 * the real scale is never hidden.
 */
import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { compact, nf, pct } from "./data";
import type { View } from "./data";
import { Label, MONO, Panel, T } from "./ui";

function StageBar({ base, parts }: {
  base: string;
  parts: { label: string; value: number; color: string; faint?: boolean }[];
}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <Box>
      <Label as="div" mb={1.5}>{base}</Label>
      <Flex h="26px" borderRadius="4px" overflow="hidden" gap="2px" bg={T.bg}>
        {parts.map((p) => (
          <Box key={p.label} bg={p.color} opacity={p.faint ? 0.45 : 1} minW="3px"
            flex={`0 0 ${Math.max(0.4, (p.value / total) * 100)}%`}
            transition="flex-basis .3s" />
        ))}
      </Flex>
      <Flex mt={2} gap={5} wrap="wrap">
        {parts.map((p) => (
          <Flex key={p.label} align="baseline" gap={1.5}>
            <Box w="8px" h="8px" borderRadius="2px" bg={p.color} opacity={p.faint ? 0.45 : 1}
              flex="0 0 auto" position="relative" top="-1px" />
            <Text fontSize="11.5px" color={T.muted}>{p.label}</Text>
            <Text fontFamily={MONO} fontSize="12px" fontWeight={600} color={T.ink}
              sx={{ fontVariantNumeric: "tabular-nums" }}>{nf(p.value)}</Text>
            <Text fontFamily={MONO} fontSize="10.5px" color={T.dim}>{pct(p.value / total, 2)}</Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
}

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
      <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={{ base: 5, lg: 8 }}>
        <StageBar base={`Of ${nf(impressions)} impressions`} parts={[
          { label: "Stopped", value: stopped, color: T.dim, faint: true },
          { label: "Clicked", value: clicks, color: T.ramp[4] },
        ]} />
        <StageBar base={`Of ${nf(clicks)} clicks`} parts={[
          { label: "No conversion", value: clickedOnly, color: T.ramp[4], faint: true },
          { label: "Converted", value: conversions, color: T.up },
        ]} />
      </Grid>

      <Box mt={5} pt={4} borderTop="1px solid" borderColor={T.lineSoft}>
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
        <Box mt={5} pt={4} borderTop="1px solid" borderColor={T.lineSoft}>
          <Label as="div" mb={2.5}>Shape by media type</Label>
          <Flex direction="column" gap={3}>
            {v.media.map((m) => {
              const x = v.byMedia[m.key];
              if (!x.impressions) return null;
              const ctr = x.clicks / x.impressions;
              const cvr = x.clicks > 0 ? x.conversions / x.clicks : 0;
              // Each rate is scaled against the best in this selection, so the
              // two columns compare within themselves and never with each other.
              const maxCtr = Math.max(...v.media.map((y) =>
                v.byMedia[y.key].impressions ? v.byMedia[y.key].clicks / v.byMedia[y.key].impressions : 0));
              const maxCvr = Math.max(...v.media.map((y) =>
                v.byMedia[y.key].clicks ? v.byMedia[y.key].conversions / v.byMedia[y.key].clicks : 0));
              return (
                <Grid key={m.key} templateColumns={{ base: "1fr", sm: "104px 1fr 1fr" }}
                  gap={{ base: 1.5, sm: 4 }} alignItems="center">
                  <Flex align="center" gap={1.5}>
                    <Box w="9px" h="9px" borderRadius="2px" bg={m.color} flex="0 0 auto" />
                    <Text fontSize="12px" color={T.muted} noOfLines={1}>{m.label}</Text>
                  </Flex>
                  {[
                    { rate: ctr, max: maxCtr, note: "impression to click", color: T.ramp[4], dp: 2 },
                    { rate: cvr, max: maxCvr, note: "click to conversion", color: T.up, dp: 1 },
                  ].map((c) => (
                    <Flex key={c.note} align="center" gap={2.5} minW={0}>
                      <Box flex="1" bg={T.bg} borderRadius="3px" h="13px" overflow="hidden" minW={0}>
                        <Box h="100%" bg={c.color} borderRadius="0 3px 3px 0" opacity={0.85}
                          w={`${c.max > 0 ? (c.rate / c.max) * 100 : 0}%`} transition="width .3s" />
                      </Box>
                      <Text fontFamily={MONO} fontSize="11.5px" color={T.ink} w="52px"
                        textAlign="right" flex="0 0 auto"
                        sx={{ fontVariantNumeric: "tabular-nums" }}>{pct(c.rate, c.dp)}</Text>
                      <Text fontSize="10.5px" color={T.dim} w="120px" flex="0 0 auto"
                        display={{ base: "none", lg: "block" }}>{c.note}</Text>
                    </Flex>
                  ))}
                </Grid>
              );
            })}
          </Flex>
        </Box>
      )}
    </Panel>
  );
}
