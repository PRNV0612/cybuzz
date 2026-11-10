# CyBuzz

A cybersecurity news aggregator that reads like a feed and acts like a triage queue. It pulls
attacks, breaches, CVEs, and ransomware victims from public sources into one ranked timeline —
then tells you what to patch, who is being hit, and what is relevant to the stack you actually run.

Local-first: one SQLite file, no accounts, no API keys required.

## Quick start

```bash
npm install
npm run ingest      # first run backfills ~10 days of CVEs and all current feeds
npm run dev         # http://localhost:3000
```

Requires Node 20+ (uses native `fetch` and `AbortSignal.timeout`; developed on Node 24 under
[mise](https://mise.jdx.dev/)). The database is created at `data/cybuzz.db` on first run and is
gitignored — delete it to start clean.

To refresh later, either run `npm run ingest` again or press **Refresh** in the app, which calls
`POST /api/ingest` and re-renders. There is no scheduler yet (see Limitations).

Production: `npm run build && npm start`. Non-default port: `npm run dev -- -p 3210`.

## What it reads

| Source | How | What you get |
|---|---|---|
| The Hacker News, BleepingComputer, Krebs on Security | RSS | the high-signal scoops |
| SecurityWeek, Dark Reading, The Record, CyberScoop, SANS ISC, Cisco Talos | RSS/Atom | breadth: enterprise, policy, diary, research |
| NVD | REST API 2.0 | every new CVE with a CVSS score |
| CISA KEV | JSON catalog | CVEs confirmed exploited in the wild, with federal patch deadlines |
| ransomware.live | REST v2 | named ransomware victims, attackers, sectors |
| r/netsec, r/cybersecurity, r/blueteamsec, r/InfoSec | Atom | community signal |
| Hacker News | Algolia API | security stories over 40 points, with engagement |

Nothing is HTML-scraped. Instagram and X are deliberately excluded — their terms and API pricing
make them a poor foundation. Details, including three upstream API breakages we hit live, are in
[`docs/ENGINEERING.md`](docs/ENGINEERING.md).

## How ranking works

Two stages, so stored scores never go stale:

```
score = source weight + 2 × (min(mentions, 6) − 1) + 1.5 × log10(engagement + 1)
hot   = score + recency boost, applied at query time
```

`mentions` comes from cross-source clustering: news items from the last 14 days are compared on
title tokens, and a Jaccard similarity of 0.55 or higher means "the whole industry is covering this
one story" — which is the trending signal. KEV carries the highest source weight, because a
confirmed exploited CVE outranks coverage of one.

## Pages

| Route | Purpose |
|---|---|
| `/` | buzz-ranked feed for the last 7 days, grouped by day, with a breaking strip and type filters |
| `/actions` | the triage queue: fresh KEV entries with deadlines, trending-and-exploited CVEs, ransomware actor and sector streaks |
| `/mystack` | pick the vendors you run; get a personal alert feed off the entity graph |
| `/cve` | CVEs sorted by severity, KEV-flagged ones marked |
| `/attacks` | attacks, breaches, and ransomware incidents |
| `/companies` | most-mentioned organisations, with a per-entity timeline |
| `/search` | title, summary, and CVE-ID search |
| `/bookmarks` | saved items (stored in `localStorage`) |

## JSON API

Pages read SQLite directly; these routes exist for the client widgets and for you.

```
GET  /api/items                              # ranked feed (?type=&days=&limit=&offset=)
GET  /api/items?q=term                       # search
GET  /api/items?view=cves&kev=1              # CVEs, optionally KEV-only
GET  /api/items?view=attacks&days=14
GET  /api/items?view=stats
GET  /api/items?view=entities                # entity slugs for the watchlist picker
GET  /api/items?entity=microsoft             # one entity and its items
GET  /api/items?entities=okta,cisco&days=14  # watchlist query
POST /api/ingest                             # run a full ingest cycle, returns the report
```

## Configuration

| Variable | Default | Effect |
|---|---|---|
| `CYBUZZ_DB` | `data/cybuzz.db` | SQLite location |
| `NVD_API_KEY` | unset | raises NVD from 5 req/30s to 50 req/s and allows wider windows |

## Limitations, honestly

- **No scheduler.** Ingestion is pull-only — a cron or a Fly.io machine schedule is the missing
  piece for "always current" without pressing Refresh.
- **Local-first storage.** One SQLite file, no multi-user story. Postgres plus real accounts is
  the planned deploy path; `drizzle-orm` is already a dependency for it, though nothing imports it
  yet — the schema is still the raw SQL in `src/lib/db.ts`.
- **Entity tagging is a curated dictionary**, not NER. It covers the major vendors and breach
  regulars and misses the long tail; an extraction pass is the v2 upgrade.
- **Reddit items carry no engagement** (their `.json` endpoints now require OAuth), so they rank on
  freshness and clustering alone.
- **Search is `LIKE`,** not full-text. Fine at thousands of rows, not at millions.

## Docs

[`docs/ENGINEERING.md`](docs/ENGINEERING.md) — architecture, every technology choice with the
alternatives we rejected and when to revisit them, the ingestion pipeline with `file:line`
citations, the schema, the ranking model, and the upstream API drift lessons.
