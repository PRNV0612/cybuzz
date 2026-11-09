import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * Local-first SQLite via better-sqlite3.
 * Schema is idempotent SQL applied at open time — no migration tool needed
 * while this is a single local file. When we deploy, we swap in drizzle-kit
 * against Postgres and this bootstrap becomes the seed migration.
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
  published_at INTEGER NOT NULL,
  engagement   INTEGER NOT NULL DEFAULT 0,
  mentions     INTEGER NOT NULL DEFAULT 1,
  cluster_id   TEXT,
  score        REAL NOT NULL DEFAULT 0,
  meta         TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_published ON items (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_type ON items (type);
CREATE INDEX IF NOT EXISTS idx_items_cluster ON items (cluster_id);
CREATE INDEX IF NOT EXISTS idx_items_cve ON items (cve_id);
CREATE INDEX IF NOT EXISTS idx_items_hash ON items (url_hash);

CREATE TABLE IF NOT EXISTS entities (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
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

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const file =
    process.env.CYBUZZ_DB ??
    path.join(process.cwd(), "data", "cybuzz.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  getDb()
    .prepare(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, value);
}
