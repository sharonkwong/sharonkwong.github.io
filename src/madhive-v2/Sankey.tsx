/**
 * Creative to placement to outcome, by clicks.
 *
 * Self-contained on purpose: this file, one import and one block in main.tsx
 * are the whole footprint. Delete the three and nothing else changes.
 *
 * The flow unit is clicks, not impressions. Conversions are ~8% of clicks but
 * ~0.03% of impressions, and on impressions the converted ribbon would be a
 * hairline. Clicks keep both outcomes visible on one scale.
 */
import { Box, Flex, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { compact, creativeTotals, nf, pct } from "./data";
import type { View } from "./data";
import type { Data } from "./types";
import { Label, MONO, Panel, T } from "./ui";

const W = 1000, H = 620, NODE_W = 13, GAP = 9, MIN_H = 13;
const PAD_L = 172, PAD_R = 152, PAD_T = 10, PAD_B = 10;
const KEEP_C = 8, KEEP_P = 6; // per stage, per ranking, before the tail folds into Other

interface Node { id: string; label: string; value: number; color: string; stage: 0 | 1 | 2 }
interface Link { from: string; to: string; value: number; color: string }

function build(v: View, data: Data) {
  const mediaOf = Object.fromEntries(data.campaigns.map((c) => [c.id, c.mediaType]));
  const colorOf = Object.fromEntries(data.mediaTypes.map((m) => [m.key, m.color]));

  const flows: { creative: string; placement: string; color: string; clicks: number; conv: number }[] = [];
  for (const c of creativeTotals(v, data.creatives)) {
    const color = colorOf[mediaOf[c.campaign]];
    for (const p of c.placements) {
      const clicks = c.clicks * p.clickShare;
      // Clamp: click share and conversion share are drawn independently, so a
      // placement can in principle be credited more conversions than clicks.
      const conv = Math.min(c.conversions * p.conversionShare, clicks);
      if (clicks > 0.5) flows.push({ creative: c.name, placement: p.site, color, clicks, conv });
    }
  }
  if (!flows.length) return null;

  // Fold the tail of each stage into one node so the diagram stays readable.
  // Kept by the UNION of top-by-clicks and top-by-conversions. Ranking on
  // clicks alone buries the channel that converts best under the one that
  // merely gets clicked; ranking on conversions alone sweeps the high-traffic
  // low-yield creatives into one blob, which is the comparison being made.
  const fold = (key: "creative" | "placement", keep: number, otherLabel: string) => {
    const top = (field: "clicks" | "conv") => {
      const tot = new Map<string, number>();
      for (const f of flows) tot.set(f[key], (tot.get(f[key]) ?? 0) + f[field]);
      return [...tot].sort((a, b) => b[1] - a[1]).slice(0, keep).map(([k]) => k);
    };
    const set = new Set([...top("clicks"), ...top("conv")]);
    return (name: string) => (set.has(name) ? name : otherLabel);
  };
  const cName = fold("creative", KEEP_C, "Other creatives");
  const pName = fold("placement", KEEP_P, "Other placements");

  const agg = new Map<string, { creative: string; placement: string; color: string; clicks: number; conv: number }>();
  for (const f of flows) {
    const c = cName(f.creative), p = pName(f.placement);
    const k = `${c}||${p}`;
    const a = agg.get(k);
    if (!a) agg.set(k, { creative: c, placement: p, color: f.color, clicks: f.clicks, conv: f.conv });
    else { a.clicks += f.clicks; a.conv += f.conv; }
  }
  const rows = [...agg.values()];
  const sum = (arr: typeof rows, key: "clicks" | "conv") => arr.reduce((s, r) => s + r[key], 0);

  const group = (key: "creative" | "placement") => {
    const m = new Map<string, { value: number; color: string }>();
    for (const r of rows) {
      const g = m.get(r[key]);
      if (!g) m.set(r[key], { value: r.clicks, color: r.color });
      else g.value += r.clicks;
    }
    return [...m].sort((a, b) => b[1].value - a[1].value);
  };

  const creatives = group("creative");
  const placements = group("placement");
  const converted = sum(rows, "conv");
  const total = sum(rows, "clicks");

  const nodes: Node[] = [
    ...creatives.map(([label, g]): Node => ({ id: `c:${label}`, label, value: g.value, color: g.color, stage: 0 })),
    ...placements.map(([label, g]): Node => ({ id: `p:${label}`, label, value: g.value, color: g.color, stage: 1 })),
    { id: "o:yes", label: "Converted", value: converted, color: T.up, stage: 2 },
    { id: "o:no", label: "Did not convert", value: total - converted, color: T.dim, stage: 2 },
  ];

  const links: Link[] = [
    ...rows.map((r): Link => ({ from: `c:${r.creative}`, to: `p:${r.placement}`, value: r.clicks, color: r.color })),
    ...placements.flatMap(([label]): Link[] => {
      const mine = rows.filter((r) => r.placement === label);
      const c = sum(mine, "conv"), t = sum(mine, "clicks");
      const color = mine[0].color;
      return [
        { from: `p:${label}`, to: "o:yes", value: c, color },
        { from: `p:${label}`, to: "o:no", value: t - c, color },
      ].filter((l) => l.value > 0);
    }),
  ];

  return { nodes, links, total, converted };
}

export default function SankeyFlow({ v, data }: { v: View; data: Data }) {
  const [hover, setHover] = useState<string | null>(null);
  const model = useMemo(() => build(v, data), [v, data]);

  const laid = useMemo(() => {
    if (!model) return null;
    const { nodes, links } = model;
    const plotH = H - PAD_T - PAD_B;
    const xs = [PAD_L, PAD_L + (W - PAD_L - PAD_R - NODE_W) / 2, W - PAD_R - NODE_W];

    const box: Record<string, { x: number; y: number; h: number; node: Node }> = {};
    for (const stage of [0, 1, 2] as const) {
      const mine = nodes.filter((n) => n.stage === stage && n.value > 0);
      const total = mine.reduce((s, n) => s + n.value, 0);
      const avail = plotH - GAP * Math.max(0, mine.length - 1);
      // Proportional heights, but nothing thinner than its own label. Small
      // nodes are pinned to MIN_H and the rest re-share what is left, which
      // repeats until the set of pinned nodes stops changing.
      let pinned = mine.map(() => false);
      let heights = mine.map((n) => (n.value / total) * avail);
      for (let pass = 0; pass < 6; pass++) {
        const next = mine.map(() => 0);
        const fixed = pinned.reduce((s, p) => s + (p ? MIN_H : 0), 0);
        const flexValue = mine.reduce((s, n, i) => s + (pinned[i] ? 0 : n.value), 0);
        const flexSpace = Math.max(0, avail - fixed);
        mine.forEach((n, i) => {
          next[i] = pinned[i] ? MIN_H : flexValue > 0 ? (n.value / flexValue) * flexSpace : 0;
        });
        const grown = next.map((hh, i) => pinned[i] || hh < MIN_H);
        heights = next;
        if (grown.every((g, i) => g === pinned[i])) break;
        pinned = grown;
      }
      let y = PAD_T;
      mine.forEach((n, i) => {
        const h = Math.max(2, heights[i]);
        box[n.id] = { x: xs[stage], y, h, node: n };
        y += h + GAP;
      });
    }

    // Ribbons stack in node order at both ends, which keeps crossings down.
    const outAt: Record<string, number> = {}, inAt: Record<string, number> = {};
    const order = new Map(nodes.map((n, i) => [n.id, i]));
    const ribbons = links
      .filter((l) => box[l.from] && box[l.to] && l.value > 0)
      .sort((a, b) => (order.get(a.from)! - order.get(b.from)!) || (order.get(a.to)! - order.get(b.to)!))
      .map((l) => {
        const s = box[l.from], e = box[l.to];
        const sh = (l.value / s.node.value) * s.h;
        const eh = (l.value / e.node.value) * e.h;
        const sy = s.y + (outAt[l.from] ?? 0);
        const ey = e.y + (inAt[l.to] ?? 0);
        outAt[l.from] = (outAt[l.from] ?? 0) + sh;
        inAt[l.to] = (inAt[l.to] ?? 0) + eh;
        const x0 = s.x + NODE_W, x1 = e.x, mx = (x0 + x1) / 2;
        const d = `M${x0},${sy} C${mx},${sy} ${mx},${ey} ${x1},${ey}`
          + ` L${x1},${ey + eh} C${mx},${ey + eh} ${mx},${sy + sh} ${x0},${sy + sh} Z`;
        return { ...l, d, key: `${l.from}->${l.to}` };
      });

    return { box, ribbons };
  }, [model]);

  if (!model || !laid) {
    return <Panel><Text fontSize="13px" color={T.muted}>Nothing delivered in this selection.</Text></Panel>;
  }

  const litNode = (id: string) => !hover || hover === id;
  const litLink = (l: { from: string; to: string }) => !hover || hover === l.from || hover === l.to;

  return (
    <Panel right={
      <Flex gap={4} align="center" wrap="wrap">
        <Flex align="center" gap={1.5}>
          <Box w="9px" h="9px" borderRadius="2px" bg={T.up} />
          <Text fontSize="11.5px" color={T.muted}>Converted</Text>
        </Flex>
        <Text fontFamily={MONO} fontSize="10.5px" color={T.dim}>
          {nf(model.total)} clicks · {pct(model.converted / model.total, 1)} convert
        </Text>
      </Flex>
    }>
      <Flex mb={1}>
        <Box w={`${(PAD_L / W) * 100}%`} />
        <Label flex="1">Creative</Label>
        <Label flex="1">Placement</Label>
        <Label>Outcome</Label>
      </Flex>
      <Box as="svg" viewBox={`0 0 ${W} ${H}`} w="100%" h="auto" display="block"
        role="img" aria-label="Clicks flowing from creative to placement to converted or not"
        onMouseLeave={() => setHover(null)}>
        {laid.ribbons.map((r) => (
          <path key={r.key} d={r.d} fill={r.color}
            opacity={litLink(r) ? (hover ? 0.55 : 0.24) : 0.05}
            style={{ transition: "opacity .12s" }}>
            <title>{`${r.from.slice(2)} to ${r.to.slice(2)}: ${nf(r.value)} clicks`}</title>
          </path>
        ))}
        {Object.values(laid.box).map(({ x, y, h, node }) => {
          const left = node.stage === 0;
          return (
            <g key={node.id} onMouseEnter={() => setHover(node.id)}
              opacity={litNode(node.id) ? 1 : 0.35}>
              <rect x={x} y={y} width={NODE_W} height={h} rx={2} fill={node.color}>
                <title>{`${node.label}: ${nf(node.value)} clicks`}</title>
              </rect>
              <text x={left ? x - 9 : x + NODE_W + 9} y={y + h / 2 + (h >= 15 ? -1 : 4)}
                textAnchor={left ? "end" : "start"} fontSize={11.5}
                fill={hover === node.id ? T.ink : T.muted}
                stroke={T.surface} strokeWidth={3} paintOrder="stroke"
                fontWeight={node.stage === 2 ? 600 : 400}>
                {node.label.length > 23 ? `${node.label.slice(0, 22)}…` : node.label}
              </text>
              {h >= 15 && (
                <text x={left ? x - 9 : x + NODE_W + 9} y={y + h / 2 + 13}
                  textAnchor={left ? "end" : "start"} fontFamily={MONO} fontSize={10}
                  fill={T.dim} stroke={T.surface} strokeWidth={3} paintOrder="stroke">
                  {compact(node.value)}
                </text>
              )}
            </g>
          );
        })}
      </Box>
    </Panel>
  );
}
