export type MediaKey = "display" | "email" | "video";

export interface MediaType { key: MediaKey; label: string; color: string }
export interface Campaign { id: string; name: string; mediaType: MediaKey }

export interface DailyRow {
  date: string;
  campaign: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
}

/** A breakdown is a share of its campaign, never a standalone count. */
export interface ShareRow {
  impressionShare: number;
  clickShare: number;
  conversionShare: number;
}

export interface DeviceRow extends ShareRow { campaign: string; device: string }

export interface DemoBar { label: string; share: number }
export type Demographics = Record<MediaKey, Record<"income" | "age" | "education" | "device", DemoBar[]>>;

export interface GeoZip {
  zip: string;
  name: string;
  col: number;
  row: number;
  shares: Record<string, ShareRow>;
  medianIncome: number;
  medianAge: number;
  degreeShare: number;
}

export interface Placement extends ShareRow { site: string }

/** A clickable band of an email creative, as a fraction of the creative. */
export interface CreativeSection {
  key: string; label: string;
  x: number; y: number; w: number; h: number;
  clickShare: number;
}

export interface Creative extends ShareRow {
  id: string;
  campaign: string;
  name: string;
  format: string;
  dimensions: string;
  seconds: number | null;
  assetKind: "image" | "video";
  asset: string;
  poster: string | null;
  quartiles: number[] | null;
  sections: CreativeSection[] | null;
  placements: Placement[];
}

export interface Data {
  meta: {
    advertiser: string;
    firstDate: string; lastDate: string;
    defaultStart: string; defaultEnd: string;
    generatedAt: string; synthetic: boolean;
  };
  mediaTypes: MediaType[];
  campaigns: Campaign[];
  daily: DailyRow[];
  devices: DeviceRow[];
  demographics: Demographics;
  geo: GeoZip[];
  creatives: Creative[];
}

export type Metric = "impressions" | "clicks" | "conversions" | "spend";
export type ShareMetric = "impressions" | "clicks" | "conversions";
