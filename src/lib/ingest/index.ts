import { randomUUID } from "node:crypto";
import { getDb, getMeta, setMeta } from "../db";
import type { IngestReport, ItemRow, RawItem } from "../types";
import { matchEntities, slugify } from "../entities";
import { jaccard, normalizeUrl, titleTokens, truncate, urlHash } from "./normalize";
import { ingestRss } from "./rss";
import { ingestNvd } from "./nvd";
import { ingestKev } from "./kev";
import { ingestRansomware } from "./ransomware";
import { ingestReddit } from "./reddit";
import { ingestHackerNews } from "./hackernews";

const BASE_WEIGHT: Record<string, number> = {
  kev: 5,
  ransomware: 4,
  nvd: 3,
  rss: 2,
  reddit: 1,
  hn: 1,
};

const CLUSTER_WINDOW_MS = 14 * 24 * 3600 * 1000;
const CLUSTER_THRESHOLD = 0.55;

interface Task {
  label: string;
  run: () => Promise<RawItem[]>;
}

/**
 * One ingest cycle: fetch everything → upsert (dedupe by normalized URL,
 * KEV upgrades plain NVD rows) → tag entities → re-cluster the recent window
 * → recompute buzz scores. Every adapter is isolated: a dead source can only
 * ever cost you its own slice of the cycle.
 */
export async function runIngest(): Promise<IngestReport> {
  const db = getDb();
  const lastRun = Number(getMeta("lastIngestAt") ?? 0);
  // First run pulls a 10-day NVD window so the DB starts with real depth.
  const nvdSince = lastRun > 0 ? lastRun - 3600_000 /* 1 h overlap */ : Date.now() - 10 * 24 * 3600_000;

  const tasks: Task[] = [
    { label: "rss", run: ingestRss },
    { label: "nvd", run: () => ingestNvd(nvdSince) },
    { label: "kev", run: ingestKev },
    { label: "ransomware.live", run: ingestRansomware },
    { label: "reddit", run: ingestReddit },
    { label: "hackernews", run: ingestHackerNews },
  ];

  const settled = await Promise.allSettled(tasks.map((t) => t.run()));
  const errors: IngestReport["errors"] = [];
  const raw: RawItem[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") raw.push(...r.value);
    else errors.push({ source: tasks[i].label, error: String(r.reason).slice(0, 300) });
  });

  let fetched = 0;
  let inserted = 0;
  let updated = 0;

  const upsert = db.prepare(`
    INSERT INTO items (id, title, url, url_hash, summary, source, source_kind, type,
                       severity, cve_id, published_at, engagement, mentions, score, meta)
    VALUES (@id, @title, @url, @urlHash, @summary, @source, @sourceKind, @type,
            @severity, @cveId, @publishedAt, @engagement, 1, 0, @meta)
  `);
  const findByUrl = db.prepare("SELECT id, source_kind, severity FROM items WHERE url = ?");
  const upgrade = db.prepare(`
    UPDATE items SET severity = COALESCE(@severity, severity), type = @type,
      source = @source, source_kind = @sourceKind, summary = COALESCE(summary, @summary),
      cve_id = COALESCE(cve_id, @cveId), meta = @meta
    WHERE id = @id
  `);

  const now = Date.now();
  const tx = db.transaction(() => {
    for (const it of raw) {
      const url = normalizeUrl(it.url);
      if (!url || !it.title) continue;
      fetched++;
      const row = {
        id: randomUUID(),
        title: truncate(it.title.trim(), 300),
        url,
        urlHash: urlHash(url),
        summary: it.summary ? truncate(it.summary, 900) : null,
        source: it.source,
        sourceKind: it.sourceKind,
        type: it.type,
        severity: it.severity ?? null,
        cveId: it.cveId ?? null,
        publishedAt: it.publishedAt || now,
        engagement: it.engagement ?? 0,
        meta: it.meta ? JSON.stringify(it.meta) : null,
      };
      const existing = findByUrl.get(row.url) as
        | { id: string; source_kind: string; severity: string | null }
        | undefined;
      if (existing) {
        // KEV rows re-upsert every cycle (deadline/action text moves).
        // Non-KEV rows upgrade a plain NVD row but never downgrade a KEV row.
        if (row.sourceKind === "kev" || existing.source_kind !== "kev") {
          upgrade.run({ ...row, id: existing.id });
          linkEntities(existing.id, it);
          updated++;
        }
        continue;
      }
      upsert.run(row);
      inserted++;
      linkEntities(row.id, it);
    }
  });
  tx();

  const clustered = clusterAndScore();
  setMeta("lastIngestAt", String(now));

  return { fetched, inserted, updated, clustered, errors, finishedAt: now };
}

/** Dictionary hits + source-provided names (ransomware victims, KEV vendors). */
function linkEntities(itemId: string, it: RawItem): void {
  const db = getDb();
  const found = new Map<string, "company" | "product">();
  for (const e of matchEntities(`${it.title} ${it.summary ?? ""}`)) found.set(e.name, e.kind);
  for (const name of it.entityNames ?? []) {
    const n = name.trim();
    if (n.length >= 3 && !found.has(n)) found.set(n, "company");
  }
  const insEntity = db.prepare(
    "INSERT INTO entities (slug, name, kind) VALUES (?, ?, ?) ON CONFLICT(slug) DO UPDATE SET name = excluded.name"
  );
  const getEntity = db.prepare("SELECT id FROM entities WHERE slug = ?");
  const link = db.prepare("INSERT OR IGNORE INTO item_entities (item_id, entity_id) VALUES (?, ?)");
  for (const [name, kind] of found) {
    const slug = slugify(name);
    if (!slug) continue;
    insEntity.run(slug, name, kind);
    const { id } = getEntity.get(slug) as { id: number };
    link.run(itemId, id);
  }
}

/**
 * Group same-story items across sources (the "trending" signal), then
 * buzz = base weight + cluster size + engagement, with recency applied at
 * query time so stored scores don't rot.
 * NVD/KEV rows skip clustering: one CVE = one URL, already merged at upsert.
 */
function clusterAndScore(): number {
  const db = getDb();
  const since = Date.now() - CLUSTER_WINDOW_MS;
  const rows = db
    .prepare(
      "SELECT id, title, published_at, engagement, source, source_kind, meta FROM items WHERE published_at >= ? AND source_kind NOT IN ('nvd','kev')"
    )
    .all(since) as Pick<ItemRow, "id" | "title" | "published_at" | "engagement" | "source" | "source_kind" | "meta">[];

  const tokens = new Map(rows.map((r) => [r.id, titleTokens(r.title)]));
  const parent = new Map(rows.map((r) => [r.id, r.id]));
  const find = (x: string): string => {
    while (parent.get(x) !== x) x = parent.get(x)!;
    return x;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (Math.abs(rows[i].published_at - rows[j].published_at) > CLUSTER_WINDOW_MS) continue;
      if (jaccard(tokens.get(rows[i].id)!, tokens.get(rows[j].id)!) >= CLUSTER_THRESHOLD) {
        union(rows[i].id, rows[j].id);
      }
    }
  }

  const size = new Map<string, number>();
  const rep = new Map<string, string>(); // oldest item wins as representative
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const r of rows) {
    const root = find(r.id);
    size.set(root, (size.get(root) ?? 0) + 1);
    const cur = rep.get(root);
    if (!cur || r.published_at < byId.get(cur)!.published_at) rep.set(root, r.id);
  }

  const upd = db.prepare("UPDATE items SET cluster_id = ?, mentions = ?, score = ? WHERE id = ?");
  const tx = db.transaction(() => {
    for (const r of rows) {
      const root = find(r.id);
      const mentions = size.get(root) ?? 1;
      let weight = BASE_WEIGHT[r.source_kind] ?? 1;
      if (r.source_kind === "rss" && r.meta) {
        try {
          weight = (JSON.parse(r.meta).weight as number) ?? weight;
        } catch {}
      }
      const score = weight + 2 * (Math.min(mentions, 6) - 1) + Math.log10(r.engagement + 1) * 1.5;
      upd.run(rep.get(root)!, mentions, score, r.id);
    }
  });
  tx();
  return size.size;
}
