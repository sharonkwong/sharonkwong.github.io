import { Box, Flex, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { daysBetween } from "./data";
import { Label, MONO, T } from "./ui";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => new Date(`${s}T00:00:00`);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const pretty = (s: string) =>
  parse(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/** Anchored to the newest day on record, so a preset always lands on data. */
const PRESETS: [string, number][] = [
  ["Past 3 days", 3], ["Past week", 7], ["Past month", 30],
  ["Past quarter", 90], ["Past year", 365],
];

/** The days of one calendar month, padded to whole weeks with nulls. */
function monthGrid(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const days: (Date | null)[] = Array(first.getDay()).fill(null);
  const n = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  for (let i = 1; i <= n; i++) days.push(new Date(anchor.getFullYear(), anchor.getMonth(), i));
  while (days.length % 7) days.push(null);
  return days;
}

/**
 * Two months, always. Opening from Start takes two clicks (start, then end);
 * opening from End takes one and closes. The range fills in as you go, and
 * hovering previews where the second click would land.
 */
export default function DateRange({ start, end, min, max, onChange }: {
  start: string; end: string; min: string; max: string;
  onChange: (r: { start: string; end: string }) => void;
}) {
  const [open, setOpen] = useState<null | "start" | "end">(null);
  const [pending, setPending] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [anchor, setAnchor] = useState(() => addMonths(parse(end), -1));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(null); setPending(null); }
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(null); setPending(null); } };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, []);

  const launch = (which: "start" | "end") => {
    setOpen(which);
    setPending(null);
    setHover(null);
    setAnchor(addMonths(parse(which === "start" ? start : end), which === "start" ? 0 : -1));
  };

  // What the range looks like right now, including the half-made one.
  const shown = useMemo(() => {
    if (open === "start" && pending) {
      const other = hover ?? pending;
      return pending <= other ? { a: pending, b: other } : { a: other, b: pending };
    }
    if (open === "start" && !pending) return { a: "", b: "" };
    return { a: start, b: end };
  }, [open, pending, hover, start, end]);

  const pick = (day: string) => {
    if (open === "end") {
      onChange({ start: day < start ? day : start, end: day < start ? start : day });
      setOpen(null);
      return;
    }
    if (!pending) { setPending(day); return; }
    const [a, b] = pending <= day ? [pending, day] : [day, pending];
    onChange({ start: a, end: b });
    setPending(null);
    setOpen(null);
  };

  const applyPreset = (days: number) => {
    const last = parse(max);
    const from = new Date(last);
    from.setDate(from.getDate() - (days - 1));
    onChange({ start: iso(from) < min ? min : iso(from), end: max });
    setPending(null);
    setOpen(null);
  };
  const presetDays = daysBetween(start, end);
  const activePreset = end === max ? PRESETS.find(([, d]) => d === presetDays)?.[0] : undefined;

  const canBack = iso(addMonths(anchor, -1)) >= `${min.slice(0, 7)}-01`;
  const canFwd = iso(addMonths(anchor, 2)) <= `${max.slice(0, 7)}-01`;

  const field = (which: "start" | "end", label: string, value: string) => (
    <Box>
      <Label as="div" mb="5px">{label}</Label>
      <Box as="button" type="button" onClick={() => launch(which)}
        aria-haspopup="dialog" aria-expanded={open === which}
        bg={T.surface} border="1px solid" borderColor={open === which ? T.focus : T.line}
        borderRadius="6px" color={T.ink} fontFamily={MONO} fontSize="12.5px"
        px={2.5} py="6px" minH="31px" w="152px" textAlign="left"
        _hover={{ borderColor: open === which ? T.focus : T.dim }}
        _focusVisible={{ outline: "2px solid", outlineColor: T.focus, outlineOffset: "1px" }}
        transition="border-color .12s">
        {pretty(value)}
      </Box>
    </Box>
  );

  return (
    <Box position="relative" ref={ref}>
      <Flex align="flex-end" gap={2}>
        {field("start", "Start date", start)}
        <Text fontSize="12px" color={T.dim} pb="9px">to</Text>
        {field("end", "End date", end)}
      </Flex>

      {open && (
        <Flex position="absolute" top="calc(100% + 6px)" left={0} zIndex={30} role="dialog"
          aria-label="Choose a date range"
          bg={T.raised} border="1px solid" borderColor={T.line} borderRadius="8px" p={3}
          boxShadow="0 16px 40px -10px rgba(0,0,0,.85)" gap={3}>
        <Flex direction="column" gap="2px" pr={3} borderRight="1px solid" borderColor={T.line}
          minW="118px">
          <Label as="div" mb={1.5}>Quick ranges</Label>
          {PRESETS.map(([label, days]) => {
            const on = activePreset === label;
            return (
              <Box key={label} as="button" type="button" onClick={() => applyPreset(days)}
                textAlign="left" px={2} py="5px" borderRadius="5px" fontSize="12px"
                bg={on ? T.surface : "transparent"} color={on ? T.ink : T.muted}
                fontWeight={on ? 600 : 400}
                _hover={{ bg: T.surface, color: T.ink }}
                _focusVisible={{ outline: "2px solid", outlineColor: T.focus, outlineOffset: "1px" }}>
                {label}
              </Box>
            );
          })}
        </Flex>
        <Box>
          <Flex align="center" mb={2.5} px={1}>
            <Box as="button" type="button" aria-label="Previous month" onClick={() => canBack && setAnchor(addMonths(anchor, -1))}
              color={canBack ? T.muted : T.lineSoft} fontSize="13px" px={1.5} py="2px" borderRadius="4px"
              _hover={canBack ? { color: T.ink, bg: T.surface } : undefined}>‹</Box>
            <Flex flex="1" justify="space-around" gap={4}>
              {[0, 1].map((i) => (
                <Text key={i} fontSize="12.5px" fontWeight={600} color={T.ink} w="196px" textAlign="center">
                  {addMonths(anchor, i).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </Text>
              ))}
            </Flex>
            <Box as="button" type="button" aria-label="Next month" onClick={() => canFwd && setAnchor(addMonths(anchor, 1))}
              color={canFwd ? T.muted : T.lineSoft} fontSize="13px" px={1.5} py="2px" borderRadius="4px"
              _hover={canFwd ? { color: T.ink, bg: T.surface } : undefined}>›</Box>
          </Flex>

          <Flex gap={4} onMouseLeave={() => setHover(null)}>
            {[0, 1].map((i) => {
              const m = addMonths(anchor, i);
              return (
                <Box key={i} w="196px">
                  <Flex mb={1}>
                    {DOW.map((d, j) => (
                      <Text key={j} flex="1" textAlign="center" fontFamily={MONO} fontSize="9.5px"
                        color={T.dim}>{d}</Text>
                    ))}
                  </Flex>
                  <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" rowGap="2px">
                    {monthGrid(m).map((d, j) => {
                      if (!d) return <Box key={j} h="26px" />;
                      const s = iso(d);
                      const disabled = s < min || s > max;
                      const isA = s === shown.a, isB = s === shown.b;
                      const inRange = !!shown.a && !!shown.b && s > shown.a && s < shown.b;
                      const edge = isA || isB;
                      return (
                        <Box key={j} as="button" type="button" disabled={disabled}
                          aria-label={pretty(s)} aria-pressed={edge}
                          onClick={() => !disabled && pick(s)}
                          onMouseEnter={() => !disabled && setHover(s)}
                          h="26px" fontFamily={MONO} fontSize="11.5px" lineHeight="26px"
                          borderRadius={isA && isB ? "4px" : isA ? "4px 0 0 4px" : isB ? "0 4px 4px 0" : inRange ? "0" : "4px"}
                          bg={edge ? T.focus : inRange ? `${T.focus}26` : "transparent"}
                          color={disabled ? T.lineSoft : edge ? T.bg : inRange ? T.ink : T.muted}
                          fontWeight={edge ? 700 : 400}
                          cursor={disabled ? "default" : "pointer"}
                          _hover={!disabled && !edge ? { bg: inRange ? `${T.focus}3d` : T.surface, color: T.ink } : undefined}
                          _focusVisible={{ outline: "2px solid", outlineColor: T.focus, outlineOffset: "-2px" }}
                          transition="background .1s">
                          {d.getDate()}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              );
            })}
          </Flex>

          <Text fontFamily={MONO} fontSize="10.5px" color={T.dim} mt={2.5} px={1}>
            {open === "end"
              ? "Pick an end date"
              : pending
              ? `${pretty(pending)} → pick an end date`
              : "Pick a start date, then an end date"}
          </Text>
        </Box>
        </Flex>
      )}
    </Box>
  );
}
