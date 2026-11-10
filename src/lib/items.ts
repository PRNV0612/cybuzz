import { query, queryOne } from "./db";
import type { ItemRow, ItemType } from "./types";

export interface FeedItem extends ItemRow {
  hot: number;
}

/**
 * Recency boost applied at read time so stored scores never go stale.
 * Identical arithmetic to the SQLite version; `hot` is a select-list alias,
 * which Postgres allows in ORDER BY.
 */
const HOT = (h24: string, h72: string) =>
  `(score + CASE
     WHEN published_at > ${h24} THEN 3
     WHEN published_at > ${h72} THEN 1.5
     ELSE 0
   END)`;

/**
 * Placeholder builder: appending a value returns its `$n`, so the numbering can
 * never drift out of sync with the parameter array. Values are always bound,
 * never interpolated.
 */
const mk = () => {
  const params: unknown[] = [];
  return {
    params,
    add: (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    },
  };
};

const DAY = 24 * 3600_000;

/** Buzz-ordered feed: stored score + recency boost applied at query time. */
export async function getFeed(opts: {
  type?: ItemType | "all";
  days?: number;
  limit?: number;
  offset?: number;
} = {}): Promise<FeedItem[]> {
  const now = Date.now();
  const { params, add } = mk();
  const hot = HOT(add(now - DAY), add(now - 3 * DAY));
  let where = "1=1";
  if (opts.type && opts.type !== "all") where += ` AND type = ${add(opts.type)}`;
  if (opts.days) where += ` AND published_at > ${add(now - opts.days * DAY)}`;
  const limit = add(opts.limit ?? 40);
  const offset = add(opts.offset ?? 0);
  return query<FeedItem>(
    `SELECT *, ${hot} AS hot FROM items WHERE ${where}
     ORDER BY hot DESC, published_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
}

/** Breaking strip: newest critical/high items in the last 24 h. */
export async function getTicker(limit = 12): Promise<FeedItem[]> {
  const now = Date.now();
  const { params, add } = mk();
  const hot = HOT(add(now - DAY), add(now - 3 * DAY));
  const d1 = add(now - DAY);
  return query<FeedItem>(
    `SELECT *, ${hot} AS hot FROM items
     WHERE published_at > ${d1} AND severity IN ('critical','high')
     ORDER BY published_at DESC LIMIT ${add(limit)}`,
    params
  );
}

export async function getCves(opts: {
  kevOnly?: boolean;
  days?: number;
  limit?: number;
} = {}): Promise<FeedItem[]> {
  const now = Date.now();
  const { params, add } = mk();
  const hot = HOT(add(now - DAY), add(now - 3 * DAY));
  let where = "type = 'cve'";
  if (opts.kevOnly) where += " AND source_kind = 'kev'";
  if (opts.days) where += ` AND published_at > ${add(now - opts.days * DAY)}`;
  return query<FeedItem>(
    `SELECT *, ${hot} AS hot FROM items WHERE ${where}
     ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
              published_at DESC LIMIT ${add(opts.limit ?? 50)}`,
    params
  );
}

export async function getAttacks(opts: { days?: number; limit?: number } = {}): Promise<FeedItem[]> {
  const now = Date.now();
  const { params, add } = mk();
  const hot = HOT(add(now - DAY), add(now - 3 * DAY));
  const since = add(now - (opts.days ?? 14) * DAY);
  return query<FeedItem>(
    `SELECT *, ${hot} AS hot FROM items
     WHERE type IN ('attack','breach','ransomware') AND published_at > ${since}
     ORDER BY hot DESC, published_at DESC LIMIT ${add(opts.limit ?? 60)}`,
    params
  );
}

/**
 * ILIKE, not LIKE: SQLite's LIKE is case-insensitive for ASCII and Postgres'
 * is not, so LIKE here would silently make search case-sensitive.
 */
export async function searchItems(q: string, limit = 40): Promise<FeedItem[]> {
  const now = Date.now();
  const { params, add } = mk();
  const hot = HOT(add(now - DAY), add(now - 3 * DAY));
  const like = add(`%${q.replace(/[%_]/g, "")}%`);
  return query<FeedItem>(
    `SELECT *, ${hot} AS hot FROM items
     WHERE title ILIKE ${like} OR summary ILIKE ${like} OR cve_id ILIKE ${like}
     ORDER BY hot DESC, published_at DESC LIMIT ${add(limit)}`,
    params
  );
}

export async function getTopEntities(limit = 24, days = 30) {
  const { params, add } = mk();
  return query<{ id: number; slug: string; name: string; kind: string; n: number }>(
    `SELECT e.id, e.slug, e.name, e.kind, COUNT(*) AS n
     FROM entities e JOIN item_entities ie ON ie.entity_id = e.id
     JOIN items i ON i.id = ie.item_id
     WHERE i.published_at > ${add(Date.now() - days * DAY)}
     GROUP BY e.id, e.slug, e.name, e.kind ORDER BY n DESC LIMIT ${add(limit)}`,
    params
  );
}

export async function getEntity(slug: string) {
  const ent = await queryOne<{ id: number; slug: string; name: string; kind: string }>(
    "SELECT * FROM entities WHERE slug = $1",
    [slug]
  );
  if (!ent) return null;
  const now = Date.now();
  const { params, add } = mk();
  const hot = HOT(add(now - DAY), add(now - 3 * DAY));
  const eid = add(ent.id);
  const items = await query<FeedItem>(
    `SELECT *, ${hot} AS hot FROM items
     WHERE id IN (SELECT item_id FROM item_entities WHERE entity_id = ${eid})
     ORDER BY published_at DESC LIMIT 100`,
    params
  );
  return { entity: ent, items };
}

/** Entity names per item, for card chips. */
export async function getEntityNamesByItem(ids: string[]): Promise<Map<string, string[]>> {
  if (!ids.length) return new Map();
  const rows = await query<{ itemId: string; name: string }>(
    `SELECT ie.item_id AS "itemId", e.name AS name
     FROM item_entities ie JOIN entities e ON e.id = ie.entity_id
     WHERE ie.item_id IN (${ids.map((_, i) => `$${i + 1}`).join(",")})`,
    ids
  );
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.itemId, [...(map.get(r.itemId) ?? []), r.name]);
  return map;
}

/** Fresh CISA KEV additions — federal patch deadlines in force now. */
export async function getFreshKev(days = 14, limit = 25): Promise<FeedItem[]> {
  const now = Date.now();
  const { params, add } = mk();
  const hot = HOT(add(now - DAY), add(now - 3 * DAY));
  const since = add(now - days * DAY);
  return query<FeedItem>(
    `SELECT *, ${hot} AS hot FROM items
     WHERE source_kind = 'kev' AND published_at > ${since}
     ORDER BY published_at DESC LIMIT ${add(limit)}`,
    params
  );
}

/** Exploited-or-attention: KEV entries plus CVE stories multiple outlets cluster on. */
export async function getTrendingExploited(days = 7, limit = 12): Promise<FeedItem[]> {
  const now = Date.now();
  const { params, add } = mk();
  const hot = HOT(add(now - DAY), add(now - 3 * DAY));
  const d30 = add(now - 30 * DAY);
  const since = add(now - days * DAY);
  return query<FeedItem>(
    `SELECT *, ${hot} AS hot FROM items
     WHERE (source_kind = 'kev' AND published_at > ${d30})
        OR (type = 'cve' AND mentions >= 2 AND published_at > ${since})
     ORDER BY hot DESC LIMIT ${add(limit)}`,
    params
  );
}

/** Ransomware "hot streak": who is attacking, what sectors, from incident meta. */
export async function getRansomwareTrends(days = 14) {
  const rows = await query<{ meta: string | null }>(
    "SELECT meta FROM items WHERE type = 'ransomware' AND published_at > $1",
    [Date.now() - days * DAY]
  );
  const actors = new Map<string, number>();
  const sectors = new Map<string, number>();
  for (const r of rows) {
    if (!r.meta) continue;
    try {
      const m = JSON.parse(r.meta) as { actor?: string; sector?: string };
      if (m.actor) actors.set(m.actor, (actors.get(m.actor) ?? 0) + 1);
      if (m.sector) sectors.set(m.sector, (sectors.get(m.sector) ?? 0) + 1);
    } catch {}
  }
  const top = (m: Map<string, number>, n: number) =>
    [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  return { incidents: rows.length, actors: top(actors, 6), sectors: top(sectors, 6) };
}

/** Items mentioning any of the given entity slugs — the stack watchlist. */
export async function getItemsByEntities(
  slugs: string[],
  days = 7,
  limit = 60
): Promise<FeedItem[]> {
  if (!slugs.length) return [];
  const now = Date.now();
  const { params, add } = mk();
  const hot = HOT(add(now - DAY), add(now - 3 * DAY));
  const since = add(now - days * DAY);
  const list = slugs.map(add).join(",");
  return query<FeedItem>(
    `SELECT DISTINCT i.*, ${hot} AS hot FROM items i
     JOIN item_entities ie ON ie.item_id = i.id
     JOIN entities e ON e.id = ie.entity_id
     WHERE e.slug IN (${list}) AND i.published_at > ${since}
     ORDER BY hot DESC LIMIT ${add(limit)}`,
    params
  );
}

/** Entity names/slugs for the watchlist picker. */
export async function getEntityOptions(limit = 120) {
  return query<{ slug: string; name: string; kind: string; n: number }>(
    `SELECT e.slug, e.name, e.kind, COUNT(*) AS n
     FROM entities e JOIN item_entities ie ON ie.entity_id = e.id
     GROUP BY e.slug, e.name, e.kind ORDER BY n DESC LIMIT $1`,
    [limit]
  );
}

export async function getStats() {
  const since7 = Date.now() - 7 * DAY;
  const counts = await query<{ type: ItemType; n: number }>(
    "SELECT type, COUNT(*) AS n FROM items WHERE published_at > $1 GROUP BY type",
    [since7]
  );
  const total = await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM items");
  const kevNew = await queryOne<{ n: number }>(
    "SELECT COUNT(*) AS n FROM items WHERE source_kind = 'kev' AND published_at > $1",
    [since7]
  );
  const last = await queryOne<{ value: string }>("SELECT value FROM meta WHERE key = 'lastIngestAt'");
  return {
    week: Object.fromEntries(counts.map((c) => [c.type, c.n])) as Record<ItemType, number>,
    total: total?.n ?? 0,
    kevNew: kevNew?.n ?? 0,
    lastIngestAt: Number(last?.value ?? 0) || null,
  };
}
