import { Box, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import type { Shapes } from "./data";
import { MONO, T } from "./ui";

/* Web Mercator. At city scale any projection would look the same, but the
   locator inset spans the country, where an unprojected map is visibly wrong. */
const mercY = (lat: number) =>
  (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;

type Pt = [number, number];
type Box4 = { x0: number; y0: number; x1: number; y1: number };

function bounds(rings: Pt[][]): Box4 {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const [lon, lat] of r) {
    const y = mercY(lat);
    if (lon < x0) x0 = lon; if (lon > x1) x1 = lon;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

const grow = (b: Box4, f: number): Box4 => {
  const dx = (b.x1 - b.x0) * f, dy = (b.y1 - b.y0) * f;
  return { x0: b.x0 - dx, y0: b.y0 - dy, x1: b.x1 + dx, y1: b.y1 + dy };
};

function fit(b: Box4, w: number, h: number, pad: number) {
  const k = Math.min((w - pad * 2) / (b.x1 - b.x0 || 1), (h - pad * 2) / (b.y1 - b.y0 || 1));
  const ox = (w - (b.x1 - b.x0) * k) / 2 - b.x0 * k;
  const oy = (h - (b.y1 - b.y0) * k) / 2 + b.y1 * k;
  return ([lon, lat]: Pt): Pt => [lon * k + ox, oy - mercY(lat) * k];
}

const toPath = (rings: Pt[][], project: (p: Pt) => Pt) =>
  rings.map((r) => r.map((p, i) => {
    const [x, y] = project(p);
    return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join("") + "Z").join("");

const area = (ring: Pt[]) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a / 2);
};

const centroid = (ring: Pt[]): Pt => {
  let x = 0, y = 0, a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f;
    x += (ring[j][0] + ring[i][0]) * f;
    y += (ring[j][1] + ring[i][1]) * f;
  }
  a *= 3;
  return a === 0 ? ring[0] : [x / a, y / a];
};

const W = 760, INSET_W = 168, INSET_H = 104;
/* Locator shows the contiguous states. Alaska's Aleutians cross the
   antimeridian, and including them stretches the frame until the US is a
   speck — the conventional locator crop is the right call, not a shortcut. */
const CONUS = { lon: [-125, -66.5], lat: [24, 49.5] };

/**
 * A five-digit code in a monospace face runs about 0.62em per character, so it
 * needs roughly 3.1x the font size in width and a little over 1x in height.
 * Shrink to fit rather than hide: a ZIP with no code on it is the one a reader
 * most wants named. Floored at 5.5px, below which it is not legible anyway and
 * the hover tooltip has to carry it.
 */
const labelSize = (w: number, h: number) =>
  Math.max(5.5, Math.min(11, w / 3.1, h / 1.15));

export type GeoView = "metro" | "state";

export default function GeoMap({ shapes, view, colorFor, labelFor, isBright, selected, onHover, onSelect }: {
  shapes: Shapes;
  view: GeoView;
  colorFor: (zip: string) => string;
  labelFor: (zip: string) => string;
  isBright: (zip: string) => boolean;
  selected: string | null;
  onHover: (zip: string | null) => void;
  onSelect: (zip: string) => void;
}) {
  const context = shapes.context ?? [];
  const stateRings = (shapes.state ?? []) as Pt[][];

  const v = useMemo(() => {
    const targeted = shapes.zips.flatMap((z) => z.rings as Pt[][]);
    /* The metro frame grows a little past the ZIPs that were bought so a ring
       of untargeted neighbours sits inside it. Where the buy stops is part of
       what the map is for, and a frame cropped to the buy cannot show it. */
    const b = view === "state" && stateRings.length
      ? bounds(stateRings)
      : grow(bounds(targeted), 0.12);
    const H = Math.round(Math.min(620, Math.max(300, (W - 28) * ((b.y1 - b.y0) / (b.x1 - b.x0)) + 28)));
    const project = fit(b, W, H, 14);

    const shape = (z: { zip: string; rings: number[][][] }) => {
      const rings = z.rings as Pt[][];
      const biggest = rings.reduce((a, c) => (area(a) > area(c) ? a : c));
      const [cx, cy] = project(centroid(biggest));
      const xs = biggest.map((p) => project(p)[0]);
      const ys = biggest.map((p) => project(p)[1]);
      return {
        zip: z.zip, d: toPath(rings, project), cx, cy,
        // Fit the label to the polygon rather than hiding it: a ZIP with no
        // code on it is the one a reader most wants named.
        font: labelSize(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
      };
    };

    const conus = (shapes.nation as Pt[][]).filter((r) =>
      r.some(([lon, lat]) => lon > CONUS.lon[0] && lon < CONUS.lon[1] &&
                             lat > CONUS.lat[0] && lat < CONUS.lat[1]))
      .map((r) => r.filter(([lon]) => lon > CONUS.lon[0] - 6 && lon < CONUS.lon[1] + 6))
      .filter((r) => r.length > 5);
    const nb = bounds(conus);
    const nation = fit(nb, INSET_W, INSET_H, 5);
    const tb = bounds(targeted);
    const [mx, my] = nation([(tb.x0 + tb.x1) / 2,
      // invert the mercator y back to a latitude for the marker
      (Math.atan(Math.exp((((tb.y0 + tb.y1) / 2) * Math.PI) / 180)) * 360) / Math.PI - 90]);
    return {
      zips: shapes.zips.map(shape),
      context: context.map(shape),
      statePath: stateRings.length ? toPath(stateRings, project) : "",
      nationPath: toPath(conus, nation),
      H,
      marker: [mx, my] as Pt,
    };
  }, [shapes, view, context, stateRings]);

  /* At state zoom the targeted ZIPs are a few pixels across, so no code would
     be legible on one. The metro view is where they are read. */
  const showCodes = view === "metro";

  return (
    <Box position="relative" bg={T.bg} border="1px solid" borderColor={T.line}
      borderRadius="6px" overflow="hidden">
      <Box as="svg" viewBox={`0 0 ${W} ${v.H}`} w="100%" h="auto" display="block"
        role="img" aria-label={view === "state"
          ? "ZIP code areas across Oregon, with the targeted ones in Portland picked out in colour"
          : "Targeted ZIP code areas in Portland, Oregon, with untargeted neighbours in grey"}
        onMouseLeave={() => onHover(null)}>

        {/* A third of Oregon has no ZCTA at all: they are built from blocks
            that contain addresses, so forest and range get none. Painting the
            state underneath makes that land read as land rather than as a hole
            where the data should be. */}
        {v.statePath && <path d={v.statePath} fill={T.off.land} stroke="none" pointerEvents="none" />}

        {/* Untargeted areas next, so a targeted border always draws over them. */}
        {v.context.map((z) => (
          <path key={z.zip} d={z.d}
            fill={selected === z.zip ? T.off.hover : T.off.fill}
            stroke={T.off.line} strokeWidth={0.5}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => onHover(z.zip)}
            onClick={() => onSelect(z.zip)}>
            <title>{`${z.zip} — not targeted`}</title>
          </path>
        ))}

        {v.zips.map((z) => {
          const on = selected === z.zip;
          return (
            <g key={z.zip}>
              <path d={z.d} fill={colorFor(z.zip)}
                stroke={on ? T.ink : T.bg} strokeWidth={on ? 2 : 0.8}
                style={{ cursor: "pointer", transition: "fill .2s" }}
                onMouseEnter={() => onHover(z.zip)}
                onClick={() => onSelect(z.zip)}>
                <title>{`${z.zip} — ${labelFor(z.zip)}`}</title>
              </path>
              {showCodes && (
                <text x={z.cx} y={z.cy + z.font * 0.34} textAnchor="middle" pointerEvents="none"
                  fontFamily={MONO} fontSize={z.font} fontWeight={600}
                  fill={isBright(z.zip) ? T.bg : T.ink}>{z.zip}</text>
              )}
            </g>
          );
        })}
        {/* The state line last, so no ZCTA edge draws over it. */}
        {v.statePath && (
          <path d={v.statePath} fill="none" stroke={T.dim} strokeWidth={1.1}
            pointerEvents="none" opacity={0.8} />
        )}
      </Box>

      <Box position="absolute" right="8px" bottom="8px" bg={T.surface} border="1px solid"
        borderColor={T.line} borderRadius="4px" px={1.5} pt={1} pb={0.5}>
        <Box as="svg" viewBox={`0 0 ${INSET_W} ${INSET_H}`} w={`${INSET_W}px`} h={`${INSET_H}px`}
          display="block" role="img" aria-label="Locator: the targeted area within the United States">
          <path d={v.nationPath} fill={T.raised} stroke={T.dim} strokeWidth={0.6} />
          <circle cx={v.marker[0]} cy={v.marker[1]} r={9} fill="none"
            stroke={T.ramp[5]} strokeWidth={1.3} opacity={0.5} />
          <circle cx={v.marker[0]} cy={v.marker[1]} r={3} fill={T.ramp[5]} />
        </Box>
        <Text fontFamily={MONO} fontSize="8.5px" color={T.dim} textAlign="center" mt="1px">
          Portland, OR
        </Text>
      </Box>
    </Box>
  );
}
