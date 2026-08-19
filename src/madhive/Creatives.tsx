import { Box, Grid, HStack, Text } from "@chakra-ui/react";
import { money, nf } from "./data";
import type { CampaignData, ChannelKey, Creative } from "./types";
import { INK, MUTED, Panel, RULE, SectionHead, Tag } from "./ui";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const pct = (v: number, dp = 1) => `${(v * 100).toFixed(dp)}%`;

/* ---------------------------------------------------------------- preview */
function Preview({ c }: { c: Creative }) {
  if (c.assetKind === "video") {
    return (
      <Box position="relative" borderRadius="6px" overflow="hidden" bg="gray.900"
        border="1px solid" borderColor={RULE}>
        <Box as="video" src={c.asset} poster={c.poster ?? undefined} controls muted playsInline
          preload="none" w="100%" display="block" sx={{ aspectRatio: "16 / 9" }} />
      </Box>
    );
  }
  return (
    <Box borderRadius="6px" overflow="hidden" border="1px solid" borderColor={RULE}
      bg="gray.50" display="flex" alignItems="center" justifyContent="center" p={2}>
      <Box as="img" src={c.asset} alt={`${c.name} creative`} maxH="140px" maxW="100%"
        display="block" borderRadius="3px" />
    </Box>
  );
}

/* ------------------------------------------------------------- metric row */
function M({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Box>
      <Text fontFamily={MONO} fontSize="8.5px" letterSpacing="0.1em" textTransform="uppercase"
        color={MUTED} fontWeight={600}>{label}</Text>
      <Text fontFamily={MONO} fontSize="13px" fontWeight={700}
        color={warn ? "red.500" : INK}>{value}</Text>
    </Box>
  );
}

/** Metrics differ by channel because what a creative can emit differs. */
function CreativeMetrics({ c }: { c: Creative }) {
  const m = c.metrics;
  if (c.channel === "video") {
    const q = [m.q25, m.q50, m.q75, m.q100] as number[];
    return (
      <>
        <Grid templateColumns="repeat(3, 1fr)" gap={3} mb={3}>
          <M label="Completion" value={pct(m.q100 as number)} />
          <M label="Cost / completed view" value={`$${(m.cpcv as number).toFixed(3)}`} />
          <M label="Viewable" value={pct(m.viewability as number)} />
        </Grid>
        <Text fontFamily={MONO} fontSize="8.5px" letterSpacing="0.1em" textTransform="uppercase"
          color={MUTED} fontWeight={600} mb={1.5}>Quartile retention</Text>
        <HStack spacing="3px" align="flex-end" h="34px">
          {q.map((v, i) => (
            <Box key={i} flex="1" bg={v < 0.7 ? "orange.300" : "orange.400"}
              h={`${Math.max(8, v * 100)}%`} borderRadius="2px 2px 0 0"
              title={`${[25, 50, 75, 100][i]}%: ${pct(v)}`} />
          ))}
        </HStack>
        <HStack spacing="3px" mt={1}>
          {["25", "50", "75", "100"].map((l) => (
            <Text key={l} flex="1" textAlign="center" fontFamily={MONO} fontSize="8px" color={MUTED}>{l}</Text>
          ))}
        </HStack>
      </>
    );
  }
  if (c.channel === "email") {
    return (
      <Grid templateColumns="repeat(3, 1fr)" gap={3} rowGap={3}>
        <M label="Delivered" value={nf(m.delivered as number)} />
        <M label="Click rate" value={pct(m.clickRate as number, 2)} />
        <M label="Unsubscribe" value={pct(m.unsubRate as number, 2)}
          warn={(m.unsubRate as number) > 0.005} />
        <Box gridColumn="span 3">
          <Text fontFamily={MONO} fontSize="8.5px" letterSpacing="0.1em" textTransform="uppercase"
            color={MUTED} fontWeight={600}>Opens</Text>
          <HStack spacing={2} align="baseline">
            <Text fontFamily={MONO} fontSize="13px" fontWeight={700} color={INK}>
              {pct(m.openRateModelled as number)}
            </Text>
            <Text fontFamily={MONO} fontSize="10.5px" color={MUTED}>
              modelled · {pct(m.openRateReported as number)} reported before MPP
            </Text>
          </HStack>
        </Box>
      </Grid>
    );
  }
  return (
    <Grid templateColumns="repeat(3, 1fr)" gap={3}>
      <M label="Clicks" value={nf(m.clicks as number)} />
      <M label="Viewable" value={pct(m.viewability as number)}
        warn={(m.viewability as number) < 0.72} />
      <M label="Time in view" value={`${(m.timeInView as number).toFixed(1)}s`} />
    </Grid>
  );
}

/* -------------------------------------------------- per-channel widget */
export function ChannelCreatives({ data, channel }: { data: CampaignData; channel: ChannelKey }) {
  const rows = data.creatives
    .filter((c) => c.channel === channel)
    .sort((a, b) => b.conversions - a.conversions);
  return (
    <Box mt={4}>
      <Panel title="Creative performance"
        sub="Only this channel's ads, ranked by orders. The metrics are the ones this format can actually emit.">
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
          {rows.map((c) => (
            <Box key={c.id} border="1px solid" borderColor={RULE} borderRadius="8px" p={4} bg="white">
              <Preview c={c} />
              <HStack justify="space-between" align="baseline" mt={3} mb={1} gap={2} wrap="wrap">
                <Text fontSize="13.5px" fontWeight={700} color={INK}>{c.name}</Text>
                <Tag kind={c.verdict} />
              </HStack>
              <Text fontFamily={MONO} fontSize="10.5px" color={MUTED} mb={3}>
                {c.format} · {money(c.spend)} spend · {nf(c.conversions)} orders · {money(c.cpa, 2)} per order
              </Text>
              <CreativeMetrics c={c} />
            </Box>
          ))}
        </Grid>
      </Panel>
    </Box>
  );
}

/* ------------------------------------------------- overall ranking */
export function CreativeRanking({ data }: { data: CampaignData }) {
  const rows = [...data.creatives].sort((a, b) => b.conversions - a.conversions);
  const max = rows[0].conversions;
  const byKey = Object.fromEntries(data.channels.map((c) => [c.key, c]));
  return (
    <Box mt={12}>
      <SectionHead title="Creative performance — all channels"
        sub="Every ad ranked by orders, with the cost of each order alongside — because the top of this list is not always the top of that one." />
      <Panel>
        <Box display="flex" flexDirection="column" gap={3}>
          {rows.map((c, i) => {
            const ch = byKey[c.channel];
            return (
              <Box key={c.id} display="grid"
                gridTemplateColumns={{ base: "1fr", sm: "22px minmax(160px, 250px) 1fr 92px 78px" }}
                gap={{ base: 1, sm: 3 }} alignItems="center">
                <Text fontFamily={MONO} fontSize="11px" color={MUTED} textAlign="right">{i + 1}</Text>
                <HStack spacing={2} minW={0}>
                  <Box w="8px" h="8px" borderRadius="2px" bg={ch.color} flex="0 0 auto" />
                  <Text fontSize="13px" color={INK} fontWeight={600} noOfLines={1}>{c.name}</Text>
                </HStack>
                <Box bg="gray.100" borderRadius="4px" h="18px" position="relative" overflow="hidden">
                  <Box position="absolute" left={0} top={0} bottom={0} bg={ch.color}
                    borderRadius="0 4px 4px 0" w={`${(c.conversions / max) * 100}%`} />
                </Box>
                <Text fontFamily={MONO} fontSize="12.5px" fontWeight={700} color={INK}
                  textAlign="right">{nf(c.conversions)}</Text>
                <Text fontFamily={MONO} fontSize="12px" color={MUTED} textAlign="right">
                  {money(c.cpa, 2)}
                </Text>
              </Box>
            );
          })}
        </Box>
        <HStack spacing={5} mt={4} pt={3} borderTop="1px solid" borderColor={RULE} wrap="wrap">
          {data.channels.map((c) => (
            <HStack key={c.key} spacing={1.5}>
              <Box w="10px" h="10px" borderRadius="2px" bg={c.color} />
              <Text fontSize="12px" color="gray.600">{c.label}</Text>
            </HStack>
          ))}
          <Text fontSize="12px" color={MUTED} ml="auto" fontFamily={MONO}>
            bars = orders · right column = cost per order
          </Text>
        </HStack>
      </Panel>
    </Box>
  );
}
