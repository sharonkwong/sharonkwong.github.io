import { Box, ChakraProvider, Flex, Spinner, Text, extendTheme } from "@chakra-ui/react";
import React from "react";
import ReactDOM from "react-dom/client";
import Converts from "./Converts";
import Creatives from "./Creatives";
import Delivery from "./Delivery";
import FilterBar from "./Filters";
import Summary from "./Summary";
import TopLine from "./TopLine";
import { compact, daysBetween, money, nf, useData, useFilters, useView } from "./data";
import { Label, MONO, SectionTitle, T } from "./ui";

const theme = extendTheme({
  config: { initialColorMode: "dark", useSystemColorMode: false },
  styles: { global: { "html, body": { background: T.bg, color: T.ink } } },
  fonts: {
    heading: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
    body: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
    mono: MONO,
  },
});

function Page() {
  const { data, error } = useData();
  const [f, set] = useFilters(data);
  const v = useView(data, f);

  if (error) {
    return (
      <Flex minH="70vh" align="center" justify="center" direction="column" gap={2}>
        <Text color={T.ink} fontWeight={600}>Couldn't load the campaign data.</Text>
        <Text fontFamily={MONO} fontSize="13px" color={T.muted}>{error}</Text>
      </Flex>
    );
  }
  if (!data || !f || !v) {
    return (
      <Flex minH="70vh" align="center" justify="center" gap={3}>
        <Spinner size="sm" color={T.dim} />
        <Text fontSize="13px" color={T.muted}>Loading…</Text>
      </Flex>
    );
  }

  const days = daysBetween(f.start, f.end);
  // Lifetime: every campaign, every day on record. Deliberately not filtered —
  // it is the account's standing total, not a view of the current selection.
  const life = data.daily.reduce((a, r) => ({
    impressions: a.impressions + r.impressions,
    conversions: a.conversions + r.conversions,
    spend: a.spend + r.spend,
  }), { impressions: 0, conversions: 0, spend: 0 });
  const lifetime = [
    ["Campaigns", nf(data.campaigns.length)],
    ["Impressions", compact(life.impressions)],
    ["Conversions", nf(life.conversions)],
    ["Spend", money(life.spend)],
  ] as const;

  return (
    <Box bg={T.bg} minH="100vh" color={T.ink}>
      <Box maxW="1320px" mx="auto" px={{ base: 4, md: 7 }} pb={24}>
        <Flex justify="space-between" align="flex-start" gap={4} wrap="wrap"
          pt={{ base: 8, md: 11 }} pb={7}>
          <Box>
            <Text fontSize={{ base: "23px", md: "27px" }} fontWeight={650} letterSpacing="-0.022em"
              lineHeight={1.15}>{data.meta.advertiser}</Text>
            <Text fontSize={{ base: "23px", md: "27px" }} fontWeight={650} letterSpacing="-0.022em"
              lineHeight={1.15} color={T.muted}>Ad Performance</Text>
          </Box>
          <Flex gap={{ base: 5, md: 7 }} wrap="wrap" pt={1}>
            {lifetime.map(([k, val]) => (
              <Box key={k} textAlign={{ base: "left", sm: "right" }}>
                <Label as="div" mb="3px">Lifetime {k}</Label>
                <Text fontFamily={MONO} fontSize="16px" fontWeight={600} color={T.ink}
                  sx={{ fontVariantNumeric: "tabular-nums" }}>{val}</Text>
              </Box>
            ))}
          </Flex>
        </Flex>

        <FilterBar data={data} f={f} set={set} />

        <SectionTitle>Summary</SectionTitle>
        <Summary v={v} data={data} />

        <Box mt={9}><SectionTitle>Top Line Metrics</SectionTitle></Box>
        <TopLine v={v} data={data} />

        <Box mt={9}><SectionTitle>What, When &amp; Who Converts</SectionTitle></Box>
        <Converts v={v} data={data} days={days} />

        <Box mt={9}><SectionTitle>Delivery</SectionTitle></Box>
        <Delivery v={v} data={data} days={days} />

        <Box mt={9}><Creatives v={v} data={data} /></Box>

        <Box mt={14} pt={5} borderTop="1px solid" borderColor={T.line}>
          <Text fontFamily={MONO} fontSize="11px" color={T.dim} lineHeight={1.7}>
            Synthetic demonstration data for a fictional advertiser. Sharon Kwong.
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <Page />
    </ChakraProvider>
  </React.StrictMode>
);
