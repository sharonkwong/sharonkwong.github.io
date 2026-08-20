#!/usr/bin/env python3
"""Extract real ZCTA outlines for the ZIPs the demo campaign targets.

Source (primary): US Census Bureau 2020 Cartographic Boundary Files.
  ZCTAs  https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip
  Nation https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_nation_20m.zip

Shapefiles are read with the small parser below rather than a dependency: the
polygon record layout is fixed and documented, and the .dbf we need is three
character fields wide. Geometry is simplified (Douglas-Peucker) and rounded to
5 decimal places -- about a metre, far finer than a map this size can draw.

Usage:  python3 scripts/extract_madhive_v2_shapes.py <dir-with-unzipped-shapefiles>
"""
import json
import math
import os
import struct
import sys

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data", "madhive-v2-shapes.json")

# Must match ZIPS in generate_madhive_v2_data.py.
WANT = {"97203", "97217", "97211", "97218", "97220", "97229", "97210", "97227",
        "97212", "97213", "97221", "97205", "97209", "97232", "97215", "97239",
        "97201", "97214", "97202", "97206", "97219", "97266"}


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

    def dp(a, b):
        if b <= a + 1:
            return []
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        norm = math.hypot(dx, dy) or 1e-12
        far, best = -1, -1.0
        for i in range(a + 1, b):
            x0, y0 = pts[i]
            d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norm
            if d > best:
                far, best = i, d
        if best <= tol:
            return []
        return dp(a, far) + [far] + dp(far, b)

    keep = [0] + dp(0, len(pts) - 1) + [len(pts) - 1]
    out = [pts[i] for i in sorted(set(keep))]
    return out + [out[0]] if len(out) > 2 else ring


def clean(rings, tol, min_pts=8):
    out = []
    for r in rings:
        s = simplify(r, tol)
        if len(s) >= min_pts:
            out.append([[round(x, 5), round(y, 5)] for x, y in s])
    return out


def main(src):
    zc = os.path.join(src, "cb_2020_us_zcta520_500k")
    recs = read_dbf(zc + ".dbf")
    key = next(k for k in ("ZCTA5CE20", "GEOID20", "ZCTA5CE10") if k in recs[0])
    print("ZCTA field: %s  (%d records)" % (key, len(recs)))
    geoms = read_shp_polygons(zc + ".shp")

    zips = []
    for rec, rings in zip(recs, geoms):
        z = rec[key]
        if z in WANT and rings:
            zips.append(dict(zip=z, rings=clean(rings, 0.00035)))
    found = {z["zip"] for z in zips}
    missing = WANT - found
    print("matched %d/%d ZCTAs%s" % (len(found), len(WANT),
                                     "  MISSING: " + ", ".join(sorted(missing)) if missing else ""))

    nation = os.path.join(src, "cb_2020_us_nation_20m")
    rings = read_shp_polygons(nation + ".shp")[0]
    # Keep only rings big enough to read at inset size — islands become specks.
    big = sorted(rings, key=len, reverse=True)[:40]
    us = clean(big, 0.06, min_pts=6)

    data = dict(
        source=dict(
            zcta="US Census Bureau, 2020 Cartographic Boundary File, ZCTAs (500k)",
            nation="US Census Bureau, 2020 Cartographic Boundary File, Nation (20m)",
            url="https://www2.census.gov/geo/tiger/GENZ2020/shp/",
            note="Simplified with Douglas-Peucker and rounded to 5 decimal places.",
        ),
        zips=zips,
        nation=us,
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    pts = sum(len(r) for z in zips for r in z["rings"])
    print("Wrote %s  (%.0f KB)" % (os.path.relpath(OUT), os.path.getsize(OUT) / 1024))
    print("  %d ZCTAs, %d points · nation outline %d rings, %d points"
          % (len(zips), pts, len(us), sum(len(r) for r in us)))


if __name__ == "__main__":
    sys.setrecursionlimit(20000)
    main(sys.argv[1])
