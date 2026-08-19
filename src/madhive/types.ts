export type ChannelKey = "display" | "video" | "email";
export type AttrModel = "last" | "incr";

export interface LiftTest {
  method: string;
  design: string;
  window: string;
  controlShare: number;
  units: string;
  point: number;
  ciLow: number;
  ciHigh: number;
  pValue: string;
}

export interface Channel {
  key: ChannelKey;
  label: string;
  color: string;
  spend: number;
  impressions: number;
  cpm: number;
  clicks: number;
  ctr: number;
  conversionsLast: number;
  conversionsIncr: number;
  conversionsIncrLow: number;
  conversionsIncrHigh: number;
  lift: LiftTest;
  incrementalityRate: number;
  cpaLast: number;
  cpic: number;
  /** Fitted half-saturation spend for the Hill response curve. */
  halfSaturationSpend: number;
  /** Ceiling of the response curve — most incremental conversions achievable. */
  maxConversions: number;
  /** Marginal cost of the next conversion at CURRENT spend. Derived. */
  marginalCpic: number;
  /** Cheapest the next conversion can ever be on this channel. Derived. */
  floorCpic: number;
  reach: number;
  frequency: number;
  note: string;
}

export interface DailyMetrics {
  spend: number;
  impressions: number;
  conversionsLast: number;
  conversionsIncr: number;
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
  vcr: number; cpcv: number; viewability: number; cpic: number;
}

export interface FunnelRow { stage: string; value: number; note: string | null; suspect: boolean }
export interface ListHealthRow { metric: string; value: number; benchmark: string | null }
export interface FreqRow { sends: number; incremental: number; unsubRate: number; netList: number }

export interface ViewabilityRow {
  marketplace: string; rate: number; spend: number | null;
  isBenchmark: boolean; wasted: number | null;
}
export interface DisplayMetric { metric: string; value: string; reads: string }

export type Verdict = "scale" | "hold" | "fix" | "pause" | "cut";
export interface Placement {
  name: string; spend: number; units: number; conversions: number; cpic: number;
}
export interface Creative {
  id: string; channel: ChannelKey; name: string; spend: number; units: number;
  completion: number | null; conversions: number; cpic: number;
  verdict: Verdict; placements: Placement[];
}

export interface ReachBlock {
  channels: { key: string; label: string; value: number; unit: string; note: string }[];
  dedupedLow: number;
  dedupedHigh: number;
  method: string;
  caveat: string;
  source: string;
}

export interface CampaignData {
  meta: {
    advertiser: string; descriptor: string; flightStart: string; flightEnd: string;
    generatedAt: string; owner: string; goal: string; synthetic: boolean; sources: string[];
  };
  assumptions: Assumption[];
  constants: {
    valuePerConversion: number;
    subscriberValue: number;
    emailSpendCap: number;
    targetReturn: number;
  };
  channels: Channel[];
  daily: DailyRow[];
  reach: ReachBlock;
  video: { quartiles: QuartileRow[]; types: VideoType[]; dropoff: { stage: string; nonskip: number; skip: number }[] };
  email: { funnel: FunnelRow[]; listHealth: ListHealthRow[]; frequency: FreqRow[] };
  display: { viewability: ViewabilityRow[]; metrics: DisplayMetric[] };
  creatives: Creative[];
}
