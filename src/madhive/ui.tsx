import { Box, Flex, HStack, Text, Tooltip } from "@chakra-ui/react";
import type { ReactNode } from "react";

export const INK = "gray.800";
export const MUTED = "gray.500";
export const RULE = "gray.200";

/* --------------------------------------------------------------- panel */
export function Panel({
  title,
  sub,
  right,
  children,
  ...rest
}: {
  title?: string;
  sub?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  [k: string]: unknown;
}) {
  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor={RULE}
      borderRadius="10px"
      p={{ base: 4, md: 5 }}
      boxShadow="0 1px 2px rgba(16,24,40,.04), 0 8px 24px -18px rgba(16,24,40,.25)"
      minW={0}
      {...rest}
    >
      {(title || right) && (
        <Flex justify="space-between" align="baseline" gap={3} wrap="wrap" mb={sub ? 1 : 3}>
          {title && (
            <Text fontSize="15px" fontWeight={700} letterSpacing="-0.01em" color={INK}>
              {title}
            </Text>
          )}
          {right}
        </Flex>
      )}
      {sub && (
        <Text fontSize="12px" color={MUTED} mb={4} lineHeight={1.5}>
          {sub}
        </Text>
      )}
      {children}
    </Box>
  );
}

/* ------------------------------------------------------------ info tip */
/**
 * Hover/focus explainer. It is a real <button> so it also opens on keyboard
 * focus and on tap — a hover-only tooltip is invisible on a phone.
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip
      label={children}
      hasArrow
      placement="top"
      openDelay={120}
      closeOnClick={false}
      bg="gray.800"
      color="white"
      fontSize="12px"
      fontWeight={400}
      lineHeight={1.55}
      letterSpacing="0"
      textTransform="none"
      px={3}
      py={2}
      borderRadius="7px"
      maxW="290px"
    >
      <Box
        as="button"
        type="button"
        aria-label={`What is ${label}?`}
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        w="13px"
        h="13px"
        flex="0 0 auto"
        borderRadius="full"
        border="1px solid"
        borderColor="gray.300"
        color="gray.400"
        fontSize="9px"
        fontWeight={700}
        fontFamily="serif"
        lineHeight={1}
        transition="all .15s"
        _hover={{ color: "gray.600", borderColor: "gray.400" }}
        _focusVisible={{ outline: "2px solid", outlineColor: "blue.400", outlineOffset: "1px" }}
      >
        i
      </Box>
    </Tooltip>
  );
}

/* ----------------------------------------------------------------- kpi */
export function Kpi({
  label,
  value,
  sub,
  tone,
  delta,
  lowerIsBetter,
  tip,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
  /** Percentage change vs the comparison period. */
  delta?: number;
  /** For cost metrics, a fall is an improvement. */
  lowerIsBetter?: boolean;
  /** What the metric is, and how it is worked out when it is derived. */
  tip?: ReactNode;
}) {
  const good = delta === undefined ? null : lowerIsBetter ? delta < 0 : delta > 0;
  return (
    <Box bg="white" p={4}>
      <Flex align="center" gap="5px" mb={2} minH="14px">
        <Text
          fontSize="9.5px"
          letterSpacing="0.12em"
          textTransform="uppercase"
          color={MUTED}
          fontWeight={600}
          lineHeight={1.2}
        >
          {label}
        </Text>
        {tip && <InfoTip label={label}>{tip}</InfoTip>}
      </Flex>
      <Text
        fontSize={{ base: "19px", md: "22px" }}
        fontWeight={700}
        letterSpacing="-0.025em"
        whiteSpace="nowrap"
        lineHeight={1.08}
        color={tone === "good" ? "green.600" : tone === "bad" ? "red.500" : INK}
      >
        {value}
      </Text>
      {delta !== undefined && (
        <Text fontSize="11px" mt={1.5} fontFamily="mono"
          color={good ? "green.600" : "red.500"} fontWeight={600}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
          <Text as="span" color={MUTED} fontWeight={400}> vs prior</Text>
        </Text>
      )}
      {sub && (
        <Text fontSize="11px" color={MUTED} mt={1} fontFamily="mono">
          {sub}
        </Text>
      )}
    </Box>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: "repeat(5, 1fr)" }}
      gap="1px"
      bg={RULE}
      border="1px solid"
      borderColor={RULE}
      borderRadius="10px"
      overflow="hidden"
    >
      {children}
    </Box>
  );
}

/* ----------------------------------------------------------- bar row */
export function BarRow({
  label,
  value,
  max,
  color,
  display,
  sub,
  dim,
  onClick,
  labelWidth = "132px",
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  display: string;
  sub?: string;
  dim?: boolean;
  onClick?: () => void;
  labelWidth?: string;
}) {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: "1fr", sm: `minmax(88px, ${labelWidth}) 1fr minmax(70px, auto)` }}
      gap={{ base: 1, sm: 3 }}
      alignItems="center"
      opacity={dim ? 0.35 : 1}
      cursor={onClick ? "pointer" : "default"}
      onClick={onClick}
      transition="opacity .2s"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      _hover={onClick ? { "& .bl": { color: INK } } : undefined}
    >
      <Text
        className="bl"
        fontSize="13px"
        color="gray.600"
        textAlign={{ base: "left", sm: "right" }}
        transition="color .15s"
      >
        {label}
      </Text>
      <Box bg="gray.100" borderRadius="4px" h="19px" position="relative" overflow="hidden">
        <Box
          position="absolute"
          left={0}
          top={0}
          bottom={0}
          bg={color}
          borderRadius="0 4px 4px 0"
          minW="2px"
          w={`${Math.max(0, Math.min(100, (value / max) * 100)).toFixed(2)}%`}
          transition="width .35s ease"
        />
      </Box>
      <Box>
        <Text fontSize="12.5px" fontWeight={700} fontFamily="mono" color={INK} whiteSpace="nowrap">
          {display}
        </Text>
        {sub && (
          <Text fontSize="10px" fontFamily="mono" color={MUTED} whiteSpace="nowrap">
            {sub}
          </Text>
        )}
      </Box>
    </Box>
  );
}

/* ---------------------------------------------------------------- tag */
const TAG_STYLES: Record<string, { bg: string; color: string; border?: string }> = {
  scale: { bg: "transparent", color: "green.600", border: "green.400" },
  hold: { bg: "transparent", color: "gray.500", border: "gray.300" },
  fix: { bg: "orange.100", color: "orange.800" },
  pause: { bg: "red.100", color: "red.700" },
  cut: { bg: "red.500", color: "white" },
};
const TAG_LABEL: Record<string, string> = {
  scale: "Scale",
  hold: "Hold",
  fix: "Fix creative",
  pause: "Pause",
  cut: "Cut",
};

export function Tag({ kind }: { kind: string }) {
  const s = TAG_STYLES[kind] ?? TAG_STYLES.hold;
  return (
    <Box
      as="span"
      display="inline-block"
      fontFamily="mono"
      fontSize="10px"
      fontWeight={700}
      px={2}
      py="2px"
      borderRadius="full"
      whiteSpace="nowrap"
      bg={s.bg}
      color={s.color}
      border={s.border ? "1px solid" : undefined}
      borderColor={s.border}
    >
      {TAG_LABEL[kind] ?? kind}
    </Box>
  );
}

/* ------------------------------------------------------------ segmented */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <HStack
      spacing="2px"
      bg="gray.100"
      border="1px solid"
      borderColor={RULE}
      borderRadius="8px"
      p="2px"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Box
            key={o.value}
            as="button"
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            px={3}
            py="6px"
            borderRadius="6px"
            fontSize="13px"
            fontWeight={600}
            whiteSpace="nowrap"
            bg={on ? "white" : "transparent"}
            color={on ? INK : "gray.500"}
            boxShadow={on ? "0 1px 2px rgba(16,24,40,.08)" : undefined}
            _hover={{ color: INK }}
            transition="all .15s"
          >
            {o.label}
          </Box>
        );
      })}
    </HStack>
  );
}

/* ---------------------------------------------------------------- note */
export function Callout({
  tag,
  tone = "neutral",
  children,
}: {
  tag: string;
  tone?: "neutral" | "finding" | "warn" | "action";
  children: ReactNode;
}) {
  const border =
    tone === "warn" ? "red.400" : tone === "finding" ? "orange.400" : tone === "action" ? "green.400" : "gray.300";
  const tagColor =
    tone === "warn" ? "red.500" : tone === "finding" ? "orange.600" : tone === "action" ? "green.600" : MUTED;
  return (
    <Box
      border="1px solid"
      borderColor={RULE}
      borderLeft="3px solid"
      borderLeftColor={border}
      bg={tone === "neutral" ? "gray.50" : "white"}
      borderRadius="0 8px 8px 0"
      p={4}
    >
      <Text
        fontFamily="mono"
        fontSize="10px"
        letterSpacing="0.15em"
        textTransform="uppercase"
        fontWeight={700}
        color={tagColor}
        mb={2}
      >
        {tag}
      </Text>
      <Box fontSize="14px" color="gray.700" lineHeight={1.6} sx={{ "& p + p": { mt: 2 } }}>
        {children}
      </Box>
    </Box>
  );
}

/* -------------------------------------------------------- chart tooltip */
export function ChartTip({
  title,
  rows,
  footer,
}: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
  footer?: ReactNode;
}) {
  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.300"
      borderRadius="8px"
      px={3}
      py={2}
      boxShadow="0 4px 16px -6px rgba(16,24,40,.3)"
      fontSize="12px"
    >
      <Text
        fontFamily="mono"
        fontSize="10px"
        letterSpacing="0.08em"
        textTransform="uppercase"
        color={MUTED}
        mb={1}
      >
        {title}
      </Text>
      {rows.map((r) => (
        <Flex key={r.label} align="center" gap={2} fontFamily="mono">
          {r.color && <Box w="8px" h="8px" borderRadius="2px" bg={r.color} flex="0 0 auto" />}
          <Text color="gray.600">{r.label}</Text>
          <Text ml="auto" fontWeight={700} color={INK}>
            {r.value}
          </Text>
        </Flex>
      ))}
      {footer && (
        <Box mt={1.5} pt={1.5} borderTop="1px solid" borderColor="gray.100" color={MUTED} fontSize="11px">
          {footer}
        </Box>
      )}
    </Box>
  );
}

/* ---------------------------------------------------------- section head */
export function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <Box borderTop="1px solid" borderColor="gray.300" pt={4} mb={4}>
      <Text
        fontSize={{ base: "20px", md: "25px" }}
        fontWeight={700}
        letterSpacing="-0.022em"
        lineHeight={1.15}
        color={INK}
      >
        {title}
      </Text>
      {sub && (
        <Text fontSize="13.5px" color={MUTED} mt={1.5} maxW="74ch">
          {sub}
        </Text>
      )}
    </Box>
  );
}
