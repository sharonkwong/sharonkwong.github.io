/**
 * A minimal PDF writer, enough for a report: text, rules, filled rectangles.
 *
 * PDF is a text format with a byte-offset table at the end, so a document with
 * no embedded fonts and no images is a few hundred lines. Helvetica and
 * Helvetica-Bold are two of the fourteen faces every reader ships, so nothing
 * needs embedding and the file stays tiny.
 *
 * The page is light rather than dark. The dashboard is dark because it is read
 * on a screen; this gets printed and forwarded, and a dark page wastes toner
 * and photocopies badly.
 */
import type { Report, Block } from "./report";

const W = 595.28, H = 841.89;          // A4 portrait, points
const M = 46;                          // margin
const COL = W - M * 2;

const INK = "0.09 0.11 0.14";
const MUTED = "0.42 0.46 0.52";
const RULE = "0.85 0.87 0.90";
const SOFT = "0.96 0.97 0.98";

/** Width of a string in Helvetica at a size, from the built-in metrics. */
const WIDTHS: Record<string, number> = {};
{
  // Approximate Helvetica advance widths, per 1000 units. Used only for
  // right-alignment and truncation, where being a point or two out is invisible.
  const narrow = "iljtfrI.,:;'|! ";
  const wide = "MWmw@%";
  for (let c = 32; c < 127; c++) {
    const ch = String.fromCharCode(c);
    WIDTHS[ch] = narrow.includes(ch) ? 278 : wide.includes(ch) ? 833 : 556;
  }
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") WIDTHS[ch] = 667;
  for (const ch of "0123456789") WIDTHS[ch] = 556;
  WIDTHS[" "] = 278;
}
const textWidth = (s: string, size: number) =>
  [...s].reduce((w, ch) => w + (WIDTHS[ch] ?? 556), 0) * size / 1000;

/** PDF strings: escape the delimiters, and drop anything outside Latin-1. */
const esc = (s: string) =>
  s.replace(/[\\()]/g, (m) => "\\" + m)
   .replace(/[‐-―]/g, "-")
   .replace(/[‘’]/g, "'")
   .replace(/[“”]/g, '"')
   .replace(/×/g, "x")
   .replace(/·/g, "-")
   .replace(/[^\x20-\x7e]/g, "");

function ellipsis(s: string, size: number, max: number) {
  if (textWidth(s, size) <= max) return s;
  let out = s;
  while (out.length > 1 && textWidth(out + "...", size) > max) out = out.slice(0, -1);
  return out + "...";
}

class Page {
  ops: string[] = [];
  y = H - M;

  text(s: string, x: number, size: number, opts: { bold?: boolean; color?: string; align?: "right" } = {}) {
    const t = esc(s);
    if (!t) return;
    const px = opts.align === "right" ? x - textWidth(t, size) : x;
    this.ops.push(`BT /${opts.bold ? "F2" : "F1"} ${size} Tf ${opts.color ?? INK} rg `
      + `${px.toFixed(2)} ${this.y.toFixed(2)} Td (${t}) Tj ET`);
  }
  textAt(s: string, x: number, y: number, size: number, opts: { bold?: boolean; color?: string; align?: "right" } = {}) {
    const save = this.y; this.y = y; this.text(s, x, size, opts); this.y = save;
  }
  rect(x: number, y: number, w: number, h: number, color: string) {
    this.ops.push(`${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }
  rule(y: number, color = RULE) {
    this.ops.push(`${color} RG 0.6 w ${M} ${y.toFixed(2)} m ${W - M} ${y.toFixed(2)} l S`);
  }
}

export function buildPdf(r: Report): Blob {
  const pages: Page[] = [];
  let pg = new Page();
  pages.push(pg);

  const need = (h: number) => {
    if (pg.y - h < M + 26) { pg = new Page(); pages.push(pg); pg.y = H - M; }
  };

  /* ------------------------------------------------------------------ cover */
  pg.y = H - 150;
  pg.text(r.advertiser, M, 30, { bold: true });
  pg.y -= 34;
  pg.text(r.subtitle, M, 22, { color: MUTED });
  pg.y -= 44;
  pg.rule(pg.y);
  pg.y -= 22;
  for (const [k, val] of [["Period", r.range], ["Scope", r.scope], ["Generated", r.generated]]) {
    pg.text(k, M, 9.5, { color: MUTED, bold: true });
    pg.text(val, M + 96, 9.5);
    pg.y -= 17;
  }
  pg.y -= 16;
  pg.text("Read for the next campaign decision. Figures cover the period and scope above.",
    M, 10, { color: MUTED });

  /* --------------------------------------------------------------- sections */
  for (const section of r.sections) {
    pg = new Page(); pages.push(pg); pg.y = H - M;
    pg.text(section.title, M, 17, { bold: true });
    pg.y -= 10;
    pg.rule(pg.y);
    pg.y -= 26;

    for (const b of section.blocks) {
      renderBlock(b, () => pg, need);
      pg.y -= 20;
    }
  }

  /* ------------------------------------------------------------- pagination */
  pages.forEach((p, i) => {
    if (i === 0) return;
    p.textAt(`${r.advertiser} — ${r.range}`, M, 26, 8, { color: MUTED });
    p.textAt(`${i} / ${pages.length - 1}`, W - M, 26, 8, { color: MUTED, align: "right" });
  });

  return assemble(pages);
}

function renderBlock(b: Block, page: () => Page, need: (h: number) => void) {
  need(70);
  let pg = page();
  pg.text(b.title, M, 12, { bold: true });
  pg.y -= b.lede ? 14 : 18;
  if (b.lede) { pg.text(b.lede, M, 9, { color: MUTED }); pg.y -= 16; }

  if (b.kind === "kpi" && b.kpis) {
    const perRow = 3, cw = COL / perRow;
    b.kpis.forEach((k, i) => {
      if (i % perRow === 0 && i > 0) { pg.y -= 46; need(46); pg = page(); }
      const x = M + (i % perRow) * cw;
      pg.textAt(k.label.toUpperCase(), x, pg.y, 7.5, { color: MUTED, bold: true });
      pg.textAt(k.value, x, pg.y - 17, 15, { bold: true });
      if (k.sub) pg.textAt(k.sub, x, pg.y - 30, 8, { color: MUTED });
    });
    pg.y -= 46;
  }

  if (b.kind === "bars" && b.bars) {
    const labelW = 132, valueW = 84;
    const trackX = M + labelW, trackW = COL - labelW - valueW;
    const max = b.barMax ?? Math.max(...b.bars.map((x) => x.value), 1e-9);
    for (const bar of b.bars) {
      need(22);
      pg = page();
      const y = pg.y - 9;
      pg.textAt(ellipsis(bar.label, 9, labelW - 8), M, y, 9, { color: MUTED });
      pg.rect(trackX, y - 3, trackW, 11, SOFT);
      const w = Math.max(1.5, (bar.value / max) * trackW);
      pg.rect(trackX, y - 3, w, 11, hexToRgb(bar.color));
      pg.textAt(bar.display, W - M, y, 9.5, { align: "right", bold: true });
      pg.y -= 20;
    }
  }

  if (b.kind === "table" && b.table) {
    const { cols, rows } = b.table;
    // First column takes the slack; the rest share what is left evenly.
    const rest = Math.min(78, (COL - 150) / Math.max(1, cols.length - 1));
    const widths = cols.map((_, i) => (i === 0 ? COL - rest * (cols.length - 1) : rest));
    const xs: number[] = [];
    widths.reduce((acc, w, i) => { xs[i] = acc; return acc + w; }, M);

    need(30);
    pg = page();
    cols.forEach((c, i) => {
      const x = c.align === "right" ? xs[i] + widths[i] - 4 : xs[i];
      pg.textAt(c.label.toUpperCase(), x, pg.y, 7.5,
        { color: MUTED, bold: true, align: c.align === "right" ? "right" : undefined });
    });
    pg.y -= 6;
    pg.rule(pg.y);
    pg.y -= 13;

    for (const row of rows) {
      need(18);
      pg = page();
      row.forEach((cell, i) => {
        const right = cols[i]?.align === "right";
        const x = right ? xs[i] + widths[i] - 4 : xs[i];
        pg.textAt(right ? cell : ellipsis(cell, 9, widths[i] - 6), x, pg.y, 9,
          { align: right ? "right" : undefined, color: i === 0 ? INK : MUTED });
      });
      pg.y -= 15;
    }
  }

  if (b.kind === "findings" && b.findings) {
    for (const f of b.findings) {
      const lines = wrap(f, 10, COL - 16);
      need(lines.length * 14 + 8);
      pg = page();
      pg.rect(M, pg.y - 1, 3, 3, MUTED);
      lines.forEach((ln, i) => pg.textAt(ln, M + 12, pg.y - i * 13, 10, { color: i === 0 ? INK : MUTED }));
      pg.y -= lines.length * 13 + 8;
    }
  }
}

/** Wraps the raw string. text() escapes on the way out, and escaping here too
    would double every backslash and print it. */
function wrap(s: string, size: number, max: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size) > max && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function hexToRgb(hex?: string): string {
  if (!hex) return "0.36 0.65 1";
  const n = parseInt(hex, 16);
  return `${(((n >> 16) & 255) / 255).toFixed(3)} ${(((n >> 8) & 255) / 255).toFixed(3)} ${((n & 255) / 255).toFixed(3)}`;
}

/** Objects, then the xref table keyed on their byte offsets. */
function assemble(pages: Page[]): Blob {

  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };

  const fontRegular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pagesId = objects.length + 1 + pages.length * 2;   // reserved below

  const kids: number[] = [];
  for (const p of pages) {
    const stream = p.ops.join("\n");
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] `
      + `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> `
      + `/Contents ${contentId} 0 R >>`);
    kids.push(pageId);
  }
  const realPagesId = add(`<< /Type /Pages /Count ${pages.length} /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] >>`);
  const catalogId = add(`<< /Type /Catalog /Pages ${realPagesId} 0 R >>`);

  // The page objects were written pointing at `pagesId`; make that the truth.
  if (realPagesId !== pagesId) {
    for (let i = 0; i < objects.length; i++) {
      objects[i] = objects[i].replace(`/Parent ${pagesId} 0 R`, `/Parent ${realPagesId} 0 R`);
    }
  }

  // Every offset below is a position in the Latin-1 bytes this emits, so the
  // lengths are measured in characters. Measuring with a UTF-8 encoder would
  // count the four high bytes of the header sentinel twice and shift the whole
  // xref table, which readers then have to repair before they can open it.
  let out = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets[i] = out.length;
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    + offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")
    + `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`
    + `startxref\n${xref}\n%%EOF\n`;

  // Latin-1 bytes: the content is ASCII after escaping, and the header sentinel
  // is high-byte on purpose so readers treat the file as binary.
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
}
