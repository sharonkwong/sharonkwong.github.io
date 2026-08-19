export type ChannelKey = "display" | "video" | "email";
export type AttrModel = "last" | "incr";

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
  incrementalityRate: number;
  cpaLast: number;
  cpic: number;
  marginalCpic: number;
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

export interface MarginalPoint {
  spendK: number;
  multiple: number;
  marginalCpic: number;
  isCurrent: boolean;
}

export interface ReallocRow {
  channel: string;
  key: ChannelKey;
  now: number;
  proposed: number;
  rationale: string;
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

export interface CampaignData {
  meta: {
    advertiser: string; descriptor: string; flightStart: string; flightEnd: string;
    generatedAt: string; owner: string; goal: string; synthetic: boolean; sources: string[];
  };
  constants: {
    valuePerConversion: number; ceiling: number;
    subscriberValue: number; dedupedHouseholds: number;
  };
  channels: Channel[];
  daily: DailyRow[];
  marginal: Record<ChannelKey, MarginalPoint[]>;
  reallocation: ReallocRow[];
  video: { quartiles: QuartileRow[]; types: VideoType[]; dropoff: { stage: string; nonskip: number; skip: number }[] };
  email: { funnel: FunnelRow[]; listHealth: ListHealthRow[]; frequency: FreqRow[] };
  display: { viewability: ViewabilityRow[]; metrics: DisplayMetric[] };
  creatives: Creative[];
}
