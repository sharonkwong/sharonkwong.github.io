import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { compact, creativeTotals, deviceTotals, geoAll, money, nf, pct } from "./data";
import type { View } from "./data";
import type { Data } from "./types";
import { MONO, Panel, T } from "./ui";

const N = ({ children, color }: { children: ReactNode; color?: string }) => (
  <Text as="span" fontFamily={MONO} fontWeight={600} color={color ?? T.ink}
    sx={{ fontVariantNumeric: "tabular-nums" }}>{children}</Text>
);

/**
 * Observations, not advice. Each line states something the filtered data says
 * and pairs it with what it should be read against; what to do about it is the
 * planner's call, not the dashboard's.
 */
function findings(v: View, data: Data): ReactNode[] {
  const out: ReactNode[] = [];
  const t = v.totals, p = v.priorTotals;

  const perMedia = v.media.map((m) => {
    const x = v.byMedia[m.key];
    return {
      ...m, ...x,
      cpa: x.conversions > 0 ? x.spend / x.conversions : Infinity,
      clickShare: t.clicks > 0 ? x.clicks / t.clicks : 0,
      convShare: t.conversions > 0 ? x.conversions / t.conversions : 0,
    };
  }).filter((m) => m.impressions > 0);

  // 1. The spread in what a conversion costs.
  if (perMedia.length > 1) {
    const byCpa = [...perMedia].sort((a, b) => a.cpa - b.cpa);
    const lo = byCpa[0], hi = byCpa[byCpa.length - 1];
    if (Number.isFinite(hi.cpa) && lo.cpa > 0) {
      out.push(
        <>
          <N color={lo.color}>{lo.label}</N> brings a conversion in for <N>{money(lo.cpa, 2)}</N>;{" "}
          <N color={hi.color}>{hi.label}</N> costs <N>{money(hi.cpa, 2)}</N> —{" "}
          <N>{(hi.cpa / lo.cpa).toFixed(1)}×</N> more.
        </>
      );
    }
  }

  // 2. Where clicks and conversions disagree most.
  if (perMedia.length > 1) {
    const gap = [...perMedia].sort(
      (a, b) => (b.clickShare - b.convShare) - (a.clickShare - a.convShare));
    const noisy = gap[0], quiet = gap[gap.length - 1];
    if (noisy.key !== quiet.key && noisy.clickShare - noisy.convShare > 0.05) {
      out.push(
        <>
          <N color={noisy.color}>{noisy.label}</N> takes <N>{pct(noisy.clickShare, 0)}</N> of clicks
          and <N>{pct(noisy.convShare, 0)}</N> of conversions;{" "}
          <N color={quiet.color}>{quiet.label}</N> takes <N>{pct(quiet.clickShare, 0)}</N> and{" "}
          <N>{pct(quiet.convShare, 0)}</N>.
        </>
      );
    }
  }

  // 3. Did the outcome move with the money.
  if (p.conversions > 0 && p.spend > 0) {
    const dc = (t.conversions / p.conversions - 1) * 100;
    const ds = (t.spend / p.spend - 1) * 100;
    const word = (n: number) => (n >= 0 ? "rose" : "fell");
    out.push(
      <>
        Against the prior period conversions {word(dc)}{" "}
        <N color={dc >= 0 ? T.up : T.down}>{Math.abs(dc).toFixed(1)}%</N> while spend {word(ds)}{" "}
        <N color={ds >= 0 ? T.down : T.up}>{Math.abs(ds).toFixed(1)}%</N>.
      </>
    );
  }

  // 4. How concentrated the conversions are geographically.
  const zips = geoAll(v, data.geo).sort((a, b) => b.conversions - a.conversions);
  const totalConv = zips.reduce((s, z) => s + z.conversions, 0);
  if (totalConv > 0 && zips.length >= 5) {
    const top5 = zips.slice(0, 5).reduce((s, z) => s + z.conversions, 0);
    out.push(
      <>
        Five of {zips.length} ZIPs carry <N>{pct(top5 / totalConv, 0)}</N> of conversions —{" "}
        <N>{zips[0].zip}</N> {zips[0].name} leads with <N>{nf(zips[0].conversions)}</N>.
      </>
    );
  }

  // 5. Device, where the split between reach and outcome usually differs.
  const devImp = deviceTotals(v, data.devices, "impressions");
  const devConv = deviceTotals(v, data.devices, "conversions");
  const impTot = devImp.reduce((s, d) => s + d.value, 0);
  const convTot = devConv.reduce((s, d) => s + d.value, 0);
  if (impTot > 0 && convTot > 0) {
    const top = devImp[0];
    const same = devConv.find((d) => d.device === top.device)!;
    out.push(
      <>
        <N>{top.device}</N> is <N>{pct(top.value / impTot, 0)}</N> of impressions and{" "}
        <N>{pct(same.value / convTot, 0)}</N> of conversions.
      </>
    );
  }

  // 6. How far apart the creatives sit inside the same buy.
  const cre = creativeTotals(v, data.creatives)
    .filter((c) => c.clicks > 20)
    .map((c) => ({ ...c, cvr: c.conversions / c.clicks }))
    .sort((a, b) => b.cvr - a.cvr);
  if (cre.length > 2 && cre[0].cvr > 0 && cre[cre.length - 1].cvr > 0) {
    out.push(
      <>
        Best creative converts <N>{pct(cre[0].cvr, 1)}</N> of clicks{" "}
        (<N>{cre[0].name}</N>), the weakest <N>{pct(cre[cre.length - 1].cvr, 1)}</N>.
      </>
    );
  }

  return out;
}

export default function Summary({ v, data }: { v: View; data: Data }) {
  const lines = useMemo(() => findings(v, data), [v, data]);
  const t = v.totals;

  return (
    <Panel right={
      <Text fontFamily={MONO} fontSize="10.5px" color={T.dim}>
        {v.campaigns.length} campaign{v.campaigns.length === 1 ? "" : "s"} ·{" "}
        {compact(t.impressions)} impressions · {nf(t.conversions)} conversions
      </Text>
    }>
      {lines.length === 0 ? (
        <Text fontSize="13px" color={T.muted}>Nothing delivered in this selection.</Text>
      ) : (
        <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} columnGap={8} rowGap={2.5}>
          {lines.slice(0, 6).map((l, i) => (
            <Flex key={i} gap={2.5} align="baseline">
              <Box w="4px" h="4px" borderRadius="full" bg={T.dim} flex="0 0 auto"
                position="relative" top="-3px" />
              <Text fontSize="13px" color={T.muted} lineHeight={1.6}>{l}</Text>
            </Flex>
          ))}
        </Grid>
      )}
    </Panel>
  );
}
