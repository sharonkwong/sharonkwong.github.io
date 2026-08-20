import { Box, Flex, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { ReactNode } from "react";

/* Dark surface set. Every colour on the page comes from here. */
export const T = {
  bg: "#0d1117",
  surface: "#161b22",
  raised: "#1c2430",
  line: "#262d38",
  lineSoft: "#1e242e",
  ink: "#e6edf3",
  muted: "#8b949e",
  dim: "#6e7681",
  up: "#3fb950",
  down: "#f85149",
  focus: "#58a6ff",
  /* Sequential ramp for the geo tiles: one hue, monotonic lightness. */
  ramp: ["#141b26", "#173355", "#1f4d7a", "#2b6cb0", "#4a91d8", "#79c0ff"],
};

export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

export function Panel({ title, right, children, ...rest }: {
  title?: ReactNode; right?: ReactNode; children: ReactNode; [k: string]: unknown;
}) {
  return (
    <Box bg={T.surface} border="1px solid" borderColor={T.line} borderRadius="8px"
      p={{ base: 3.5, md: 4 }} minW={0} {...rest}>
      {(title || right) && (
        <Flex justify="space-between" align="center" gap={3} wrap="wrap" mb={3.5}>
          {typeof title === "string"
            ? <Text fontSize="13px" fontWeight={600} color={T.ink}>{title}</Text>
            : title ?? <Box />}
          {right}
        </Flex>
      )}
      {children}
    </Box>
  );
}

export function Label({ children, ...rest }: { children: ReactNode; [k: string]: unknown }) {
  return (
    <Text fontFamily={MONO} fontSize="10px" letterSpacing="0.09em" textTransform="uppercase"
      color={T.dim} fontWeight={500} {...rest}>{children}</Text>
  );
}

export function Delta({ value, lowerIsBetter }: { value: number; lowerIsBetter?: boolean }) {
  if (!Number.isFinite(value)) return null;
  const good = lowerIsBetter ? value < 0 : value > 0;
  return (
    <Text as="span" fontFamily={MONO} fontSize="11px" fontWeight={600}
      color={good ? T.up : T.down}>
      {value >= 0 ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
      <Text as="span" color={T.dim} fontWeight={400}> vs prior</Text>
    </Text>
  );
}

/** Segmented control. Used wherever a chart can show more than one measure. */
export function Toggle<V extends string>({ options, value, onChange, ariaLabel }: {
  options: { value: V; label: string }[];
  value: V; onChange: (v: V) => void; ariaLabel: string;
}) {
  return (
    <Flex gap="2px" bg={T.bg} border="1px solid" borderColor={T.line} borderRadius="6px"
      p="2px" role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Box key={o.value} as="button" type="button" aria-pressed={on}
            onClick={() => onChange(o.value)} px={2.5} py="4px" borderRadius="4px"
            fontSize="11.5px" fontWeight={on ? 600 : 500} whiteSpace="nowrap"
            bg={on ? T.raised : "transparent"} color={on ? T.ink : T.muted}
            _hover={{ color: T.ink }}
            _focusVisible={{ outline: "2px solid", outlineColor: T.focus, outlineOffset: "1px" }}
            transition="all .12s">
            {o.label}
          </Box>
        );
      })}
    </Flex>
  );
}

export function Button({ children, onClick, ...rest }: {
  children: ReactNode; onClick?: () => void; [k: string]: unknown;
}) {
  return (
    <Box as="button" type="button" onClick={onClick} px={3} py="6px" borderRadius="6px"
      fontSize="12px" fontWeight={500} color={T.muted} bg={T.surface}
      border="1px solid" borderColor={T.line} whiteSpace="nowrap"
      _hover={{ color: T.ink, borderColor: T.dim }}
      _focusVisible={{ outline: "2px solid", outlineColor: T.focus, outlineOffset: "1px" }}
      transition="all .12s" {...rest}>
      {children}
    </Box>
  );
}

export function Tip({ rows, title }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <Box bg={T.raised} border="1px solid" borderColor={T.line} borderRadius="6px"
      px={2.5} py={2} boxShadow="0 8px 24px -8px rgba(0,0,0,.7)" fontSize="11.5px">
      <Text fontFamily={MONO} fontSize="10px" color={T.dim} mb={1}>{title}</Text>
      {rows.map((r) => (
        <Flex key={r.label} align="center" gap={2} fontFamily={MONO}>
          {r.color && <Box w="7px" h="7px" borderRadius="1px" bg={r.color} flex="0 0 auto" />}
          <Text color={T.muted}>{r.label}</Text>
          <Text ml="auto" fontWeight={600} color={T.ink}>{r.value}</Text>
        </Flex>
      ))}
    </Box>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text fontSize="15px" fontWeight={600} color={T.ink} mb={3} mt={2}>{children}</Text>
  );
}

export function Question({ children }: { children: ReactNode }) {
  return (
    <Text fontSize="12.5px" color={T.muted} mb={2}>{children}</Text>
  );
}

export function Legend({ items }: { items: { label: string; color: string; onClick?: () => void; dim?: boolean }[] }) {
  return (
    <Flex gap={3.5} wrap="wrap">
      {items.map((i) => (
        <Flex key={i.label} align="center" gap={1.5} opacity={i.dim ? 0.4 : 1}
          cursor={i.onClick ? "pointer" : "default"} onClick={i.onClick} transition="opacity .15s">
          <Box w="9px" h="9px" borderRadius="2px" bg={i.color} />
          <Text fontSize="11.5px" color={T.muted}>{i.label}</Text>
        </Flex>
      ))}
    </Flex>
  );
}

/* ------------------------------------------------------------------ table */

export interface Column<R> {
  key: string;
  label: string;
  align?: "right";
  width?: string;
  /** What the cell shows. Defaults to the sort value. */
  render?: (row: R) => ReactNode;
  /** What the column sorts on. Omit to make the column unsortable. */
  sort?: (row: R) => number | string;
  /** Numbers read better descending first; text ascending. */
  numeric?: boolean;
}

/**
 * Sortable table. Every column that declares `sort` is clickable, shows its
 * direction when active, and hints on hover when not.
 */
export function DataTable<R>({
  columns, rows, rowKey, initialSort, minW, onRowClick, isOpen, expanded,
}: {
  columns: Column<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  minW?: string;
  onRowClick?: (row: R) => void;
  isOpen?: (row: R) => boolean;
  expanded?: (row: R) => ReactNode;
}) {
  const [sort, setSort] = useState(initialSort ?? { key: columns[0].key, dir: "asc" as const });
  const col = columns.find((c) => c.key === sort.key);

  const sorted = col?.sort
    ? [...rows].sort((a, b) => {
        const x = col.sort!(a), y = col.sort!(b);
        const c = typeof x === "number" && typeof y === "number"
          ? x - y : String(x).localeCompare(String(y));
        return sort.dir === "asc" ? c : -c;
      })
    : rows;

  const click = (c: Column<R>) => {
    if (!c.sort) return;
    setSort((s) => s.key === c.key
      ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" }
      : { key: c.key, dir: c.numeric ? "desc" : "asc" });
  };

  return (
    <Box overflowX="auto">
      <Box as="table" w="100%" minW={minW} style={{ borderCollapse: "collapse" }}>
        <Box as="thead">
          <Box as="tr">
            {columns.map((c) => {
              const on = sort.key === c.key && !!c.sort;
              return (
                <Box as="th" key={c.key} textAlign={c.align ?? "left"} w={c.width}
                  py={2} px={2.5} borderBottom="1px solid" borderColor={T.line}
                  whiteSpace="nowrap" role={c.sort ? "columnheader" : undefined}
                  aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                  <Box as={c.sort ? "button" : "span"}
                    onClick={() => click(c)} display="inline-flex" alignItems="center" gap="4px"
                    fontFamily={MONO} fontSize="10px" letterSpacing="0.08em"
                    textTransform="uppercase" fontWeight={on ? 600 : 500}
                    color={on ? T.ink : T.dim} cursor={c.sort ? "pointer" : "default"}
                    flexDirection={c.align === "right" ? "row-reverse" : "row"}
                    _hover={c.sort ? { color: T.ink, "& .arw": { opacity: 1 } } : undefined}
                    _focusVisible={{ outline: "2px solid", outlineColor: T.focus, outlineOffset: "2px" }}
                    transition="color .12s">
                    {c.label}
                    {c.sort && (
                      <Box as="span" className="arw" fontSize="8px" lineHeight={1}
                        opacity={on ? 1 : 0.32} transition="opacity .12s">
                        {on ? (sort.dir === "asc" ? "▲" : "▼") : "▲▼"}
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
        <Box as="tbody">
          {sorted.map((r) => {
            const open = isOpen?.(r) ?? false;
            return (
              <Box as="tr" key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                cursor={onRowClick ? "pointer" : "default"}
                bg={open ? T.raised : "transparent"}
                _hover={onRowClick ? { bg: open ? T.raised : T.lineSoft } : undefined}
                transition="background .12s">
                {columns.map((c) => (
                  <Box as="td" key={c.key} py={2.5} px={2.5} borderBottom="1px solid"
                    borderColor={T.lineSoft} textAlign={c.align ?? "left"}
                    fontSize={c.align === "right" ? "12px" : "12.5px"}
                    fontFamily={c.align === "right" ? MONO : undefined}
                    sx={c.align === "right" ? { fontVariantNumeric: "tabular-nums" } : undefined}
                    color={sort.key === c.key ? T.ink : T.muted}
                    fontWeight={sort.key === c.key ? 600 : 400}
                    whiteSpace="nowrap">
                    {c.render ? c.render(r) : String(c.sort?.(r) ?? "")}
                  </Box>
                ))}
              </Box>
            );
          })}
        </Box>
      </Box>
      {expanded && sorted.filter((r) => isOpen?.(r)).map((r) => (
        <Box key={`x-${rowKey(r)}`}>{expanded(r)}</Box>
      ))}
    </Box>
  );
}
