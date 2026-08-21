import { Box, ChakraProvider, Flex, Grid, Spinner, Text, extendTheme } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { DataTable, Label, MONO, Panel, SectionTitle, T } from "../madhive-v2/ui";
import type { Column } from "../madhive-v2/ui";

const theme = extendTheme({
  config: { initialColorMode: "dark", useSystemColorMode: false },
  styles: { global: { "html, body": { background: T.bg, color: T.ink } } },
  fonts: {
    heading: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
    body: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
    mono: MONO,
  },
});

/* ------------------------------------------------------------------ types */
interface Field { name: string; type: string; example: string | null; range: string | null; optional: boolean; note: string }
interface Collection { name: string; rows: number; description: string; source: string; fields: Field[] }
interface Table { layer: string; name: string; grain: string; description: string; columns: { name: string; type: string; note: string }[] }
interface Step { title: string; detail: string; tables: string }
interface Transform { frm: string; to: string; steps: Step[] }
interface WorkedStep {
  layer: string; table: string; cols: string[]; rows: string[][];
  flags: (string | null)[]; note?: string; real?: boolean;
}
interface Worked { title: string; note: string; steps: WorkedStep[] }
interface Schema {
  generatedAt: string; dashboard: string; advertiser: string;
  window: { first: string; last: string };
  files: { path: string; bytes: number; description: string }[];
  layers: { name: string; short: string; purpose: string }[];
  transforms: Transform[];
  worked: Worked[];
  tables: Table[];
  collections: Collection[];
  lineage: { section: string; widget: string; reads: string[] }[];
  rules: { title: string; body: string }[];
  source: { zcta: string; nation: string; url: string; note: string };
}

const LAYER_COLOR: Record<string, string> = {
  Bronze: "#c98a52", Silver: "#9aa5b1", Gold: "#e3b341", Served: T.up,
};

const C = ({ children }: { children: React.ReactNode }) => (
  <Text as="code" fontFamily={MONO} fontSize="11.5px" bg={T.bg} border="1px solid"
    borderColor={T.lineSoft} borderRadius="3px" px="4px" py="1px" color={T.ink}
    whiteSpace="nowrap">{children}</Text>
);

/* ------------------------------------------------------------- pipeline */
function Pipeline({ layers }: { layers: Schema["layers"] }) {
  const W = 1000, H = 132, BW = 208, GAP = (W - BW * 4) / 3;
  return (
    <Box as="figure" m={0}>
      <Box as="svg" viewBox={`0 0 ${W} ${H}`} w="100%" h="auto" display="block" role="img"
        aria-label="Four layers: raw files, conformed events, aggregate marts, then the JSON the browser fetches.">
        <defs>
          <marker id="pa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6"
            orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={T.dim} />
          </marker>
        </defs>
        {layers.map((l, i) => {
          const x = i * (BW + GAP);
          return (
            <g key={l.name}>
              <rect x={x} y={16} width={BW} height={64} rx={6} fill={T.surface}
                stroke={LAYER_COLOR[l.name] ?? T.line} strokeWidth={1.2} />
              <text x={x + 14} y={40} fontSize={13} fontWeight={600} fill={T.ink}>{l.name}</text>
              <text x={x + 14} y={60} fontFamily={MONO} fontSize={10} fill={T.dim}>{l.short}</text>
              {i < layers.length - 1 && (
                <line x1={x + BW + 6} y1={48} x2={x + BW + GAP - 6} y2={48}
                  stroke={T.dim} strokeWidth={1.2} markerEnd="url(#pa)" />
              )}
            </g>
          );
        })}
        <text x={0} y={110} fontSize={11.5} fill={T.muted}>
          Rebuilt on a trailing window, because the DSP restates the previous 48 hours.
        </text>
      </Box>
    </Box>
  );
}

/* ------------------------------------------------------------------ erd */
function Erd() {
  const W = 1100, H = 470;
  const dims = [
    { n: "dim_campaign", fk: "campaign_id" },
    { n: "dim_creative", fk: "creative_id" },
    { n: "dim_placement", fk: "placement_id" },
    { n: "dim_device", fk: "device_type" },
    { n: "dim_geo_zip", fk: "zcta5" },
  ];
  const DW = 190, DGAP = (W - DW * 5) / 4, DY = 14, DH = 40;
  const FX = 150, FW = 420, FH = 44;
  const rows = [
    { n: "fct_impression", y: 140 },
    { n: "fct_click", y: 246 },
    { n: "fct_conversion", y: 352 },
  ];
  // fct_email_delivery is a sibling fact, not a child: email has no impression
  // to hang off. Drawn dashed and without an arrowhead so the line does not
  // claim a parent-child link that does not exist.
  const side = [
    { n: "fct_email_delivery", x: 690, y: 140, w: 300,
      note: "parallel fact — email has no impression", dashed: true },
    { n: "dim_creative_section", x: 690, y: 246, w: 300, note: "section_key", dashed: false },
  ];
  return (
    <Box as="figure" m={0}>
      <Box as="svg" viewBox={`0 0 ${W} ${H}`} w="100%" h="auto" display="block" role="img"
        aria-label="Five dimensions key into the impression fact; impressions lead to clicks and clicks to conversions; email delivery and creative sections sit alongside.">
        <defs>
          <marker id="ea" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6"
            orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={T.dim} />
          </marker>
        </defs>

        {dims.map((d, i) => {
          const x = i * (DW + DGAP);
          const cx = x + DW / 2;
          const tx = FX + FW / 2;
          return (
            <g key={d.n}>
              <rect x={x} y={DY} width={DW} height={DH} rx={5} fill={T.surface}
                stroke={T.ramp[3]} strokeWidth={1.1} />
              <text x={cx} y={DY + 25} textAnchor="middle" fontFamily={MONO} fontSize={11.5}
                fill={T.ink}>{d.n}</text>
              <path d={`M${cx},${DY + DH} C${cx},${DY + DH + 42} ${tx},${rows[0].y - 46} ${tx},${rows[0].y}`}
                fill="none" stroke={T.line} strokeWidth={1} markerEnd="url(#ea)" />
              <text x={cx + (i < 2 ? -6 : 6)} y={DY + DH + 26} textAnchor={i < 2 ? "end" : "start"}
                fontFamily={MONO} fontSize={9.5} fill={T.dim}>{d.fk}</text>
            </g>
          );
        })}

        {rows.map((r, i) => (
          <g key={r.n}>
            <rect x={FX} y={r.y} width={FW} height={FH} rx={5} fill={T.raised}
              stroke={T.ramp[4]} strokeWidth={1.3} />
            <text x={FX + FW / 2} y={r.y + 28} textAnchor="middle" fontFamily={MONO} fontSize={13}
              fontWeight={600} fill={T.ink}>{r.n}</text>
            {i < rows.length - 1 && (
              <>
                <line x1={FX + FW / 2} y1={r.y + FH} x2={FX + FW / 2} y2={rows[i + 1].y - 4}
                  stroke={T.dim} strokeWidth={1.2} markerEnd="url(#ea)" />
                <text x={FX + FW / 2 + 8} y={r.y + FH + 38} fontFamily={MONO} fontSize={10}
                  fill={T.dim}>{i === 0 ? "impression_sk" : "click_sk"}</text>
              </>
            )}
          </g>
        ))}

        {side.map((s) => (
          <g key={s.n}>
            <rect x={s.x} y={s.y} width={s.w} height={FH} rx={5} fill={T.surface}
              stroke={T.line} strokeWidth={1.1} />
            <text x={s.x + s.w / 2} y={s.y + 27} textAnchor="middle" fontFamily={MONO} fontSize={12}
              fill={T.ink}>{s.n}</text>
            <line x1={s.x - 6} y1={s.y + FH / 2} x2={FX + FW + 6} y2={s.y + FH / 2}
              stroke={T.line} strokeWidth={1} strokeDasharray={s.dashed ? "5 4" : undefined}
              markerEnd={s.dashed ? undefined : "url(#ea)"} />
            <text x={(s.x + FX + FW) / 2} y={s.y + FH / 2 - 9} textAnchor="middle"
              fontFamily={MONO} fontSize={9.5} fill={T.dim}>{s.note}</text>
          </g>
        ))}

        <text x={FX} y={430} fontSize={11.5} fill={T.muted}>
          Every fact carries its own date, so a filter never has to walk the chain to find one.
        </text>
      </Box>
    </Box>
  );
}

/* --------------------------------------------------------- worked example */
/** One table's worth of rows, with anything dropped or changed called out. */
function RowGrid({ s }: { s: WorkedStep }) {
  const dropped = (f: string | null) => !!f && /dropped/.test(f);
  return (
    <Box>
      <Flex align="baseline" gap={2.5} wrap="wrap" mb={2}>
        <Box as="span" fontFamily={MONO} fontSize="9.5px" letterSpacing="0.08em"
          textTransform="uppercase" color={LAYER_COLOR[s.layer] ?? T.dim} border="1px solid"
          borderColor={T.line} borderRadius="full" px={2} py="1px">{s.layer}</Box>
        <Text fontFamily={MONO} fontSize="12.5px" color={T.ink}>{s.table}</Text>
        {s.real && (
          <Text fontFamily={MONO} fontSize="9.5px" color={T.up} border="1px solid"
            borderColor={T.up} borderRadius="full" px={2} py="1px">ships verbatim</Text>
        )}
      </Flex>
      <Box overflowX="auto" border="1px solid" borderColor={T.line} borderRadius="6px">
        <Box as="table" w="100%" style={{ borderCollapse: "collapse" }}>
          <Box as="thead">
            <Box as="tr">
              {s.cols.map((c) => (
                <Box as="th" key={c} textAlign="left" py="6px" px={2.5} bg={T.bg}
                  borderBottom="1px solid" borderColor={T.line} whiteSpace="nowrap"
                  fontFamily={MONO} fontSize="9.5px" letterSpacing="0.06em"
                  textTransform="uppercase" color={T.dim} fontWeight={500}>{c}</Box>
              ))}
              <Box as="th" bg={T.bg} borderBottom="1px solid" borderColor={T.line} w="100%" />
            </Box>
          </Box>
          <Box as="tbody">
            {s.rows.map((r, i) => {
              const gone = dropped(s.flags[i]);
              return (
                <Box as="tr" key={i} opacity={gone ? 0.42 : 1}>
                  {r.map((v, j) => (
                    <Box as="td" key={j} py="6px" px={2.5} whiteSpace="nowrap"
                      borderBottom={i === s.rows.length - 1 ? undefined : "1px solid"}
                      borderColor={T.lineSoft} fontFamily={MONO} fontSize="11.5px"
                      color={gone ? T.dim : T.muted}
                      textDecoration={gone ? "line-through" : undefined}>{v || "—"}</Box>
                  ))}
                  <Box as="td" py="6px" px={2.5}
                    borderBottom={i === s.rows.length - 1 ? undefined : "1px solid"}
                    borderColor={T.lineSoft}>
                    {s.flags[i] && (
                      <Text fontSize="11px" color={gone ? T.down : T.muted} whiteSpace="nowrap">
                        {s.flags[i]}
                      </Text>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
      {s.note && (
        <Text fontSize="12px" color={T.muted} mt={2} lineHeight={1.6} maxW="94ch">{s.note}</Text>
      )}
    </Box>
  );
}

function WorkedTrace({ w }: { w: Worked }) {
  return (
    <Panel>
      <Text fontSize="13.5px" fontWeight={600} color={T.ink} mb={1}>{w.title}</Text>
      <Text fontSize="12.5px" color={T.muted} lineHeight={1.6} mb={4} maxW="94ch">{w.note}</Text>
      <Flex direction="column" gap={0}>
        {w.steps.map((s, i) => (
          <Box key={`${s.layer}-${s.table}-${i}`}>
            <RowGrid s={s} />
            {i < w.steps.length - 1 && (
              <Flex align="center" gap={2} my={3} pl={1}>
                <Box as="svg" viewBox="0 0 12 20" w="12px" h="20px" flex="0 0 auto">
                  <line x1="6" y1="0" x2="6" y2="13" stroke={T.dim} strokeWidth="1.2" />
                  <polygon points="6,20 2.5,13 9.5,13" fill={T.dim} />
                </Box>
                <Text fontFamily={MONO} fontSize="10.5px" color={T.dim}>
                  {w.steps[i + 1].layer === s.layer ? "same layer" : `${s.layer} to ${w.steps[i + 1].layer}`}
                </Text>
              </Flex>
            )}
          </Box>
        ))}
      </Flex>
    </Panel>
  );
}

/* --------------------------------------------------------------- tables */
function TableCard({ t }: { t: Table }) {
  return (
    <Panel>
      <Flex align="baseline" gap={2.5} wrap="wrap" mb={1}>
        <Text fontFamily={MONO} fontSize="13.5px" fontWeight={600} color={T.ink}>{t.name}</Text>
        <Box as="span" fontFamily={MONO} fontSize="9.5px" letterSpacing="0.08em"
          textTransform="uppercase" color={LAYER_COLOR[t.layer] ?? T.dim} border="1px solid"
          borderColor={T.line} borderRadius="full" px={2} py="1px">{t.layer}</Box>
        <Text fontFamily={MONO} fontSize="10.5px" color={T.dim} ml="auto">{t.grain}</Text>
      </Flex>
      {t.description && (
        <Text fontSize="12.5px" color={T.muted} lineHeight={1.6} mb={3} maxW="86ch">{t.description}</Text>
      )}
      <Box as="table" w="100%" style={{ borderCollapse: "collapse" }}>
        <Box as="tbody">
          {t.columns.map((c) => (
            <Box as="tr" key={c.name}>
              <Box as="td" py="5px" pr={4} verticalAlign="top" whiteSpace="nowrap"
                borderBottom="1px solid" borderColor={T.lineSoft} w="220px">
                <Text as="span" fontFamily={MONO} fontSize="12px" color={T.ink}>{c.name}</Text>
              </Box>
              <Box as="td" py="5px" pr={4} verticalAlign="top" whiteSpace="nowrap"
                borderBottom="1px solid" borderColor={T.lineSoft} w="170px">
                <Text as="span" fontFamily={MONO} fontSize="11px" color={T.dim}>{c.type}</Text>
              </Box>
              <Box as="td" py="5px" verticalAlign="top" borderBottom="1px solid"
                borderColor={T.lineSoft}>
                <Text fontSize="12px" color={T.muted} lineHeight={1.5}>{c.note}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Panel>
  );
}

/* ---------------------------------------------------------------- page */
function Page() {
  const [s, setS] = useState<Schema | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch("/data/madhive-v2-schema.json")
      .then((r) => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); })
      .then(setS)
      .catch((e: Error) => setErr(e.message));
  }, []);

  if (err) {
    return (
      <Flex minH="70vh" align="center" justify="center" direction="column" gap={2}>
        <Text color={T.ink} fontWeight={600}>Couldn't load the schema.</Text>
        <Text fontFamily={MONO} fontSize="13px" color={T.muted}>{err}</Text>
      </Flex>
    );
  }
  if (!s) {
    return (
      <Flex minH="70vh" align="center" justify="center" gap={3}>
        <Spinner size="sm" color={T.dim} /><Text fontSize="13px" color={T.muted}>Loading…</Text>
      </Flex>
    );
  }

  const fieldCols: Column<Field>[] = [
    { key: "name", label: "Field", sort: (f) => f.name, width: "210px",
      render: (f) => (
        <Flex align="baseline" gap={1.5}>
          <Text as="span" fontFamily={MONO} fontSize="12px" color={T.ink}>{f.name}</Text>
          {f.optional && <Text as="span" fontFamily={MONO} fontSize="9.5px" color={T.dim}>opt</Text>}
        </Flex>
      ) },
    { key: "type", label: "Type", sort: (f) => f.type, width: "150px",
      render: (f) => <Text as="span" fontFamily={MONO} fontSize="11px" color={T.dim}>{f.type}</Text> },
    { key: "example", label: "Example", width: "180px",
      render: (f) => <Text as="span" fontFamily={MONO} fontSize="11px" color={T.muted} noOfLines={1}>{f.example ?? "—"}</Text> },
    { key: "range", label: "Range", width: "170px",
      render: (f) => <Text as="span" fontFamily={MONO} fontSize="11px" color={T.dim}>{f.range ?? "—"}</Text> },
    { key: "note", label: "Meaning", render: (f) => (
      <Text fontSize="12px" color={T.muted} lineHeight={1.5} whiteSpace="normal">{f.note}</Text>
    ) },
  ];

  const lineageCols: Column<Schema["lineage"][number]>[] = [
    { key: "section", label: "Section", sort: (l) => l.section, width: "230px" },
    { key: "widget", label: "Widget", sort: (l) => l.widget, width: "260px" },
    { key: "reads", label: "Reads", render: (l) => (
      <Flex gap={1.5} wrap="wrap">{l.reads.map((r) => <C key={r}>{r}</C>)}</Flex>
    ) },
  ];

  const byLayer = s.layers.map((l) => ({ ...l, tables: s.tables.filter((t) => t.layer === l.name) }));

  return (
    <Box bg={T.bg} minH="100vh" color={T.ink}>
      <Box maxW="1320px" mx="auto" px={{ base: 4, md: 7 }} pb={24}>
        <Flex justify="space-between" align="flex-start" gap={4} wrap="wrap"
          pt={{ base: 8, md: 11 }} pb={6}>
          <Box>
            <Text fontSize={{ base: "23px", md: "27px" }} fontWeight={650} letterSpacing="-0.022em"
              lineHeight={1.15}>{s.advertiser}</Text>
            <Text fontSize={{ base: "23px", md: "27px" }} fontWeight={650} letterSpacing="-0.022em"
              lineHeight={1.15} color={T.muted}>Data model</Text>
          </Box>
          <Flex gap={{ base: 5, md: 7 }} wrap="wrap" pt={1}>
            {[["Tables", String(s.tables.length)],
              ["Transformations", String(s.transforms.reduce((a, t) => a + t.steps.length, 0))],
              ["Served collections", String(s.collections.length)],
              ["Rows on record", s.collections.reduce((a, c) => a + c.rows, 0).toLocaleString("en-US")],
              ["Payload", `${Math.round(s.files.reduce((a, f) => a + f.bytes, 0) / 1024)} KB`]].map(([k, v]) => (
              <Box key={k} textAlign={{ base: "left", sm: "right" }}>
                <Label as="div" mb="3px">{k}</Label>
                <Text fontFamily={MONO} fontSize="16px" fontWeight={600} color={T.ink}
                  sx={{ fontVariantNumeric: "tabular-nums" }}>{v}</Text>
              </Box>
            ))}
          </Flex>
        </Flex>

        <Text fontSize="13px" color={T.muted} maxW="90ch" lineHeight={1.7} mb={2}>
          Everything behind{" "}
          <Text as="a" href="/madhive/" color={T.focus} textDecoration="underline">the dashboard</Text>:
          the warehouse tables that would produce it, the exact shape of the JSON the browser
          fetches, and which panel reads what. The field tables below are introspected from the
          shipped files rather than written by hand, so they cannot drift from what is live.
        </Text>
        <Text fontFamily={MONO} fontSize="11px" color={T.dim} mb={9}>
          {s.window.first} to {s.window.last} · generated {s.generatedAt.slice(0, 10)}
        </Text>

        <SectionTitle>How it is built</SectionTitle>
        <Panel><Pipeline layers={s.layers} /></Panel>
        <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }} gap={3} mt={3}>
          {s.layers.map((l) => (
            <Panel key={l.name}>
              <Flex align="center" gap={2} mb={1.5}>
                <Box w="9px" h="9px" borderRadius="2px" bg={LAYER_COLOR[l.name] ?? T.dim} />
                <Text fontSize="13px" fontWeight={600} color={T.ink}>{l.name}</Text>
              </Flex>
              <Text fontFamily={MONO} fontSize="10.5px" color={T.dim} mb={1.5}>{l.short}</Text>
              <Text fontSize="12.5px" color={T.muted} lineHeight={1.6}>{l.purpose}</Text>
            </Panel>
          ))}
        </Grid>

        <Box mt={10}><SectionTitle>How the facts relate</SectionTitle></Box>
        <Panel><Erd /></Panel>

        {byLayer.map((l) => {
          const next = s.transforms.find((t) => t.frm === l.name);
          return (
            <Box key={l.name} mt={10}>
              <SectionTitle>
                {l.name} — {l.tables.length} table{l.tables.length === 1 ? "" : "s"}
              </SectionTitle>
              <Flex direction="column" gap={3}>
                {l.tables.map((t) => <TableCard key={t.name} t={t} />)}
              </Flex>
              {next && (
                <Box mt={5}>
                  <Flex align="center" gap={3} mb={3}>
                    <Box w="9px" h="9px" borderRadius="2px" bg={LAYER_COLOR[next.frm]} />
                    <Text fontSize="13px" fontWeight={600} color={T.ink}>
                      {next.frm} to {next.to}
                    </Text>
                    <Box flex="1" h="1px" bg={T.lineSoft} />
                    <Box w="9px" h="9px" borderRadius="2px" bg={LAYER_COLOR[next.to]} />
                    <Text fontFamily={MONO} fontSize="10.5px" color={T.dim}>
                      {next.steps.length} transformations
                    </Text>
                  </Flex>
                  <Grid templateColumns={{ base: "1fr", lg: "repeat(2, 1fr)" }} gap={3}>
                    {next.steps.map((st, i) => (
                      <Panel key={st.title}>
                        <Flex align="baseline" gap={2.5} mb={1.5}>
                          <Text fontFamily={MONO} fontSize="11px" color={T.dim}>
                            {String(i + 1).padStart(2, "0")}
                          </Text>
                          <Text fontSize="13px" fontWeight={600} color={T.ink}>{st.title}</Text>
                        </Flex>
                        <Text fontSize="12.5px" color={T.muted} lineHeight={1.65} mb={2.5}>
                          {st.detail}
                        </Text>
                        <Text fontFamily={MONO} fontSize="11px" color={T.dim}>{st.tables}</Text>
                      </Panel>
                    ))}
                  </Grid>
                </Box>
              )}
            </Box>
          );
        })}

        <Box mt={10}>
          <SectionTitle>The same rows, traced through the layers</SectionTitle>
          <Text fontSize="13px" color={T.muted} maxW="94ch" lineHeight={1.7} mb={4}>
            Gold rows below are lifted straight out of the shipped JSON. The bronze and silver
            rows above them are illustrative — this demo carries no event-level data — and are
            marked as such rather than dressed up as observed.
          </Text>
          <Flex direction="column" gap={3}>
            {s.worked.map((w) => <WorkedTrace key={w.title} w={w} />)}
          </Flex>
        </Box>

        <Box mt={10}>
          <SectionTitle>What ships to the browser</SectionTitle>
          <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={3} mb={4}>
            {s.files.map((f) => (
              <Panel key={f.path}>
                <Flex align="baseline" gap={3} mb={1}>
                  <Text fontFamily={MONO} fontSize="12.5px" color={T.ink}>{f.path}</Text>
                  <Text fontFamily={MONO} fontSize="11px" color={T.dim} ml="auto">
                    {Math.round(f.bytes / 1024)} KB
                  </Text>
                </Flex>
                <Text fontSize="12.5px" color={T.muted}>{f.description}</Text>
              </Panel>
            ))}
          </Grid>
          <Flex direction="column" gap={3}>
            {s.collections.map((c) => (
              <Panel key={c.name}>
                <Flex align="baseline" gap={3} wrap="wrap" mb={1}>
                  <Text fontFamily={MONO} fontSize="13.5px" fontWeight={600} color={T.ink}>{c.name}</Text>
                  <Text fontFamily={MONO} fontSize="10.5px" color={T.dim}>
                    {c.rows.toLocaleString("en-US")} rows · from {c.source}
                  </Text>
                </Flex>
                <Text fontSize="12.5px" color={T.muted} mb={3} maxW="86ch">{c.description}</Text>
                <DataTable columns={fieldCols} rows={c.fields} rowKey={(f) => f.name}
                  minW="920px" initialSort={{ key: "name", dir: "asc" }} />
              </Panel>
            ))}
          </Flex>
        </Box>

        <Box mt={10}>
          <SectionTitle>Which panel reads what</SectionTitle>
          <Panel>
            <DataTable columns={lineageCols} rows={s.lineage}
              rowKey={(l) => `${l.section}-${l.widget}`} minW="820px"
              initialSort={{ key: "section", dir: "asc" }} />
          </Panel>
        </Box>

        <Box mt={10}>
          <SectionTitle>Rules the model holds to</SectionTitle>
          <Grid templateColumns={{ base: "1fr", lg: "repeat(2, 1fr)" }} gap={3}>
            {s.rules.map((r) => (
              <Panel key={r.title}>
                <Text fontSize="13px" fontWeight={600} color={T.ink} mb={1.5}>{r.title}</Text>
                <Text fontSize="12.5px" color={T.muted} lineHeight={1.65}>{r.body}</Text>
              </Panel>
            ))}
          </Grid>
        </Box>

        <Box mt={14} pt={5} borderTop="1px solid" borderColor={T.line}>
          <Text fontFamily={MONO} fontSize="11px" color={T.dim} lineHeight={1.8}>
            Synthetic demonstration data for a fictional advertiser. Boundaries: {s.source.zcta};{" "}
            {s.source.nation}. {s.source.note}
            <br />
            Schema introspected by <C>scripts/generate_madhive_v2_schema.py</C>. Sharon Kwong.
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}><Page /></ChakraProvider>
  </React.StrictMode>
);
