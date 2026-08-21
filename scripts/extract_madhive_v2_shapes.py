#!/usr/bin/env python3
"""Extract real ZCTA outlines for the demo campaign's ZIPs and the state around them.

Source (primary): US Census Bureau 2020 Cartographic Boundary Files.
  ZCTAs  https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip
  States https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_state_500k.zip
  Nation https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_nation_20m.zip

Two sets of ZCTAs come out. The targeted ones carry campaign numbers and are
drawn in the colour ramp. The rest of the state is drawn grey: a buy that
covers one metro reads very differently when you can see what it did not cover,
and the untargeted areas are the pool the next campaign would expand into.

The land area on every ZCTA is real (ALAND20). The demographic profile on the
untargeted ones is NOT -- it is modelled from that area, because the Census API
now requires a key for ACS and this demo has none. Density falls off with area,
which is what makes a downtown ZCTA and a high-desert one look different. The
targeted ZIPs' profiles in generate_madhive_v2_data.py are modelled too, so the
map is consistent with itself either way.

Shapefiles are read with the small parser below rather than a dependency: the
polygon record layout is fixed and documented, and the .dbf we need is three
character fields wide. Geometry is simplified (Douglas-Peucker) and rounded to
5 decimal places -- about a metre, far finer than a map this size can draw.

Usage:  python3 scripts/extract_madhive_v2_shapes.py <dir-with-unzipped-shapefiles>
"""
import json
import math
import os
import random
import struct
import sys

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data", "madhive-v2-shapes.json")

# Must match ZIPS in generate_madhive_v2_data.py.
WANT = {"97203", "97217", "97211", "97218", "97220", "97229", "97210", "97227",
        "97212", "97213", "97221", "97205", "97209", "97232", "97215", "97239",
        "97201", "97214", "97202", "97206", "97219", "97266"}

STATE = "OR"
# A frame drawn on Oregon shows a little of its neighbours, and Portland sits on
# the state line -- leaving Washington out would cut a hole in the metro view
# exactly where the river is. The pad brings the border fringe in with it.
PAD = 0.25


def read_dbf(path):
    """Field values as dicts. Only character fields are used here."""
    with open(path, "rb") as f:
        buf = f.read()
    n_recs, hdr_len, rec_len = struct.unpack("<I2H", buf[4:12])
    fields, pos = [], 32
    while buf[pos] != 0x0D:
        name = buf[pos:pos + 11].split(b"\0")[0].decode("latin-1")
        length = buf[pos + 16]
        fields.append((name, length))
        pos += 32
    out, pos = [], hdr_len
    for _ in range(n_recs):
        rec, off = {}, pos + 1                      # first byte is the delete flag
        for name, length in fields:
            rec[name] = buf[off:off + length].decode("latin-1").strip()
            off += length
        out.append(rec)
        pos += rec_len
    return out


def read_shp_polygons(path):
    """One list of rings per record, in file order. Point/PointZ are skipped."""
    with open(path, "rb") as f:
        buf = f.read()
    pos, recs = 100, []
    while pos < len(buf):
        _, content_len = struct.unpack(">2I", buf[pos:pos + 8])
        pos += 8
        end = pos + content_len * 2
        shape_type = struct.unpack("<I", buf[pos:pos + 4])[0]
        if shape_type != 5:                          # 5 = Polygon
            recs.append([])
            pos = end
            continue
        n_parts, n_points = struct.unpack("<2I", buf[pos + 36:pos + 44])
        p = pos + 44
        parts = list(struct.unpack("<%dI" % n_parts, buf[p:p + 4 * n_parts]))
        p += 4 * n_parts
        coords = struct.unpack("<%dd" % (n_points * 2), buf[p:p + 16 * n_points])
        rings = []
        for i, s in enumerate(parts):
            e = parts[i + 1] if i + 1 < n_parts else n_points
            rings.append([(coords[j * 2], coords[j * 2 + 1]) for j in range(s, e)])
        recs.append(rings)
        pos = end
    return recs


def simplify(ring, tol):
    """Douglas-Peucker. Rings are closed, so the split runs on the open path."""
    if len(ring) < 4:
        return ring
    pts = ring[:-1] if ring[0] == ring[-1] else ring[:]

    # Iterative: a ring of several thousand points recurses deeper than the
    # interpreter allows, and the rural ZCTAs in this file are that big.
    keep, stack = [0, len(pts) - 1], [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        norm = math.hypot(dx, dy) or 1e-12
        far, best = -1, -1.0
        for i in range(a + 1, b):
            x0, y0 = pts[i]
            d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norm
            if d > best:
                far, best = i, d
        if best > tol:
            keep.append(far)
            stack.append((a, far))
            stack.append((far, b))
    out = [pts[i] for i in sorted(set(keep))]
    return out + [out[0]] if len(out) > 2 else ring


def clean(rings, tol, min_pts=8, nd=5):
    """nd is decimal places: 5 is about a metre, 4 about ten. Background
    geometry is never inspected closely enough to need the fifth, and it is
    six hundred polygons rather than twenty-two."""
    out = []
    for r in rings:
        s = simplify(r, tol)
        if len(s) >= min_pts:
            out.append([[round(x, nd), round(y, nd)] for x, y in s])
    return out


def bbox(rings):
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    return min(xs), min(ys), max(xs), max(ys)


def profile(z, land_km2):
    """A modelled area profile, anchored to the one real number we have.

    Density falls off with area -- a downtown ZCTA is a few square kilometres
    and a high-desert one is a few thousand -- and income, age and education
    follow from it the way they broadly do in the real world. Seeded on the ZIP,
    so a rerun does not move the map.
    """
    rng = random.Random("zcta-" + z)
    a = max(0.4, land_km2)
    density = 3000.0 / (1.0 + (a / 4.0) ** 1.15) * rng.uniform(0.55, 1.7)
    pop = int(max(120, min(78_000, density * a)))
    # denser areas are younger, better paid and better credentialed, loosely
    urban = min(1.0, math.log10(max(density, 1.0)) / 3.3)
    inc = int(min(148_000, max(34_000,
        44_000 + urban * 52_000 + rng.gauss(0, 11_000))) / 100) * 100
    age = round(min(58.0, max(28.5, 47.0 - urban * 14.0 + rng.gauss(0, 3.1))), 1)
    deg = round(min(0.74, max(0.08, 0.10 + urban * 0.46 + rng.gauss(0, 0.07))), 3)
    return dict(population=pop, medianIncome=inc, medianAge=age, degreeShare=deg)


def main(src):
    zc = os.path.join(src, "cb_2020_us_zcta520_500k")
    recs = read_dbf(zc + ".dbf")
    key = next(k for k in ("ZCTA5CE20", "GEOID20", "ZCTA5CE10") if k in recs[0])
    print("ZCTA field: %s  (%d records)" % (key, len(recs)))
    geoms = read_shp_polygons(zc + ".shp")

    st_recs = read_dbf(os.path.join(src, "cb_2020_us_state_500k.dbf"))
    st_geoms = read_shp_polygons(os.path.join(src, "cb_2020_us_state_500k.shp"))
    si = next(i for i, r in enumerate(st_recs) if r.get("STUSPS") == STATE)
    st_rings = st_geoms[si]
    sx0, sy0, sx1, sy1 = bbox(st_rings)
    print("%s bbox: %.3f,%.3f .. %.3f,%.3f" % (STATE, sx0, sy0, sx1, sy1))

    # Neighbours of the buy are read at metro zoom, where a polygon simplified
    # for a state-wide frame opens visible gaps against the one beside it --
    # each is simplified independently, so their shared edge stops being shared.
    # Detail costs bytes, so it is spent only where someone can see it.
    tx0, ty0, tx1, ty1 = bbox([r for rec, g in zip(recs, geoms) if rec[key] in WANT
                               for r in g])
    near = (tx0 - 0.55, ty0 - 0.45, tx1 + 0.55, ty1 + 0.45)

    zips, context = [], []
    for rec, rings in zip(recs, geoms):
        z = rec[key]
        if not rings:
            continue
        if z in WANT:
            zips.append(dict(zip=z, rings=clean(rings, 0.00035)))
            continue
        x0, y0, x1, y1 = bbox(rings)
        if x1 < sx0 - PAD or x0 > sx1 + PAD or y1 < sy0 - PAD or y0 > sy1 + PAD:
            continue
        close = not (x1 < near[0] or x0 > near[2] or y1 < near[1] or y0 > near[3])
        r = (clean(rings, 0.0006, min_pts=5)          # shares an edge with the buy
             if close else
             clean(rings, 0.0085, min_pts=5, nd=4))   # only ever seen state-wide
        if not r:
            continue
        land = float(rec.get("ALAND20") or rec.get("ALAND") or 0) / 1e6
        context.append(dict(zip=z, rings=r, **profile(z, land)))

    found = {z["zip"] for z in zips}
    missing = WANT - found
    print("matched %d/%d targeted ZCTAs%s" % (len(found), len(WANT),
          "  MISSING: " + ", ".join(sorted(missing)) if missing else ""))
    print("context: %d ZCTAs" % len(context))

    nation = os.path.join(src, "cb_2020_us_nation_20m")
    rings = read_shp_polygons(nation + ".shp")[0]
    # Keep only rings big enough to read at inset size — islands become specks.
    big = sorted(rings, key=len, reverse=True)[:40]
    us = clean(big, 0.06, min_pts=6)

    data = dict(
        source=dict(
            zcta="US Census Bureau, 2020 Cartographic Boundary File, ZCTAs (500k)",
            state="US Census Bureau, 2020 Cartographic Boundary File, States (500k)",
            nation="US Census Bureau, 2020 Cartographic Boundary File, Nation (20m)",
            url="https://www2.census.gov/geo/tiger/GENZ2020/shp/",
            note="Simplified with Douglas-Peucker and rounded to 5 decimal places. "
                 "Geometry and land area are the Census Bureau's; the demographic "
                 "profile on untargeted ZCTAs is modelled from land area, not measured.",
        ),
        zips=zips,
        context=context,
        state=clean(st_rings, 0.004, min_pts=6, nd=4),
        nation=us,
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    pts = sum(len(r) for z in zips for r in z["rings"])
    cpts = sum(len(r) for z in context for r in z["rings"])
    print("Wrote %s  (%.0f KB)" % (os.path.relpath(OUT), os.path.getsize(OUT) / 1024))
    print("  %d targeted ZCTAs, %d points · %d context, %d points · state %d rings"
          % (len(zips), pts, len(context), cpts, len(data["state"])))


if __name__ == "__main__":
    sys.setrecursionlimit(20000)
    main(sys.argv[1])
