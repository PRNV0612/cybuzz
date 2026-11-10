import { Pool, types as pgTypes, type PoolClient } from "pg";

/**
 * node-postgres returns int8 (BIGINT columns *and* COUNT()/SUM()) as strings,
 * because a JS number cannot hold the full int64 range. Our int8 column only
 * ever holds epoch milliseconds (~1.7e12) and counts, both far inside 2^53, so
 * parsing to Number is safe here and keeps `published_at: number` honest.
 * Without this, `Date.now() - item.published_at` yields NaN and every relative
 * timestamp in the UI silently breaks.
 */
pgTypes.setTypeParser(20, (v) => (v === null || v === "" ? null : Number(v)));

/**
 * Postgres via node-postgres, Neon-hosted.
 *
 * Everything the app does with the database goes through `query()` or
 * `withTransaction()` below — one funnel, so the schema bootstrap, the pool,
 * and the "await readiness" concern live in exactly one place. Call sites stay
 * one-liners.
 *
 * Two deliberate decisions:
 *
 * 1. `published_at` stays BIGINT epoch-milliseconds rather than `timestamptz`.
 *    Every recency/ranking expression in `items.ts` computes millisecond
 *    thresholds in JS and compares numerically. Keeping the numeric column
 *    means the ranking SQL is unchanged from the SQLite version, and it avoids
 *    converting Date <-> number across 40 call sites. If we later want
 *    date_trunc() in SQL, that is a one-way migration.
 *
 * 2. Schema is idempotent DDL applied lazily on first query, not a migration
 *    file. This is still a single-user v1 with one table set; when the schema
 *    starts changing in ways that need backfill, drizzle-kit becomes the tool.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS items (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  url          TEXT NOT NULL UNIQUE,
  url_hash     TEXT NOT NULL,
  summary      TEXT,
  source       TEXT NOT NULL,
  source_kind  TEXT NOT NULL,
  type         TEXT NOT NULL,
  severity     TEXT,
  cve_id       TEXT,
  published_at BIGINT NOT NULL,
  engagement   INTEGER NOT NULL DEFAULT 0,
  mentions     INTEGER NOT NULL DEFAULT 1,
  cluster_id   TEXT,
  score        DOUBLE PRECISION NOT NULL DEFAULT 0,
  meta         TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_published ON items (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_type ON items (type);
CREATE INDEX IF NOT EXISTS idx_items_cluster ON items (cluster_id);
CREATE INDEX IF NOT EXISTS idx_items_cve ON items (cve_id);
CREATE INDEX IF NOT EXISTS idx_items_hash ON items (url_hash);

CREATE TABLE IF NOT EXISTS entities (
  id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('company','product'))
);

CREATE TABLE IF NOT EXISTS item_entities (
  item_id   TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_item_entities_e ON item_entities (entity_id);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`;

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at your Neon pooled connection string " +
        "(actions/ingest and the app both need it)."
    );
  }
  // Neon's pooled endpoint runs pgbouncer in transaction mode. node-postgres
  // sends parameterised queries through the *unnamed* statement, which
  // transaction mode supports — so this is safe. Named prepared statements
  // (drizzle's default, Prisma, etc.) would NOT be.
  const verifyTls = process.env.PGSSL_INSECURE !== "1";
  pool = new Pool({
    connectionString: url,
    ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: verifyTls },
    max: Number(process.env.PG_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  });
  pool.on("error", (err) => console.error("[cybuzz] idle pool client error:", err.message));
  return pool;
}

/** Applies the schema once per process; every helper awaits this. */
function dbReady(): Promise<void> {
  if (!ready) ready = getPool().query(SCHEMA).then(() => undefined);
  return ready;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  await dbReady();
  const res = await getPool().query(text, params as never[]);
  return res.rows as T[];
}

/** Single-row convenience: returns undefined when nothing matched. */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

export async function exec(text: string, params: unknown[] = []): Promise<void> {
  await dbReady();
  await getPool().query(text, params as never[]);
}

/**
 * Runs fn inside one transaction on a dedicated client. Postgres has no
 * synchronous transaction API, so fn must be async and every statement inside
 * it must use the client it is handed.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await dbReady();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getMeta(key: string): Promise<string | null> {
  const row = await queryOne<{ value: string }>("SELECT value FROM meta WHERE key = $1", [key]);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await exec(
    "INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [key, value]
  );
}

/** Close the pool so CLI scripts exit instead of hanging. */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    ready = null;
  }
}
