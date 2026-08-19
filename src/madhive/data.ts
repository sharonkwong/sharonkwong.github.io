import { useEffect, useState } from "react";
import type { CampaignData, ChannelKey } from "./types";

/* ------------------------------------------------------------------ fetch */

// `base: "./"` in vite.config means the built page lives at /madhive/, so the
// data file resolves one level up. In dev the page is served from /madhive/ too,
// so the same relative path works in both.
const DATA_URL = "../data/madhive-campaign.json";

export function useCampaignData() {
  const [data, setData] = useState<CampaignData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((d: CampaignData) => live && setData(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  return { data, error };
}

/* ------------------------------------------------- URL-synced view state */

export interface ViewState {
  channel: ChannelKey | null;
}

function readUrl(): ViewState {
  const p = new URLSearchParams(window.location.search);
  const c = p.get("channel");
  return { channel: c === "display" || c === "video" || c === "email" ? c : null };
}

/** View state that lives in the query string, so any drill-down is a shareable link. */
export function useViewState() {
  const [state, setState] = useState<ViewState>(readUrl);

  useEffect(() => {
    const onPop = () => setState(readUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const update = (patch: Partial<ViewState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      const p = new URLSearchParams();
      if (next.channel) p.set("channel", next.channel);
      const qs = p.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}`
      );
      return next;
    });
  };

  return [state, update] as const;
}

/* ---------------------------------------------------------------- format */

export const nf = (n: number) => Math.round(n).toLocaleString("en-US");
export const money = (n: number, dp = 0) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
export const compact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
    : `${Math.round(n)}`;
export const pct = (n: number, dp = 1) => `${(n * 100).toFixed(dp)}%`;
export const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
