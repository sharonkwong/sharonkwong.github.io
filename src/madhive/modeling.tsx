import { Box, ChakraProvider, HStack, Text } from "@chakra-ui/react";
import React from "react";
import ReactDOM from "react-dom/client";
import theme from "../theme";
import { INK, MUTED, Panel, RULE, SectionHead } from "./ui";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/* --------------------------------------------------------------- helpers */
function Table({ head, rows, widths }: {
  head: string[]; rows: React.ReactNode[][]; widths?: string[];
}) {
  return (
    <Box overflowX="auto" border="1px solid" borderColor={RULE} borderRadius="8px" bg="white">
      <Box as="table" w="100%" minW="700px" fontSize="13px" style={{ borderCollapse: "collapse" }}>
        <Box as="thead">
          <Box as="tr">
            {head.map((h, i) => (
              <Box as="th" key={h} textAlign="left" fontFamily={MONO} fontSize="9.5px"
                letterSpacing="0.11em" textTransform="uppercase" color={MUTED} fontWeight={600}
                py={3} px={3} borderBottom="1px solid" borderColor="gray.300" bg="gray.50"
                whiteSpace="nowrap" width={widths?.[i]}>{h}</Box>
            ))}
          </Box>
        </Box>
        <Box as="tbody">
          {rows.map((r, i) => (
            <Box as="tr" key={i} _hover={{ bg: "gray.50" }}>
              {r.map((cell, j) => (
                <Box as="td" key={j} py={3} px={3} borderBottom="1px solid" borderColor={RULE}
                  color={j === 0 ? INK : "gray.600"} fontWeight={j === 0 ? 600 : 400}
                  lineHeight={1.55} verticalAlign="top">{cell}</Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

const C = ({ children }: { children: React.ReactNode }) => (
  <Box as="code" fontFamily={MONO} fontSize="0.86em" bg="gray.100" border="1px solid"
    borderColor={RULE} borderRadius="3px" px="4px" py="1px" whiteSpace="nowrap">{children}</Box>
);

function Note({ tag, tone = "neutral", children }: {
  tag: string; tone?: "neutral" | "warn" | "key"; children: React.ReactNode;
}) {
  const border = tone === "warn" ? "red.400" : tone === "key" ? "blue.400" : "gray.300";
  const color = tone === "warn" ? "red.500" : tone === "key" ? "blue.600" : MUTED;
  return (
    <Box border="1px solid" borderColor={RULE} borderLeft="3px solid" borderLeftColor={border}
      bg={tone === "neutral" ? "gray.50" : "white"} borderRadius="0 8px 8px 0" p={4} my={4}>
      <Text fontFamily={MONO} fontSize="10px" letterSpacing="0.15em" textTransform="uppercase"
        fontWeight={700} color={color} mb={2}>{tag}</Text>
      <Box fontSize="14px" color="gray.700" lineHeight={1.65} sx={{ "& p + p": { mt: 2.5 } }}>
        {children}
      </Box>
    </Box>
  );
}

/* ------------------------------------------------------------ diagram 1 */
function PipelineDiagram() {
  const box = (x: number, y: number, w: number, h: number, stroke: string) =>
    <rect x={x} y={y} width={w} height={h} rx={5} fill="var(--chakra-colors-white)"
      stroke={stroke} strokeWidth={2} />;
  return (
    <figure style={{ margin: 0 }}>
      <Box border="1px solid" borderColor={RULE} borderRadius="8px" bg="white" p={5} overflowX="auto">
        <svg viewBox="0 0 980 330" role="img" style={{ display: "block", minWidth: 760, width: "100%", height: "auto" }}
          aria-label="Three sources land in bronze as raw append-only files, are conformed and identity-resolved in silver, aggregated into gold metric tables, materialised into a serving cache, and read by the dashboard.">
          <defs>
            <marker id="pa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          <g fontFamily={MONO} fill="currentColor">
            {/* column headers */}
            {[["SOURCES", 105], ["BRONZE", 300], ["SILVER", 490], ["GOLD", 675], ["CACHE → UI", 862]].map(([t, x]) => (
              <text key={String(t)} x={x as number} y={20} textAnchor="middle" fontSize={10}
                fontWeight={700} fill="var(--chakra-colors-gray-500)" letterSpacing="1.4">{t}</text>
            ))}

            {/* sources */}
            {box(18, 40, 175, 52, "#8a8f98")}
            <text x={105} y={62} textAnchor="middle" fontSize={11.5} fontWeight={700}>3rd-party platform</text>
            <text x={105} y={78} textAnchor="middle" fontSize={9.5} fill="var(--chakra-colors-gray-500)">DSP delivery + ghost bids</text>
            {box(18, 106, 175, 52, "#8a8f98")}
            <text x={105} y={128} textAnchor="middle" fontSize={11.5} fontWeight={700}>1st-party (advertiser)</text>
            <text x={105} y={144} textAnchor="middle" fontSize={9.5} fill="var(--chakra-colors-gray-500)">CRM, list, service records</text>
            {box(18, 172, 175, 52, "#8a8f98")}
            <text x={105} y={194} textAnchor="middle" fontSize={11.5} fontWeight={700}>Pixel / site events</text>
            <text x={105} y={210} textAnchor="middle" fontSize={9.5} fill="var(--chakra-colors-gray-500)">conversions, page views</text>

            {/* bronze */}
            {box(222, 78, 155, 118, "#b07d2a")}
            <text x={300} y={104} textAnchor="middle" fontSize={12} fontWeight={700}>Raw landing</text>
            <text x={300} y={124} textAnchor="middle" fontSize={9.5} fill="var(--chakra-colors-gray-500)">exactly as received</text>
            <text x={300} y={139} textAnchor="middle" fontSize={9.5} fill="var(--chakra-colors-gray-500)">append-only, never</text>
            <text x={300} y={153} textAnchor="middle" fontSize={9.5} fill="var(--chakra-colors-gray-500)">edited or deleted</text>
            <text x={300} y={175} textAnchor="middle" fontSize={9} fill="var(--chakra-colors-gray-400)">partitioned by load date</text>

            {/* silver */}
            {box(412, 78, 155, 118, "#7c8794")}
            <text x={490} y={104} textAnchor="middle" fontSize={12} fontWeight={700}>Conformed</text>
            <text x={490} y={124} textAnchor="middle" fontSize={9.5} fill="var(--chakra-colors-gray-500)">deduped, typed,</text>
            <text x={490} y={139} textAnchor="middle" fontSize={9.5} fill="var(--chakra-colors-gray-500)">identity resolved</text>
            <text x={490} y={153} textAnchor="middle" fontSize={9.5} fill="var(--chakra-colors-gray-500)">still event-level</text>
            <text x={490} y={175} textAnchor="middle" fontSize={9} fill="var(--chakra-colors-gray-400)">rebuilt for trailing 7d</text>

            {/* gold */}
            {box(597, 78, 155, 118, "#c9a227")}
            <text x={675} y={104} textAnchor="middle" fontSize={12} fontWeight={700}>Metrics</text>
            <text x={675} y={124} textAnchor="middle" fontSize={9.5} fill="var(--chakra-colors-gray-500)">business aggregates</text>
            <text x={675} y={139} textAnchor="middle" fontSize={9.5} fill="var(--chakra-colors-gray-500)">one row per entity</text>
            <text x={675} y={153} textAnchor="middle" fontSize={9.5} fill="var(--chakra-colors-gray-500)">+ period</text>
            <text x={675} y={175} textAnchor="middle" fontSize={9} fill="var(--chakra-colors-gray-400)">where a metric is defined</text>

            {/* cache */}
            {box(782, 78, 175, 118, "#2a78d6")}
            <text x={869} y={104} textAnchor="middle" fontSize={12} fontWeight={700}>Serving tables</text>
            <text x={869} y={124} textAnchor="middle" fontSize={9.5} fill="var(--chakra-colors-gray-500)">denormalised, shaped</text>
            <text x={869} y={139} textAnchor="middle" fontSize={9.5} fill="var(--chakra-colors-gray-500)">to the screen that</text>
            <text x={869} y={153} textAnchor="middle" fontSize={9.5} fill="var(--chakra-colors-gray-500)">reads them</text>
            <text x={869} y={175} textAnchor="middle" fontSize={9} fill="var(--chakra-colors-gray-400)">one query, no joins</text>

            {/* arrows into bronze */}
            <path d="M 193 66 L 208 66 L 208 120 L 216 120" fill="none" stroke="currentColor" strokeWidth={1.4} markerEnd="url(#pa)" />
            <path d="M 193 132 L 216 132" fill="none" stroke="currentColor" strokeWidth={1.4} markerEnd="url(#pa)" />
            <path d="M 193 198 L 208 198 L 208 144 L 216 144" fill="none" stroke="currentColor" strokeWidth={1.4} markerEnd="url(#pa)" />
            <text x={205} y={250} textAnchor="middle" fontSize={9} fill="var(--chakra-colors-gray-500)">hourly S3 · daily SFTP</text>
            <text x={205} y={263} textAnchor="middle" fontSize={9} fill="var(--chakra-colors-gray-500)">· streaming</text>

            <line x1="377" y1="137" x2="406" y2="137" stroke="currentColor" strokeWidth={1.6} markerEnd="url(#pa)" />
            <line x1="567" y1="137" x2="591" y2="137" stroke="currentColor" strokeWidth={1.6} markerEnd="url(#pa)" />
            <line x1="752" y1="137" x2="776" y2="137" stroke="currentColor" strokeWidth={1.6} markerEnd="url(#pa)" />

            <text x={391} y={128} textAnchor="middle" fontSize={9} fill="var(--chakra-colors-gray-500)">clean</text>
            <text x={579} y={128} textAnchor="middle" fontSize={9} fill="var(--chakra-colors-gray-500)">aggregate</text>
            <text x={764} y={128} textAnchor="middle" fontSize={9} fill="var(--chakra-colors-gray-500)">materialise</text>

            {/* dashboard */}
            {box(782, 232, 175, 40, "#2a78d6")}
            <text x={869} y={257} textAnchor="middle" fontSize={11.5} fontWeight={700}>Dashboard</text>
            <line x1="869" y1="196" x2="869" y2="226" stroke="currentColor" strokeWidth={1.6} markerEnd="url(#pa)" />

            {/* rebuild loop */}
            <path d="M 490 196 L 490 300 L 300 300 L 300 202" fill="none" stroke="currentColor"
              strokeWidth={1.2} strokeDasharray="4 3" markerEnd="url(#pa)" />
            <text x={395} y={315} textAnchor="middle" fontSize={9} fill="var(--chakra-colors-gray-500)">
              late-arriving events reprocessed from bronze
            </text>
          </g>
        </svg>
      </Box>
      <Text as="figcaption" fontSize="13px" color={MUTED} mt={3} lineHeight={1.6} maxW="82ch">
        <b>Each layer has one job.</b> Bronze keeps what arrived so it can always be replayed.
        Silver makes rows comparable. Gold is where a metric gets its definition. The cache exists
        only so the page loads in one query. The dashed path is the one that matters in practice —
        pixel events arrive late, so silver is rebuilt from bronze on a trailing window rather than
        appended to.
      </Text>
    </figure>
  );
}

/* ------------------------------------------------------------ diagram 2 */
function WindowDiagram() {
  const X = (d: number) => 60 + d * 8.2;   // day index -> x
  return (
    <figure style={{ margin: 0 }}>
      <Box border="1px solid" borderColor={RULE} borderRadius="8px" bg="white" p={5} overflowX="auto">
        <svg viewBox="0 0 900 290" role="img" style={{ display: "block", minWidth: 720, width: "100%", height: "auto" }}
          aria-label="The lift test ran 22 June to 19 July, its conversion window closed 2 August, and the result froze then. The dashboard reporting period is 19 July to 17 August, so the lift shown comes from a test that finished before the reporting period began.">
          <defs>
            <marker id="wa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          <g fontFamily={MONO} fill="currentColor">
            {/* axis */}
            <line x1={X(0)} y1={250} x2={X(88)} y2={250} stroke="var(--chakra-colors-gray-400)" strokeWidth={1} />
            {[[0, "Jun 22"], [27, "Jul 19"], [41, "Aug 2"], [57, "Aug 17"]].map(([d, l]) => (
              <g key={String(l)}>
                <line x1={X(d as number)} y1={246} x2={X(d as number)} y2={254}
                  stroke="var(--chakra-colors-gray-400)" strokeWidth={1} />
                <text x={X(d as number)} y={270} textAnchor="middle" fontSize={10}
                  fill="var(--chakra-colors-gray-500)">{l}</text>
              </g>
            ))}

            {/* test window — labels sit above the bars so they cannot be clipped */}
            <text x={X(0)} y={40} fontSize={11} fontWeight={700}>Lift test — control withheld</text>
            <text x={X(0)} y={53} fontSize={9} fill="var(--chakra-colors-gray-500)">assignment frozen at the start</text>
            <rect x={X(0)} y={60} width={X(27) - X(0)} height={26} rx={4} fill="#eb6834" opacity={0.85} />

            {/* conversion window */}
            <rect x={X(27)} y={60} width={X(41) - X(27)} height={26} rx={4} fill="#eb6834" opacity={0.28} />
            <text x={(X(27) + X(41)) / 2} y={77} textAnchor="middle" fontSize={9.5} fontWeight={700}>
              +14d
            </text>

            {/* freeze marker */}
            <line x1={X(41)} y1={34} x2={X(41)} y2={250} stroke="#0ca30c" strokeWidth={1.6} strokeDasharray="4 3" />
            <text x={X(41) + 7} y={100} fontSize={10} fontWeight={700} fill="#0ca30c">window closes —</text>
            <text x={X(41) + 7} y={113} fontSize={10} fontWeight={700} fill="#0ca30c">result frozen here</text>

            {/* reporting period */}
            <text x={X(27)} y={146} fontSize={11} fontWeight={700}>Dashboard reporting period</text>
            <text x={X(27)} y={159} fontSize={9} fill="var(--chakra-colors-gray-500)">rolling 30 days, refreshed every morning</text>
            <rect x={X(27)} y={166} width={X(57) - X(27)} height={26} rx={4} fill="#2a78d6" opacity={0.85} />

            {/* the join */}
            <path d={`M ${X(43)} 120 C ${X(52)} 128, ${X(56)} 140, ${X(56)} 162`} fill="none"
              stroke="currentColor" strokeWidth={1.3} strokeDasharray="3 3" markerEnd="url(#wa)" />

            <text x={X(0)} y={214} fontSize={10} fill="var(--chakra-colors-gray-500)">
              The lift on screen describes the test window — not the period the dashboard is showing.
            </text>
            <text x={X(0)} y={229} fontSize={10} fill="var(--chakra-colors-gray-500)">
              Two clocks, one screen: conversions move daily, lift moves once per test.
            </text>
          </g>
        </svg>
      </Box>
      <Text as="figcaption" fontSize="13px" color={MUTED} mt={3} lineHeight={1.6} maxW="82ch">
        <b>Lift is bounded by its test, not by the dashboard's date filter.</b> The result only
        becomes valid once the conversion window closes, and it then stops moving. Changing the
        dashboard's date range must not silently recompute it.
      </Text>
    </figure>
  );
}

/* ----------------------------------------------------------------- page */
function Page() {
  return (
    <Box bg="gray.50" minH="100vh">
      <Box maxW="1180px" mx="auto" px={{ base: 5, md: 8 }} pb={24}>
        <Box pt={{ base: 10, md: 14 }} pb={5} borderBottom="2px solid" borderColor={INK} mb={6}>
          <HStack spacing={3} mb={4} wrap="wrap" fontFamily={MONO} fontSize="10.5px"
            letterSpacing="0.13em" textTransform="uppercase" color={MUTED}>
            <Text as="a" href="../" _hover={{ color: INK }}>← Back to dashboard</Text>
            <Text color="gray.300">/</Text>
            <Text>Data model</Text>
          </HStack>
          <Text as="h1" fontSize={{ base: "30px", md: "42px" }} fontWeight={800}
            letterSpacing="-0.032em" lineHeight={1.05} color={INK} maxW="20ch" mb={3}>
            How the numbers get built
          </Text>
          <Text fontSize={{ base: "15px", md: "17px" }} color="gray.600" maxW="70ch">
            Source files through ingestion, bronze, silver, gold and the cached layer the dashboard
            actually reads — traced through lift, which is the awkward one.
          </Text>
        </Box>

        {/* 1 */}
        <SectionHead title="The shape"
          sub="Three sources, four layers, one query at the end." />
        <PipelineDiagram />

        <Box mt={6}>
          <Table
            head={["Layer", "What lives there", "Grain", "Rewritten?"]}
            widths={["120px", "", "180px", "180px"]}
            rows={[
              ["Bronze", <>Exactly what the source sent, unparsed. <C>bronze.dsp_delivery</C>, <C>bronze.crm_export</C>, <C>bronze.pixel_event</C></>,
                "One row per source row", "Never. Append-only, partitioned by load date."],
              ["Silver", <>Typed, deduplicated, identity-resolved. <C>silver.impression</C>, <C>silver.conversion</C>, <C>silver.customer</C></>,
                "One row per real-world event", "Trailing 7 days, rebuilt from bronze"],
              ["Gold", <>Where a metric gets its definition. <C>gold.channel_daily</C>, <C>gold.lift_result</C></>,
                "One row per entity + period", "Daily, or on test maturity"],
              ["Cache", <>Shaped to the screen. <C>cache.dashboard_channel</C>, <C>cache.channel_lift</C></>,
                "One row per thing the UI draws", "On refresh, ~06:00"],
            ]}
          />
        </Box>

        <Note tag="Why a cache layer at all" tone="key">
          <p>
            Gold is modelled for correctness — narrow tables, one row per entity per period, joined
            at read time. That is the right shape to reason about and the wrong shape to serve a
            page from: the dashboard would issue a dozen joins on every load.
          </p>
          <p>
            The cache is a deliberate denormalisation, one row per thing the UI draws. It holds no
            logic of its own. If a number is wrong there, the bug is upstream — which is the point,
            because it means there is exactly one place a metric is defined.
          </p>
        </Note>

        {/* 2 */}
        <Box mt={12}>
          <SectionHead title="Three sources, three different problems"
            sub="They arrive on different clocks, at different grains, with different identifiers." />
          <Table
            head={["Source", "Arrives", "Grain", "The problem it brings"]}
            widths={["190px", "150px", "", ""]}
            rows={[
              [<>3rd-party platform<br /><Text as="span" fontSize="11px" color={MUTED} fontWeight={400}>DSP delivery logs</Text></>,
                "Hourly batch to S3",
                "One row per impression or bid",
                "Restated. The platform revises the previous day's log for discrepancies, so yesterday's file is not final."],
              [<>1st-party<br /><Text as="span" fontSize="11px" color={MUTED} fontWeight={400}>advertiser CRM + list</Text></>,
                "Daily SFTP drop",
                "One row per customer, full snapshot",
                "A snapshot, not a change feed — you have to diff it yourself to know what changed."],
              [<>Pixel / site<br /><Text as="span" fontSize="11px" color={MUTED} fontWeight={400}>conversion events</Text></>,
                "Streaming, seconds",
                "One row per event",
                "Late and duplicated. Retries, offline queues and ad blockers mean events land hours late or twice."],
            ]}
          />
          <Note tag="What silver is actually for">
            <p>
              Those three problems are the entire reason a silver layer exists. Restatement means you
              cannot trust yesterday's bronze partition, so silver is rebuilt on a trailing window.
              Duplicated pixel events mean silver deduplicates on an event key. Snapshot CRM means
              silver derives the change feed.
            </p>
            <p>
              And all three arrive with <strong>different identifiers</strong> — a device ID, a
              hashed email, a cookie. Resolving those to one person is silver's other job, and it is
              probabilistic, which is why anything downstream that counts people is a range rather
              than a count.
            </p>
          </Note>
        </Box>

        {/* 3 */}
        <Box mt={12}>
          <SectionHead title="Lift, traced through the layers"
            sub="Most metrics are a sum. Lift is a comparison between two groups over a fixed window, which makes it the useful example." />
          <Table
            head={["Layer", "What happens to lift", "Table"]}
            widths={["110px", "", "260px"]}
            rows={[
              ["Bronze",
                <>The DSP log lands with a control flag on every ghost bid — the auction was won and nothing was served. Kept raw, because the assignment is evidence.</>,
                <C>bronze.dsp_delivery</C>],
              ["Silver",
                <>Impressions and conversions are deduplicated and resolved to a person or household. Conversions are stamped with the identity they belong to, not the pixel that fired.</>,
                <><C>silver.impression</C><br /><C>silver.conversion</C></>],
              ["Silver",
                <>The test registry and the arm assignment. Written once at randomisation and never updated — if assignment can drift, the experiment is void.</>,
                <><C>dim_lift_test</C><br /><C>fct_lift_assignment</C></>],
              ["Gold",
                <>One row per test, channel and arm: how many were in the arm, how many converted inside the window. Lift is computed from these two rows, not stored per user.</>,
                <C>gold.lift_result</C>],
              ["Cache",
                <>The numbers the panel draws, plus the test's own freshness stamp so the page can say which window it describes.</>,
                <C>cache.channel_lift</C>],
            ]}
          />

          <Box mt={4}>
            <Panel title="gold.lift_result — the whole metric in six columns" sub="Everything on the lift panel is derived from this.">
              <Box as="pre" overflowX="auto" bg="gray.50" border="1px solid" borderColor={RULE}
                borderRadius="6px" p={4} fontFamily={MONO} fontSize="12.5px" lineHeight={1.7}>
{`test_id   channel  arm       units    converted   window_state
────────────────────────────────────────────────────────────────
LT-0142   email    exposed   423,200     5,880      final
LT-0142   email    control    36,800       353      final

  exposed rate = 5,880 / 423,200 = 1.278%
  control rate =   353 /  36,800 = 0.959%
  lift         = (1.278 − 0.959) / 1.278 = 25.0%
  caused       = 5,880 × 25.0% = 1,470
  anyway       = 5,880 − 1,470 = 4,410`}
              </Box>
              <Text fontSize="13px" color={MUTED} mt={3} lineHeight={1.6}>
                Two rows produce every number on the lift widget. Storing the rate rather than the
                two counts would make the confidence interval uncomputable — you need the
                denominators.
              </Text>
            </Panel>
          </Box>
        </Box>

        {/* 4 */}
        <Box mt={12}>
          <SectionHead title="The windowing problem"
            sub="You asked the right question — lift is bounded by a window, so what does the UI actually show?" />
          <WindowDiagram />

          <Note tag="Lift cannot be a daily number" tone="warn">
            <p>
              The instinct is to compute lift per day like every other metric and let the date filter
              slice it. That produces nonsense, for two reasons.
            </p>
            <p>
              <strong>The control group is too small to divide.</strong> Email holds out 8% of the
              list. Across a 30-day test that is enough to measure a 25% lift. Cut to a single day
              and the control has a few hundred people and a handful of conversions — the daily
              number would swing wildly and mean nothing.
            </p>
            <p>
              <strong>The conversion window has not closed.</strong> A conversion on 30 July can
              belong to an impression from 18 July. Ask for lift on 18 July before the window shuts
              and you get an answer that keeps rising for a fortnight.
            </p>
          </Note>

          <Note tag="So the model treats a test as an entity, not a time series" tone="key">
            <p>
              A lift test is a row in <C>dim_lift_test</C> with a start, an end, a conversion window
              and a state: <C>running</C> → <C>maturing</C> → <C>final</C>. Its result is computed
              once when the window closes and then frozen.
            </p>
            <p>
              The dashboard does not recompute lift for the period on screen. It joins the current
              channel to <strong>the most recent test for that channel whose window has
              closed</strong>, and shows the window it came from. That is why the panel can sit next
              to conversion numbers that refresh every morning without either being wrong.
            </p>
          </Note>

          <Box mt={4}>
            <Table
              head={["State", "What it means", "Does the UI show it?"]}
              widths={["130px", "", "260px"]}
              rows={[
                [<C>running</C>, "Ads are live, control is being withheld, assignment is frozen.", "No number — the panel shows the test is in flight."],
                [<C>maturing</C>, "Test window closed, conversion window still open. Counts are still rising.", "No number. Showing one here is how you get a metric that quietly moves."],
                [<C>final</C>, "Conversion window closed. Counts complete.", "Yes, with the window it describes."],
                [<C>superseded</C>, "A newer final test exists for this channel.", "Kept for history, not served."],
              ]}
            />
          </Box>
        </Box>

        {/* 5 */}
        <Box mt={12}>
          <SectionHead title="Two clocks on one screen"
            sub="The freshness contract is different per panel, so the page has to say so." />
          <Table
            head={["Panel", "Refreshes", "Describes", "If it changes unexpectedly"]}
            widths={["200px", "140px", "200px", ""]}
            rows={[
              ["Top-line metrics", "Daily, 06:00", "Rolling last 30 days", "Expected — the window moved."],
              ["Daily trend", "Daily, 06:00", "Last 30 days", "Expected, except for the trailing 7 days, which can restate as late events land."],
              ["Cost of next conversion", "Daily, 06:00", "Current spend level", "Expected — it is a function of today's spend."],
              ["Lift", <>On test maturity<br /><Text as="span" fontSize="11px" color={MUTED}>weeks, not days</Text></>,
                "A fixed past test window",
                <Text as="span" color="red.500" fontWeight={600}>Not expected. A final lift number moving means something upstream was rewritten.</Text>],
            ]}
          />
          <Note tag="The rule that falls out of this">
            <p>
              Any panel whose freshness contract differs from the page default has to carry its own
              stamp. The lift panel should read <em>“test window 22 Jun – 19 Jul, final”</em> rather
              than inheriting the page's “as of this morning”.
            </p>
            <p>
              It is a small piece of copy that prevents the most common trust failure in reporting:
              someone changes the date filter, watches one number move and another stay still, and
              concludes the dashboard is broken.
            </p>
          </Note>
        </Box>

        {/* 6 */}
        <Box mt={12}>
          <SectionHead title="What the cache actually stores"
            sub="One row per thing the page draws." />
          <Panel>
            <Box as="pre" overflowX="auto" bg="gray.50" border="1px solid" borderColor={RULE}
              borderRadius="6px" p={4} fontFamily={MONO} fontSize="12.5px" lineHeight={1.7}>
{`cache.channel_lift
──────────────────────────────────────────────────────────────
channel          text        'email'
test_id          text        'LT-0142'
method           text        'Randomised list holdout'
exposed_rate     numeric      0.01278
control_rate     numeric      0.00959
incrementality   numeric      0.250
caused           int          1470
baseline         int          4410
ci_low           numeric      0.214
ci_high          numeric      0.287
window_start     date         2026-06-22
window_end       date         2026-07-19
window_state     text         'final'
computed_at      timestamptz  2026-08-02 04:12 UTC`}
            </Box>
            <Text fontSize="13px" color="gray.600" mt={4} lineHeight={1.65} maxW="82ch">
              Both the rates and the derived numbers are stored. The rates are the evidence and the
              derived figures are what the panel draws — keeping both means the page never
              recalculates, and anyone querying the table can check the arithmetic without
              reconstructing it. <C>window_state</C> and <C>computed_at</C> are what let the UI
              stamp the panel honestly instead of inheriting the page's refresh time.
            </Text>
          </Panel>
        </Box>

        <Box mt={16} pt={5} borderTop="2px solid" borderColor={INK}>
          <Text fontFamily={MONO} fontSize="11px" color={MUTED} lineHeight={1.8}>
            Illustrative architecture for the demo dashboard. Table names and shapes are
            representative rather than a real deployment.{" "}
            <Text as="a" href="../" textDecoration="underline" _hover={{ color: INK }}>
              Back to the dashboard
            </Text>
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
