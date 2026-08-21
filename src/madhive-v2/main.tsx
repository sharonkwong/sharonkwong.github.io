import { Box, ChakraProvider, Flex, Spinner, Text, extendTheme } from "@chakra-ui/react";
import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import Converts from "./Converts";
import Creatives from "./Creatives";
import Delivery from "./Delivery";
import FilterBar from "./Filters";
import { LifetimeTable, LifetimeTiles } from "./Lifetime";
import TopLine from "./TopLine";
import { daysBetween, useData, useFilters, useView } from "./data";
import { MONO, SectionTitle, T } from "./ui";

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
  const [lifeOpen, setLifeOpen] = useState(false);
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
          <LifetimeTiles data={data} open={lifeOpen} onToggle={() => setLifeOpen((o) => !o)} />
        </Flex>

        {/* Full page width, unlike the tiles it opens from. */}
        {lifeOpen && (
          <Box mb={7}>
            <LifetimeTable data={data} selected={f.campaigns}
              onToggle={(id) => set({
                campaigns: f.campaigns.includes(id)
                  ? f.campaigns.filter((c) => c !== id)
                  : [...f.campaigns, id],
                // An explicit campaign pick is the more specific instruction, so
                // it clears the media filter rather than fighting it.
                media: [],
              })}
              onClear={() => set({ campaigns: [] })} />
          </Box>
        )}

        <FilterBar data={data} f={f} set={set} v={v} />

        <SectionTitle>Top Line Metrics</SectionTitle>
        <TopLine v={v} data={data} />

        <Box mt={9}><SectionTitle>What, When &amp; Who Converts</SectionTitle></Box>
        <Converts v={v} data={data} days={days} />

        <Box mt={9}><SectionTitle>Ad Delivery</SectionTitle></Box>
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
