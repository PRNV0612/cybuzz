export type ItemType = "cve" | "attack" | "breach" | "ransomware" | "news" | "discussion";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type SourceKind = "rss" | "nvd" | "kev" | "ransomware" | "reddit" | "hn";

/** What every adapter must produce before the pipeline takes over. */
export interface RawItem {
  title: string;
  url: string;
  summary?: string;
  source: string; // display name, e.g. "The Hacker News"
  sourceKind: SourceKind;
  type: ItemType;
  severity?: Severity;
  cveId?: string;
  publishedAt: number; // epoch ms
  engagement?: number; // upvotes / points, where the source has them
  entityNames?: string[]; // known-affected orgs (e.g. ransomware victim)
  meta?: Record<string, unknown>;
}

/** Row shape as stored in SQLite. */
export interface ItemRow {
  id: string;
  title: string;
  url: string;
  url_hash: string;
  summary: string | null;
  source: string;
  source_kind: SourceKind;
  type: ItemType;
  severity: Severity | null;
  cve_id: string | null;
  published_at: number;
  engagement: number;
  mentions: number;
  cluster_id: string | null;
  score: number;
  meta: string | null;
}

export interface EntityRow {
  id: number;
  slug: string;
  name: string;
  kind: "company" | "product";
}

/**
 * What an adapter returns: the items it managed to collect, plus the
 * individual feeds inside it that failed. Both matter — a source like Reddit
 * rate-limits per subreddit, so "the adapter succeeded" is not the same claim
 * as "the source worked". `failures` are degraded slices; a run where every
 * adapter returned but half the feeds 429'd should be visible, not fatal.
 */
export interface AdapterResult {
  items: RawItem[];
  failures: { feed: string; error: string }[];
}

export interface IngestReport {
  fetched: number;
  inserted: number;
  updated: number;
  linked: number;
  clustered: number;
  /** Whole-adapter failures: the cycle could not use this source at all. */
  errors: { source: string; error: string }[];
  /** Per-feed failures inside an adapter that otherwise succeeded. */
  degraded: { source: string; error: string }[];
  finishedAt: number;
}
