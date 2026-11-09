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

export interface IngestReport {
  fetched: number;
  inserted: number;
  updated: number;
  clustered: number;
  errors: { source: string; error: string }[];
  finishedAt: number;
}
