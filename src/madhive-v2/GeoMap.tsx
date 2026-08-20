import { Box, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import type { Shapes } from "./data";
import { MONO, T } from "./ui";

/* Web Mercator. At city scale any projection would look the same, but the
   locator inset spans the country, where an unprojected map is visibly wrong. */
const mercY = (lat: number) =>
  (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;

type Pt = [number, number];

function bounds(rings: Pt[][]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const [lon, lat] of r) {
    const y = mercY(lat);
    if (lon < x0) x0 = lon; if (lon > x1) x1 = lon;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

function fit(rings: Pt[][], w: number, h: number, pad: number) {
  const { x0, y0, x1, y1 } = bounds(rings);
  const k = Math.min((w - pad * 2) / (x1 - x0 || 1), (h - pad * 2) / (y1 - y0 || 1));
  const ox = (w - (x1 - x0) * k) / 2 - x0 * k;
  const oy = (h - (y1 - y0) * k) / 2 + y1 * k;
  return {
    project: ([lon, lat]: Pt): Pt => [lon * k + ox, oy - mercY(lat) * k],
    bbox: { x0, y0, x1, y1 },
  };
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

export default function GeoMap({ shapes, colorFor, labelFor, isBright, selected, onHover, onSelect }: {
  shapes: Shapes;
  colorFor: (zip: string) => string;
  labelFor: (zip: string) => string;
  isBright: (zip: string) => boolean;
  selected: string | null;
  onHover: (zip: string | null) => void;
  onSelect: (zip: string) => void;
}) {
  const view = useMemo(() => {
    // Auto-zoom: the frame is the extent of the targeted ZIPs, nothing wider,
    // and the frame's own aspect ratio is taken from them so there is no
    // dead space either side of the shape.
    const all = shapes.zips.flatMap((z) => z.rings as Pt[][]);
    const b = bounds(all);
    const H = Math.round(Math.min(620, Math.max(300, (W - 28) * ((b.y1 - b.y0) / (b.x1 - b.x0)) + 28)));
    const { project, bbox } = fit(all, W, H, 14);
    const zips = shapes.zips.map((z) => {
      const rings = z.rings as Pt[][];
      const biggest = rings.reduce((a, b) => (area(a) > area(b) ? a : b));
      const [cx, cy] = project(centroid(biggest));
      const xs = biggest.map((p) => project(p)[0]);
      const ys = biggest.map((p) => project(p)[1]);
      return {
        zip: z.zip, d: toPath(rings, project), cx, cy,
        room: Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
      };
    });

    const conus = (shapes.nation as Pt[][]).filter((r) =>
      r.some(([lon, lat]) => lon > CONUS.lon[0] && lon < CONUS.lon[1] &&
                             lat > CONUS.lat[0] && lat < CONUS.lat[1]))
      .map((r) => r.filter(([lon]) => lon > CONUS.lon[0] - 6 && lon < CONUS.lon[1] + 6))
      .filter((r) => r.length > 5);
    const nation = fit(conus, INSET_W, INSET_H, 5);
    const [mx, my] = nation.project([(bbox.x0 + bbox.x1) / 2,
      // invert the mercator y back to a latitude for the marker
      (Math.atan(Math.exp((((bbox.y0 + bbox.y1) / 2) * Math.PI) / 180)) * 360) / Math.PI - 90]);
    return {
      zips,
      nationPath: toPath(conus, nation.project),
      H,
      marker: [mx, my] as Pt,
    };
  }, [shapes]);

  return (
    <Box position="relative" bg={T.bg} border="1px solid" borderColor={T.line}
      borderRadius="6px" overflow="hidden">
      <Box as="svg" viewBox={`0 0 ${W} ${view.H}`} w="100%" h="auto" display="block"
        role="img" aria-label="Targeted ZIP code areas, Portland Oregon"
        onMouseLeave={() => onHover(null)}>
        {view.zips.map((z) => {
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
              {z.room > 34 && (
                <text x={z.cx} y={z.cy + 3.5} textAnchor="middle" pointerEvents="none"
                  fontFamily={MONO} fontSize={10.5} fontWeight={600}
                  fill={isBright(z.zip) ? T.bg : T.ink}>{z.zip}</text>
              )}
            </g>
          );
        })}
      </Box>

      <Box position="absolute" right="8px" bottom="8px" bg={T.surface} border="1px solid"
        borderColor={T.line} borderRadius="4px" px={1.5} pt={1} pb={0.5}>
        <Box as="svg" viewBox={`0 0 ${INSET_W} ${INSET_H}`} w={`${INSET_W}px`} h={`${INSET_H}px`}
          display="block" role="img" aria-label="Locator: the targeted area within the United States">
          <path d={view.nationPath} fill={T.raised} stroke={T.dim} strokeWidth={0.6} />
          <circle cx={view.marker[0]} cy={view.marker[1]} r={9} fill="none"
            stroke={T.ramp[5]} strokeWidth={1.3} opacity={0.5} />
          <circle cx={view.marker[0]} cy={view.marker[1]} r={3} fill={T.ramp[5]} />
        </Box>
        <Text fontFamily={MONO} fontSize="8.5px" color={T.dim} textAlign="center" mt="1px">
          Portland, OR
        </Text>
      </Box>
    </Box>
  );
}
