export type ChannelKey = "display" | "video" | "email";

export interface LiftTest {
  method: string;
  design: string;
  units: string;
  exposedRate: number;
  controlRate: number;
  ciLow: number;
  ciHigh: number;
  why: string;
  /** Share of credited conversions the advertising actually caused. */
  incrementality: number;
  incremental: number;
  /** Conversions that would have happened without the ads. */
  baseline: number;
}

export interface Channel {
  key: ChannelKey;
  label: string;
  color: string;
  spend: number;
  impressions: number;
  clicks: number;
  onlineConversions: number;
  offlineConversions: number;
  /** Online + offline. The single definition every cost figure and the model use. */
  conversions: number;
  halfSaturationSpend: number;
  maxConversions: number;
  marginalCpa: number;
  floorCpa: number;
  cpa: number;
  onlineCpa: number;
  offlineShare: number;
  cpm: number;
  cpc: number;
  ctr: number;
  reach: number;
  reachUnit: string;
  lift: LiftTest;
  frequency: number;
}

export interface DailyMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  onlineConversions: number;
  offlineConversions: number;
  conversions: number;
}
export interface DailyRow {
  date: string;
  display: DailyMetrics;
  video: DailyMetrics;
  email: DailyMetrics;
}

export interface Assumption {
  key: string;
  label: string;
  value: number;
  unit: string;
  adjustable: boolean;
  /** Why this number is what it is. Every non-metric number must carry one. */
  basis: string;
}

export interface QuartileRow { stage: string; nonskip: number; skip: number }
export interface VideoType {
  type: string; spend: number; impressions: number; cpm: number;
  vcr: number; cpcv: number; viewability: number; cpa: number;
}

export interface FunnelRow { stage: string; value: number; note: string | null; suspect: boolean }
export interface ListHealthRow { metric: string; value: number; benchmark: string | null }
export interface FreqRow { sends: number; conversions: number; unsubRate: number; netList: number }

export interface ViewabilityRow {
  marketplace: string; rate: number; spend: number | null;
  isBenchmark: boolean; wasted: number | null;
}
export interface DisplayMetric { metric: string; value: string; reads: string }

export type Verdict = "scale" | "hold" | "fix" | "pause" | "cut";
export interface Placement {
  name: string; spend: number; units: number; conversions: number; cpa: number;
}
export interface Creative {
  id: string; channel: ChannelKey; name: string; spend: number; units: number;
  completion: number | null; conversions: number; cpa: number;
  verdict: Verdict; placements: Placement[];
  /** Metrics this format can actually emit — differs by channel. */
  metrics: Record<string, number>;
  assetKind: "image" | "video";
  asset: string;
  poster: string | null;
  format: string;
}

export interface CampaignData {
  meta: {
    advertiser: string; descriptor: string; flightStart: string; flightEnd: string;
    generatedAt: string; window: number; synthetic: boolean; sources: string[];
  };
  assumptions: Assumption[];
  constants: { emailSpendCap: number };
  totals: Record<
    "spend" | "impressions" | "clicks" | "onlineConversions" | "offlineConversions" | "conversions",
    { current: number; prior: number }
  >;
  channels: Channel[];
  daily: DailyRow[];
  video: { quartiles: QuartileRow[]; types: VideoType[]; dropoff: { stage: string; nonskip: number; skip: number }[] };
  email: { funnel: FunnelRow[]; listHealth: ListHealthRow[]; frequency: FreqRow[] };
  display: { viewability: ViewabilityRow[]; metrics: DisplayMetric[] };
  creatives: Creative[];
  offline: OfflineBlock;
}

/** How an in-store visit gets tied back to an impression, and where it is weak. */
export interface OfflineBlock {
  method: string;
  windowDays: number;
  radiusM: number;
  matchRate: number;
  lagDays: number;
  chain: { step: string; what: string; holds: string }[];
  caveat: string;
}
