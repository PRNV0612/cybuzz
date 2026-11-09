import { getDb, getMeta } from "./db";
import type { ItemRow, ItemType } from "./types";

export interface FeedItem extends ItemRow {
  hot: number;
}

const HOT_SQL = `
  (score + CASE
    WHEN published_at > @h24 THEN 3
    WHEN published_at > @h72 THEN 1.5
    ELSE 0
  END)`;

/** Buzz-ordered feed: stored score + recency boost applied at query time. */
export function getFeed(opts: {
  type?: ItemType | "all";
  days?: number;
  limit?: number;
  offset?: number;
} = {}): FeedItem[] {
  const now = Date.now();
  const params: Record<string, unknown> = {
    h24: now - 24 * 3600_000,
    h72: now - 72 * 3600_000,
    limit: opts.limit ?? 40,
    offset: opts.offset ?? 0,
  };
  let where = "1=1";
  if (opts.type && opts.type !== "all") {
    where += " AND type = @type";
    params.type = opts.type;
  }
  if (opts.days) {
    where += " AND published_at > @since";
    params.since = now - opts.days * 24 * 3600_000;
  }
  return getDb()
    .prepare(`SELECT *, ${HOT_SQL} AS hot FROM items WHERE ${where}
              ORDER BY hot DESC, published_at DESC LIMIT @limit OFFSET @offset`)
    .all(params) as FeedItem[];
}

/** Breaking strip: newest critical/high items in the last 24 h. */
export function getTicker(limit = 12): FeedItem[] {
  const now = Date.now();
  return getDb()
    .prepare(`SELECT *, ${HOT_SQL} AS hot FROM items
              WHERE published_at > @d1 AND severity IN ('critical','high')
              ORDER BY published_at DESC LIMIT @limit`)
    .all({ h24: now - 24 * 3600_000, h72: now - 72 * 3600_000, d1: now - 24 * 3600_000, limit }) as FeedItem[];
}

export function getCves(opts: { kevOnly?: boolean; days?: number; limit?: number } = {}): FeedItem[] {
  const now = Date.now();
  const params: Record<string, unknown> = {
    h24: now - 24 * 3600_000,
    h72: now - 72 * 3600_000,
    limit: opts.limit ?? 50,
  };
  let where = "type = 'cve'";
  if (opts.kevOnly) where += " AND source_kind = 'kev'";
  if (opts.days) {
    where += " AND published_at > @since";
    params.since = now - opts.days * 24 * 3600_000;
  }
  return getDb()
    .prepare(`SELECT *, ${HOT_SQL} AS hot FROM items WHERE ${where}
              ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                       published_at DESC LIMIT @limit`)
    .all(params) as FeedItem[];
}

export function getAttacks(opts: { days?: number; limit?: number } = {}): FeedItem[] {
  const now = Date.now();
  return getDb()
    .prepare(`SELECT *, ${HOT_SQL} AS hot FROM items
              WHERE type IN ('attack','breach','ransomware') AND published_at > @since
              ORDER BY hot DESC, published_at DESC LIMIT @limit`)
    .all({
      h24: now - 24 * 3600_000,
      h72: now - 72 * 3600_000,
      since: now - (opts.days ?? 14) * 24 * 3600_000,
      limit: opts.limit ?? 60,
    }) as FeedItem[];
}

export function searchItems(q: string, limit = 40): FeedItem[] {
  const now = Date.now();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  return getDb()
    .prepare(`SELECT *, ${HOT_SQL} AS hot FROM items
              WHERE title LIKE @like OR summary LIKE @like OR cve_id LIKE @like
              ORDER BY hot DESC, published_at DESC LIMIT @limit`)
    .all({ h24: now - 24 * 3600_000, h72: now - 72 * 3600_000, like, limit }) as FeedItem[];
}

export function getTopEntities(limit = 24, days = 30) {
  return getDb()
    .prepare(`SELECT e.id, e.slug, e.name, e.kind, COUNT(*) AS n
              FROM entities e JOIN item_entities ie ON ie.entity_id = e.id
              JOIN items i ON i.id = ie.item_id
              WHERE i.published_at > @since
              GROUP BY e.id ORDER BY n DESC LIMIT @limit`)
    .all({ since: Date.now() - days * 24 * 3600_000, limit }) as {
    id: number;
    slug: string;
    name: string;
    kind: string;
    n: number;
  }[];
}

export function getEntity(slug: string) {
  const db = getDb();
  const ent = db.prepare("SELECT * FROM entities WHERE slug = ?").get(slug) as
    | { id: number; slug: string; name: string; kind: string }
    | undefined;
  if (!ent) return null;
  const now = Date.now();
  const items = db
    .prepare(`SELECT *, ${HOT_SQL} AS hot FROM items
              WHERE id IN (SELECT item_id FROM item_entities WHERE entity_id = @eid)
              ORDER BY published_at DESC LIMIT 100`)
    .all({ eid: ent.id, h24: now - 24 * 3600_000, h72: now - 72 * 3600_000 }) as FeedItem[];
  return { entity: ent, items };
}

/** Entity names per item, for card chips. */
export function getEntityNamesByItem(ids: string[]): Map<string, string[]> {
  if (!ids.length) return new Map();
  const rows = getDb()
    .prepare(
      `SELECT ie.item_id AS itemId, e.name AS name
       FROM item_entities ie JOIN entities e ON e.id = ie.entity_id
       WHERE ie.item_id IN (${ids.map(() => "?").join(",")})`
    )
    .all(...ids) as { itemId: string; name: string }[];
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.itemId, [...(map.get(r.itemId) ?? []), r.name]);
  return map;
}

/** Fresh CISA KEV additions — federal patch deadlines in force now. */
export function getFreshKev(days = 14, limit = 25): FeedItem[] {
  const now = Date.now();
  return getDb()
    .prepare(`SELECT *, ${HOT_SQL} AS hot FROM items
              WHERE source_kind = 'kev' AND published_at > @since
              ORDER BY published_at DESC LIMIT @limit`)
    .all({ h24: now - 24 * 3600_000, h72: now - 72 * 3600_000, since: now - days * 24 * 3600_000, limit }) as FeedItem[];
}

/** Exploited-or-attention: KEV entries plus CVE stories multiple outlets cluster on. */
export function getTrendingExploited(days = 7, limit = 12): FeedItem[] {
  const now = Date.now();
  return getDb()
    .prepare(`SELECT *, ${HOT_SQL} AS hot FROM items
              WHERE (source_kind = 'kev' AND published_at > @d30)
                   OR (type = 'cve' AND mentions >= 2 AND published_at > @since)
              ORDER BY hot DESC LIMIT @limit`)
    .all({
      h24: now - 24 * 3600_000, h72: now - 72 * 3600_000,
      d30: now - 30 * 24 * 3600_000, since: now - days * 24 * 3600_000, limit,
    }) as FeedItem[];
}

/** Ransomware "hot streak": who is attacking, what sectors, from incident meta. */
export function getRansomwareTrends(days = 14) {
  const rows = getDb()
    .prepare("SELECT meta, published_at FROM items WHERE type = 'ransomware' AND published_at > ?")
    .all(Date.now() - days * 24 * 3600_000) as { meta: string | null; published_at: number }[];
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
export function getItemsByEntities(slugs: string[], days = 7, limit = 60): FeedItem[] {
  if (!slugs.length) return [];
  const now = Date.now();
  const params: Record<string, unknown> = {
    h24: now - 24 * 3600_000, h72: now - 72 * 3600_000,
    since: now - days * 24 * 3600_000, limit,
  };
  const ph = slugs.map((s, i) => { params[`s${i}`] = s; return `@s${i}`; }).join(",");
  return getDb()
    .prepare(`SELECT DISTINCT i.*, ${HOT_SQL} AS hot FROM items i
              JOIN item_entities ie ON ie.item_id = i.id
              JOIN entities e ON e.id = ie.entity_id
              WHERE e.slug IN (${ph}) AND i.published_at > @since
              ORDER BY hot DESC LIMIT @limit`)
    .all(params) as FeedItem[];
}

/** Entity names/slugs for the watchlist picker. */
export function getEntityOptions(limit = 120) {
  return getDb()
    .prepare(`SELECT e.slug, e.name, e.kind, COUNT(*) AS n
              FROM entities e JOIN item_entities ie ON ie.entity_id = e.id
              GROUP BY e.id ORDER BY n DESC LIMIT ?`)
    .all(limit) as { slug: string; name: string; kind: string; n: number }[];
}

export function getStats() {
  const db = getDb();
  const since7 = Date.now() - 7 * 24 * 3600_000;
  const counts = db
    .prepare("SELECT type, COUNT(*) AS n FROM items WHERE published_at > @s GROUP BY type")
    .all({ s: since7 }) as { type: ItemType; n: number }[];
  const total = (db.prepare("SELECT COUNT(*) AS n FROM items").get() as { n: number }).n;
  const kevNew = (db
    .prepare("SELECT COUNT(*) AS n FROM items WHERE source_kind = 'kev' AND published_at > @s")
    .get({ s: since7 }) as { n: number }).n;
  return {
    week: Object.fromEntries(counts.map((c) => [c.type, c.n])) as Record<ItemType, number>,
    total,
    kevNew,
    lastIngestAt: Number(getMeta("lastIngestAt") ?? 0) || null,
  };
}
