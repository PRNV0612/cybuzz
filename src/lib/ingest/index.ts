import { randomUUID } from "node:crypto";
import { getMeta, setMeta, query, exec } from "../db";
import type { AdapterResult, IngestReport, ItemRow, RawItem } from "../types";
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

const CLUSTER_WINDOW_MS = 14 * 24 * 3600_000;
const CLUSTER_THRESHOLD = 0.55;
const UPSERT_CHUNK = 400;
const UPDATE_CHUNK = 800;

interface Task {
  label: string;
  run: () => Promise<AdapterResult>;
}

/**
 * One ingest cycle: fetch everything → merge + upsert (dedupe by normalized
 * URL, KEV upgrades plain NVD rows) → tag entities → re-cluster the recent
 * window → recompute buzz scores. Every adapter is isolated: a dead source can
 * only ever cost you its own slice of the cycle.
 *
 * Written as a handful of batched statements rather than one statement per
 * item. The SQLite version could afford 2,000 synchronous prepares because the
 * database was a function call away; against a hosted Postgres the same shape
 * would be 2,000 network round trips.
 */
export async function runIngest(): Promise<IngestReport> {
  const lastRun = Number((await getMeta("lastIngestAt")) ?? 0);
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
  const degraded: IngestReport["degraded"] = [];
  const raw: RawItem[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      raw.push(...r.value.items);
      // Per-feed failures inside a successful adapter: visible, not fatal.
      for (const f of r.value.failures) {
        degraded.push({ source: `${tasks[i].label}/${f.feed}`, error: f.error });
      }
    } else {
      // The adapter itself threw: this source contributed nothing.
      errors.push({ source: tasks[i].label, error: String(r.reason).slice(0, 300) });
    }
  });

  const prepared: PreparedItem[] = [];
  for (const it of raw) {
    const url = normalizeUrl(it.url);
    if (!url || !it.title) continue;
    prepared.push({
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
      publishedAt: it.publishedAt || Date.now(),
      engagement: it.engagement ?? 0,
      meta: it.meta ? JSON.stringify(it.meta) : null,
      raw: it,
    });
  }

  const merged = mergeByUrl(prepared);
  const { inserted, updated, written } = await upsertAll(merged);
  const linked = await linkEntities(written);
  const clustered = await clusterAndScore();
  const now = Date.now();
  await setMeta("lastIngestAt", String(now));

  return { fetched: prepared.length, inserted, updated, clustered, errors, degraded, finishedAt: now, linked };
}

/**
 * Collapse same-URL items *within one cycle* before touching the database.
 *
 * This is required, not an optimisation: NVD and KEV both emit the canonical
 * `https://nvd.nist.gov/vuln/detail/CVE-…` URL, so a single cycle is guaranteed
 * to contain duplicate keys. Postgres refuses that outright — "ON CONFLICT DO
 * UPDATE command cannot affect row a second time" — whereas the old row-by-row
 * SQLite loop absorbed duplicates naturally because each iteration saw the
 * previous one's write.
 *
 * The merge applies the same rank rule as the stored-row guard: KEV wins, and a
 * stored KEV row is never downgraded by a lesser source.
 */
function mergeByUrl(items: PreparedItem[]): PreparedItem[] {
  const byUrl = new Map<string, PreparedItem>();
  for (const it of items) {
    const existing = byUrl.get(it.url);
    if (!existing) {
      byUrl.set(it.url, it);
      continue;
    }
    if (it.sourceKind === "kev") byUrl.set(it.url, it); // KEV upgrades
    else if (existing.sourceKind === "kev") continue; // never downgrade KEV
    else byUrl.set(it.url, it); // last writer wins, as the sequential loop was
  }
  return [...byUrl.values()];
}

interface PreparedItem {
  id: string;
  title: string;
  url: string;
  urlHash: string;
  summary: string | null;
  source: string;
  sourceKind: string;
  type: string;
  severity: string | null;
  cveId: string | null;
  publishedAt: number;
  engagement: number;
  meta: string | null;
  raw: RawItem;
}

const UPSERT_SQL = `
WITH input AS (
  SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
    id text, title text, url text, url_hash text, summary text, source text,
    source_kind text, type text, severity text, cve_id text,
    published_at bigint, engagement integer, meta text
  )
)
INSERT INTO items
  (id, title, url, url_hash, summary, source, source_kind, type, severity,
   cve_id, published_at, engagement, mentions, score, meta)
SELECT id, title, url, url_hash, summary, source, source_kind, type, severity,
       cve_id, published_at, engagement, 1, 0, meta
FROM input
ON CONFLICT (url) DO UPDATE SET
  severity    = COALESCE(EXCLUDED.severity, items.severity),
  type        = EXCLUDED.type,
  source      = EXCLUDED.source,
  source_kind = EXCLUDED.source_kind,
  summary     = COALESCE(items.summary, EXCLUDED.summary),
  cve_id      = COALESCE(items.cve_id, EXCLUDED.cve_id),
  meta        = EXCLUDED.meta
WHERE items.source_kind <> 'kev' OR EXCLUDED.source_kind = 'kev'
RETURNING id, (xmax = 0) AS was_insert
`;

/** Insert or upgrade in chunks; returns the rows that were actually written. */
async function upsertAll(items: PreparedItem[]) {
  const written: PreparedItem[] = [];
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < items.length; i += UPSERT_CHUNK) {
    const chunk = items.slice(i, i + UPSERT_CHUNK);
    const payload = chunk.map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      url_hash: r.urlHash,
      summary: r.summary,
      source: r.source,
      source_kind: r.sourceKind,
      type: r.type,
      severity: r.severity,
      cve_id: r.cveId,
      published_at: r.publishedAt,
      engagement: r.engagement,
      meta: r.meta,
    }));
    const rows = await query<{ id: string; was_insert: boolean }>(UPSERT_SQL, [JSON.stringify(payload)]);
    const byId = new Map(chunk.map((r) => [r.id, r]));
    for (const row of rows) {
      // A statement with no returned row means the guard rejected the write:
      // a stored KEV row met a non-KEV duplicate. Those are skipped entirely,
      // exactly as the SQLite branch did.
      const src = byId.get(row.id);
      if (!src) continue;
      written.push(src);
      if (row.was_insert) inserted++;
      else updated++;
    }
  }
  return { inserted, updated, written };
}

/**
 * Dictionary hits + source-provided names (ransomware victims, KEV vendors),
 * resolved against the entity table in two batched statements for the whole
 * cycle instead of three queries per item.
 */
async function linkEntities(items: PreparedItem[]): Promise<number> {
  const found = new Map<string, { name: string; kind: "company" | "product"; itemIds: string[] }>();

  for (const it of items) {
    const names = new Map<string, "company" | "product">();
    for (const e of matchEntities(`${it.raw.title} ${it.raw.summary ?? ""}`)) names.set(e.name, e.kind);
    for (const name of it.raw.entityNames ?? []) {
      const n = name.trim();
      if (n.length >= 3 && !names.has(n)) names.set(n, "company");
    }
    for (const [name, kind] of names) {
      const slug = slugify(name);
      if (!slug) continue;
      const slot = found.get(slug) ?? { name, kind, itemIds: [] };
      slot.itemIds.push(it.id);
      found.set(slug, slot);
    }
  }
  if (!found.size) return 0;

  const entityRows = await query<{ id: number; slug: string }>(
    `WITH input AS (
       SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(slug text, name text, kind text)
     )
     INSERT INTO entities (slug, name, kind)
     SELECT slug, name, kind FROM input
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, slug`,
    [JSON.stringify([...found].map(([slug, e]) => ({ slug, name: e.name, kind: e.kind })))]
  );
  const idBySlug = new Map(entityRows.map((r) => [r.slug, r.id]));

  const links: { item_id: string; entity_id: number }[] = [];
  for (const [slug, e] of found) {
    const entity_id = idBySlug.get(slug);
    if (entity_id === undefined) continue;
    for (const item_id of e.itemIds) links.push({ item_id, entity_id });
  }

  for (let i = 0; i < links.length; i += UPSERT_CHUNK) {
    await exec(
      `INSERT INTO item_entities (item_id, entity_id)
       SELECT item_id, entity_id FROM jsonb_to_recordset($1::jsonb)
         AS x(item_id text, entity_id integer)
       ON CONFLICT DO NOTHING`,
      [JSON.stringify(links.slice(i, i + UPSERT_CHUNK))]
    );
  }
  return links.length;
}

/**
 * Group same-story items across sources (the "trending" signal), then
 * buzz = base weight + cluster size + engagement, with recency applied at
 * query time so stored scores don't rot.
 * NVD/KEV rows skip clustering: one CVE = one URL, already merged at upsert.
 */
async function clusterAndScore(): Promise<number> {
  const since = Date.now() - CLUSTER_WINDOW_MS;
  const rows = await query<Pick<ItemRow, "id" | "title" | "published_at" | "engagement" | "source_kind"> & { meta: string | null }>(
    `SELECT id, title, published_at, engagement, source_kind, meta FROM items
     WHERE published_at >= $1 AND source_kind NOT IN ('nvd','kev')`,
    [since]
  );

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

  const updates = rows.map((r) => {
    const root = find(r.id);
    const mentions = size.get(root) ?? 1;
    let weight = BASE_WEIGHT[r.source_kind] ?? 1;
    if (r.source_kind === "rss" && r.meta) {
      try {
        weight = (JSON.parse(r.meta).weight as number) ?? weight;
      } catch {}
    }
    const score = weight + 2 * (Math.min(mentions, 6) - 1) + Math.log10(r.engagement + 1) * 1.5;
    return { id: r.id, cluster_id: rep.get(root)!, mentions, score };
  });

  for (let i = 0; i < updates.length; i += UPDATE_CHUNK) {
    const chunk = updates.slice(i, i + UPDATE_CHUNK);
    let n = 0;
    const rowSql = chunk
      .map(() => `($${++n}::text, $${++n}::text, $${++n}::int, $${++n}::float8)`)
      .join(",");
    await exec(
      `UPDATE items AS t
       SET cluster_id = v.cluster_id, mentions = v.mentions, score = v.score
       FROM (VALUES ${rowSql}) AS v(id, cluster_id, mentions, score)
       WHERE t.id = v.id`,
      chunk.flatMap((u) => [u.id, u.cluster_id, u.mentions, u.score])
    );
  }
  return size.size;
}
