/**
 * A minimal .pptx writer — one slide per block, no dependency.
 *
 * Same trick as the workbook: OOXML in a ZIP, and the parts a deck needs to
 * open are boilerplate once written down. Shapes are text boxes and filled
 * rectangles, which is all a bar chart needs.
 *
 * The deck is not the report re-flowed. A page can hold a table of twenty
 * rows; a slide projected in a meeting cannot, so each block gets its own
 * slide, tables are cut to what is legible from the back of a room, and the
 * headline of each slide is the thing the slide is for.
 */
import { zip } from "./zip";
import type { Entry } from "./zip";
import type { Block, Report } from "./report";

/* 16:9 in EMU. 914400 EMU to the inch, 12192000 x 6858000 for a 13.33in deck. */
const SW = 12192000, SH = 6858000;
const EMU = (pt: number) => Math.round(pt * 12700);

const INK = "11161D", MUTED = "6E7681", RULE = "D8DDE3", SOFT = "F1F3F5", ACCENT = "2B6CB0";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

let shapeId = 1;

function textBox(x: number, y: number, w: number, h: number, runs: {
  text: string; size: number; bold?: boolean; color?: string;
}[], opts: { align?: "l" | "r" | "ctr"; anchor?: "ctr" | "b" } = {}) {
  const id = ++shapeId;
  const paras = runs.map((r) =>
    `<a:p><a:pPr algn="${opts.align ?? "l"}"/>`
    + `<a:r><a:rPr lang="en-US" sz="${Math.round(r.size * 100)}" b="${r.bold ? 1 : 0}" dirty="0">`
    + `<a:solidFill><a:srgbClr val="${r.color ?? INK}"/></a:solidFill>`
    + `<a:latin typeface="Helvetica Neue"/></a:rPr>`
    + `<a:t>${esc(r.text)}</a:t></a:r></a:p>`).join("");
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="t${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>`
    + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>`
    + `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"`
    + ` anchor="${opts.anchor ?? "t"}"><a:spAutoFit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`;
}

function rect(x: number, y: number, w: number, h: number, fill: string) {
  const id = ++shapeId;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="r${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${Math.max(w, 1)}" cy="${h}"/></a:xfrm>`
    + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`
    + `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>`
    + `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
}

const slideXml = (shapes: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" `
  + `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" `
  + `xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">`
  + `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`
  + `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>`
  + `<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`
  + shapes + `</p:spTree></p:cSld><p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" `
  + `tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" `
  + `accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr></p:sld>`;

const PAD = EMU(54);
const TOP = EMU(52);
const BODY = EMU(126);
const CONTENT_W = SW - PAD * 2;

/** Title, a rule under it, and an optional line of guidance. */
function chrome(title: string, lede?: string) {
  return textBox(PAD, TOP, CONTENT_W, EMU(34), [{ text: title, size: 26, bold: true }])
    + rect(PAD, TOP + EMU(46), CONTENT_W, EMU(1.5), RULE)
    + (lede ? textBox(PAD, TOP + EMU(58), CONTENT_W, EMU(20), [{ text: lede, size: 13, color: MUTED }]) : "");
}

function blockSlides(b: Block): string[] {
  const out: string[] = [];
  const top = b.lede ? BODY + EMU(14) : BODY;

  if (b.kind === "kpi" && b.kpis) {
    const per = 3, gap = EMU(24);
    const cw = (CONTENT_W - gap * (per - 1)) / per;
    const shapes = b.kpis.map((k, i) => {
      const x = PAD + (i % per) * (cw + gap);
      const y = top + Math.floor(i / per) * EMU(126);
      return rect(x, y, cw, EMU(108), SOFT)
        + textBox(x + EMU(18), y + EMU(16), cw - EMU(36), EMU(16),
            [{ text: k.label.toUpperCase(), size: 11, bold: true, color: MUTED }])
        + textBox(x + EMU(18), y + EMU(40), cw - EMU(36), EMU(44),
            [{ text: k.value, size: 32, bold: true }])
        + (k.sub ? textBox(x + EMU(18), y + EMU(84), cw - EMU(36), EMU(16),
            [{ text: k.sub, size: 11, color: MUTED }]) : "");
    }).join("");
    out.push(chrome(b.title, b.lede) + shapes);
  }

  if (b.kind === "bars" && b.bars) {
    const max = b.barMax ?? Math.max(...b.bars.map((x) => x.value), 1e-9);
    const labelW = EMU(230), valueW = EMU(150);
    const trackX = PAD + labelW, trackW = CONTENT_W - labelW - valueW;
    const rowH = Math.min(EMU(62), (SH - top - EMU(90)) / Math.max(1, b.bars.length));
    const shapes = b.bars.map((bar, i) => {
      const y = top + i * rowH;
      const barH = Math.min(EMU(26), rowH - EMU(16));
      return textBox(PAD, y + EMU(3), labelW - EMU(16), EMU(20),
              [{ text: bar.label, size: 14, color: MUTED }])
        + rect(trackX, y, trackW, barH, SOFT)
        + rect(trackX, y, (bar.value / max) * trackW, barH, bar.color ?? ACCENT)
        + textBox(trackX + trackW + EMU(14), y + EMU(2), valueW - EMU(14), EMU(22),
              [{ text: bar.display, size: 15, bold: true }]);
    }).join("");
    out.push(chrome(b.title, b.lede) + shapes);
  }

  if (b.kind === "table" && b.table) {
    // A projected slide holds far fewer rows than a page. Split rather than shrink.
    const PER = 9;
    const { cols, rows } = b.table;
    const chunks: string[][][] = [];
    for (let i = 0; i < rows.length; i += PER) chunks.push(rows.slice(i, i + PER));
    chunks.forEach((chunk, ci) => {
      const rest = Math.min(EMU(150), (CONTENT_W - EMU(300)) / Math.max(1, cols.length - 1));
      const widths = cols.map((_, i) => (i === 0 ? CONTENT_W - rest * (cols.length - 1) : rest));
      const xs: number[] = [];
      widths.reduce((acc, w, i) => { xs[i] = acc; return acc + w; }, PAD);
      const head = cols.map((c, i) => textBox(
        xs[i], top, widths[i] - EMU(10), EMU(18),
        [{ text: c.label.toUpperCase(), size: 11, bold: true, color: MUTED }],
        { align: c.align === "right" ? "r" : "l" })).join("");
      const rule = rect(PAD, top + EMU(24), CONTENT_W, EMU(1.5), RULE);
      const body = chunk.map((row, ri) => row.map((cell, i) => textBox(
        xs[i], top + EMU(38) + ri * EMU(40), widths[i] - EMU(10), EMU(22),
        [{ text: cell, size: 14, bold: i === 0, color: i === 0 ? INK : MUTED }],
        { align: cols[i]?.align === "right" ? "r" : "l" })).join("")).join("");
      const title = chunks.length > 1 ? `${b.title} (${ci + 1} of ${chunks.length})` : b.title;
      out.push(chrome(title, ci === 0 ? b.lede : undefined) + head + rule + body);
    });
  }

  if (b.kind === "findings" && b.findings) {
    // Four to a slide: past that nobody reads the last one.
    const PER = 4;
    for (let i = 0; i < b.findings.length; i += PER) {
      const chunk = b.findings.slice(i, i + PER);
      const shapes = chunk.map((f, j) => {
        const y = top + j * EMU(96);
        return rect(PAD, y + EMU(4), EMU(4), EMU(64), ACCENT)
          + textBox(PAD + EMU(22), y, CONTENT_W - EMU(22), EMU(80), [{ text: f, size: 17 }]);
      }).join("");
      const title = b.findings.length > PER
        ? `${b.title} (${Math.floor(i / PER) + 1} of ${Math.ceil(b.findings.length / PER)})`
        : b.title;
      out.push(chrome(title, i === 0 ? b.lede : undefined) + shapes);
    }
  }

  return out;
}

export function buildPptx(r: Report): Blob {
  shapeId = 1;
  const slides: string[] = [];

  // Cover
  slides.push(
    rect(0, 0, SW, SH, "0D1117")
    + textBox(PAD, EMU(190), CONTENT_W, EMU(60), [{ text: r.advertiser, size: 46, bold: true, color: "FFFFFF" }])
    + textBox(PAD, EMU(252), CONTENT_W, EMU(40), [{ text: r.subtitle, size: 26, color: "9AA5B1" }])
    + rect(PAD, EMU(310), EMU(120), EMU(3), ACCENT)
    + textBox(PAD, EMU(334), CONTENT_W, EMU(24), [{ text: r.range, size: 16, color: "C9D1D9" }])
    + textBox(PAD, EMU(362), CONTENT_W, EMU(24), [{ text: r.scope, size: 14, color: "8B949E" }]));

  for (const section of r.sections) {
    // Section divider, so a reader knows which question the next slides answer.
    slides.push(
      rect(0, 0, SW, SH, "F5F7F9")
      + rect(PAD, EMU(292), EMU(90), EMU(4), ACCENT)
      + textBox(PAD, EMU(316), CONTENT_W, EMU(52), [{ text: section.title, size: 38, bold: true }]));
    for (const b of section.blocks) slides.push(...blockSlides(b));
  }

  const enc = new TextEncoder();
  const file = (name: string, xml: string): Entry => ({ name, data: enc.encode(xml) });
  const n = slides.length;

  const theme = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Report">`
    + `<a:themeElements><a:clrScheme name="Report">`
    + `<a:dk1><a:srgbClr val="11161D"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>`
    + `<a:dk2><a:srgbClr val="11161D"/></a:dk2><a:lt2><a:srgbClr val="F5F7F9"/></a:lt2>`
    + ["2B6CB0", "58A6FF", "E3B341", "F778BA", "3FB950", "8B949E"]
        .map((c, i) => `<a:accent${i + 1}><a:srgbClr val="${c}"/></a:accent${i + 1}>`).join("")
    + `<a:hlink><a:srgbClr val="2B6CB0"/></a:hlink><a:folHlink><a:srgbClr val="6E7681"/></a:folHlink>`
    + `</a:clrScheme><a:fontScheme name="Report">`
    + `<a:majorFont><a:latin typeface="Helvetica Neue"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>`
    + `<a:minorFont><a:latin typeface="Helvetica Neue"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>`
    + `</a:fontScheme><a:fmtScheme name="Report">`
    + `<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>`
    + `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>`
    + `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>`
    + `<a:lnStyleLst><a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>`
    + `<a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>`
    + `<a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>`
    + `<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle>`
    + `<a:effectStyle><a:effectLst/></a:effectStyle>`
    + `<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>`
    + `<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>`
    + `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>`
    + `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>`
    + `</a:fmtScheme></a:themeElements></a:theme>`;

  const master = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" `
    + `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" `
    + `xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">`
    + `<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>`
    + `<a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr>`
    + `<p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`
    + `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>`
    + `<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>`
    + `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" `
    + `accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" `
    + `folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/>`
    + `</p:sldLayoutIdLst></p:sldMaster>`;

  const layout = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" `
    + `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" `
    + `xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">`
    + `<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>`
    + `</p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>`
    + `<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>`
    + `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

  const presentation = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" `
    + `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" `
    + `xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">`
    + `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>`
    + `<p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("")}</p:sldIdLst>`
    + `<p:sldSz cx="${SW}" cy="${SH}"/><p:notesSz cx="${SH}" cy="${SW}"/></p:presentation>`;

  const presRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`
    + slides.map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join("")
    + `<Relationship Id="rId${n + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>`
    + `</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
    + `<Default Extension="xml" ContentType="application/xml"/>`
    + `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>`
    + `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>`
    + `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`
    + `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`
    + slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")
    + `</Types>`;

  const rel = (id: string, type: string, target: string) =>
    `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  const wrapRels = (inner: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${inner}</Relationships>`;

  return zip([
    file("[Content_Types].xml", contentTypes),
    file("_rels/.rels", wrapRels(rel("rId1", "officeDocument", "ppt/presentation.xml"))),
    file("ppt/presentation.xml", presentation),
    file("ppt/_rels/presentation.xml.rels", presRels),
    file("ppt/theme/theme1.xml", theme),
    file("ppt/slideMasters/slideMaster1.xml", master),
    file("ppt/slideMasters/_rels/slideMaster1.xml.rels",
      wrapRels(rel("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml")
             + rel("rId2", "theme", "../theme/theme1.xml"))),
    file("ppt/slideLayouts/slideLayout1.xml", layout),
    file("ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      wrapRels(rel("rId1", "slideMaster", "../slideMasters/slideMaster1.xml"))),
    ...slides.map((s, i) => file(`ppt/slides/slide${i + 1}.xml`, slideXml(s))),
    ...slides.map((_, i) => file(`ppt/slides/_rels/slide${i + 1}.xml.rels`,
      wrapRels(rel("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml")))),
  ], "application/vnd.openxmlformats-officedocument.presentationml.presentation");
}
