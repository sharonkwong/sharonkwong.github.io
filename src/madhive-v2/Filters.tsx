import { Box, Flex, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import DateRange from "./DateRange";
import { toCsv } from "./data";
import type { Filters as F } from "./data";
import type { Data, MediaKey } from "./types";
import { Button, Label, T } from "./ui";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Label as="div" mb="5px">{label}</Label>
      {children}
    </Box>
  );
}

const boxSx = {
  bg: T.surface, border: "1px solid", borderColor: T.line, borderRadius: "6px",
  color: T.ink, fontSize: "12.5px", px: 2.5, py: "6px", minH: "31px",
  _focusVisible: { outline: "2px solid", outlineColor: T.focus, outlineOffset: "1px" },
};

/** Multi-select that shows its selection inline; empty selection means all. */
function Multi<V extends string>({ options, value, onChange, allLabel, width, searchable }: {
  options: { value: V; label: string; color?: string }[];
  value: V[]; onChange: (v: V[]) => void; allLabel: string; width: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const shown = searchable && q.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase()))
    : options;
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);
  const label = value.length === 0 ? allLabel
    : value.length === 1 ? options.find((o) => o.value === value[0])?.label ?? allLabel
    : `${value.length} selected`;
  return (
    <Box position="relative" ref={ref} w={width}>
      <Flex as="button" type="button" onClick={() => { setOpen((o) => !o); setQ(""); }}
        aria-haspopup="listbox" aria-expanded={open} sx={boxSx} w="100%" align="center" gap={2}>
        <Text noOfLines={1} textAlign="left" color={value.length ? T.ink : T.muted}>{label}</Text>
        <Box ml="auto" color={T.dim} fontSize="9px">▼</Box>
      </Flex>
      {open && (
        <Box position="absolute" top="calc(100% + 4px)" left={0} zIndex={20} minW="100%"
          bg={T.raised} border="1px solid" borderColor={T.line} borderRadius="6px" py={1}
          boxShadow="0 12px 32px -8px rgba(0,0,0,.8)" role="listbox"
          maxH="316px" overflowY="auto"
          sx={{ "&::-webkit-scrollbar": { width: "8px" },
                "&::-webkit-scrollbar-thumb": { background: T.line, borderRadius: "4px" } }}>
          {searchable && (
            <Box px={2} pt={1} pb={2} position="sticky" top={0} bg={T.raised} zIndex={1}>
              <Box as="input" type="text" value={q} placeholder="Type to search" autoFocus
                aria-label="Search campaigns"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
                sx={{ ...boxSx, bg: T.bg, minH: "28px", py: "4px", _placeholder: { color: T.dim } }}
                w="100%" />
            </Box>
          )}
          <Box as="button" type="button" onClick={() => onChange([])} w="100%" px={3} py="6px"
            fontSize="12.5px" color={value.length ? T.muted : T.ink} textAlign="left"
            _hover={{ bg: T.surface }}>{allLabel}</Box>
          {!shown.length && (
            <Text px={3} py={2} fontSize="12px" color={T.dim}>No campaigns match “{q}”</Text>
          )}
          {shown.map((o) => {
            const on = value.includes(o.value);
            return (
              <Flex key={o.value} as="button" type="button" role="option" aria-selected={on}
                onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
                w="100%" px={3} py="6px" gap={2} align="center" textAlign="left"
                _hover={{ bg: T.surface }}>
                <Box w="12px" h="12px" borderRadius="3px" border="1px solid" flex="0 0 auto"
                  borderColor={on ? T.focus : T.line} bg={on ? T.focus : "transparent"}
                  color={T.bg} fontSize="9px" lineHeight="10px" textAlign="center">{on ? "✓" : ""}</Box>
                {o.color && <Box w="8px" h="8px" borderRadius="2px" bg={o.color} flex="0 0 auto" />}
                <Text fontSize="12.5px" color={T.ink} noOfLines={1}>{o.label}</Text>
              </Flex>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function CopyLink() {
  const [done, setDone] = useState(false);
  const copy = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API needs a secure context; fall back to a throwaway node.
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 1800);
  };
  return (
    <Button onClick={copy} aria-label="Copy a link to this report"
      color={done ? T.up : undefined} borderColor={done ? T.up : undefined}
      px={2.5} display="inline-flex" alignItems="center" gap={1.5}>
      <Box as="svg" viewBox="0 0 16 16" w="13px" h="13px" fill="none"
        stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" flex="0 0 auto">
        <path d="M6.7 9.3a3 3 0 0 0 4.24 0l2.12-2.12a3 3 0 1 0-4.24-4.24l-.7.7" />
        <path d="M9.3 6.7a3 3 0 0 0-4.24 0L2.94 8.82a3 3 0 1 0 4.24 4.24l.7-.7" />
      </Box>
      {done ? "Copied" : "Copy link"}
    </Button>
  );
}

function Schedule() {
  const [open, setOpen] = useState(false);
  const [freq, setFreq] = useState("Weekly");
  const [to, setTo] = useState("");
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);
  return (
    <Box position="relative" ref={ref}>
      <Button onClick={() => { setOpen((o) => !o); setDone(false); }}>Schedule report</Button>
      {open && (
        <Box position="absolute" top="calc(100% + 6px)" right={0} zIndex={20} w="248px"
          bg={T.raised} border="1px solid" borderColor={T.line} borderRadius="8px" p={3}
          boxShadow="0 12px 32px -8px rgba(0,0,0,.8)">
          {done ? (
            <Text fontSize="12.5px" color={T.up}>Scheduled — {freq.toLowerCase()} to {to}</Text>
          ) : (
            <Flex direction="column" gap={2.5}>
              <Box>
                <Label as="div" mb="5px">Frequency</Label>
                <Box as="select" value={freq} sx={boxSx} w="100%"
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFreq(e.target.value)}>
                  {["Daily", "Weekly", "Monthly"].map((o) => <option key={o} value={o}>{o}</option>)}
                </Box>
              </Box>
              <Box>
                <Label as="div" mb="5px">Send to</Label>
                <Box as="input" type="email" value={to} placeholder="name@elitepizza.com" sx={boxSx} w="100%"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTo(e.target.value)} />
              </Box>
              <Button onClick={() => to && setDone(true)}
                bg={T.focus} color={T.bg} borderColor={T.focus} fontWeight={600}
                _hover={{ opacity: 0.9, color: T.bg }}>Schedule</Button>
            </Flex>
          )}
        </Box>
      )}
    </Box>
  );
}

export default function FilterBar({ data, f, set }: {
  data: Data; f: F; set: (p: Partial<F>) => void;
}) {
  const campaignOptions = data.campaigns
    .filter((c) => !f.media.length || f.media.includes(c.mediaType))
    .map((c) => ({
      value: c.id, label: c.name,
      color: data.mediaTypes.find((m) => m.key === c.mediaType)!.color,
    }));

  const exportCsv = () => {
    const rows = data.daily.filter((r) =>
      r.date >= f.start && r.date <= f.end &&
      data.campaigns.some((c) => c.id === r.campaign &&
        (!f.media.length || f.media.includes(c.mediaType)) &&
        (!f.campaigns.length || f.campaigns.includes(c.id))));
    const blob = new Blob([toCsv(rows, data.campaigns)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = window.URL.createObjectURL(blob);
    a.download = `elite-pizza_${f.start}_${f.end}.csv`;
    a.click();
    window.URL.revokeObjectURL(a.href);
  };

  return (
    <Flex align="flex-end" gap={3} wrap="wrap" mb={7}>
      <Text fontSize="12.5px" color={T.muted} pb="7px" pr={1}>Filters</Text>
      <Field label="Media type">
        <Multi width="150px" allLabel="All media"
          options={data.mediaTypes.map((m) => ({ value: m.key, label: m.label, color: m.color }))}
          value={f.media}
          onChange={(media) => set({
            media: media as MediaKey[],
            campaigns: f.campaigns.filter((id) =>
              !media.length || media.includes(data.campaigns.find((c) => c.id === id)!.mediaType)),
          })} />
      </Field>
      <Field label="Campaign">
        <Multi width="210px" allLabel="All campaigns" options={campaignOptions} searchable
          value={f.campaigns} onChange={(campaigns) => set({ campaigns })} />
      </Field>
      <DateRange start={f.start} end={f.end}
        min={data.meta.firstDate} max={data.meta.lastDate}
        onChange={({ start, end }) => set({ start, end })} />
      <Flex gap={2} ml="auto" pb="1px">
        <Button onClick={exportCsv}>Export data</Button>
        <Schedule />
        <CopyLink />
      </Flex>
    </Flex>
  );
}
