import RssParser from "rss-parser";
import type { AdapterResult, RawItem } from "../types";
import { extractCveId } from "../entities";
import { truncate } from "./normalize";

/**
 * Reddit community signal.
 *
 * API drift note (2026-11): Reddit killed anonymous access to the *.json
 * endpoints (HTML/302 responses). The Atom feeds (*.rss) still work
 * unauthenticated, so we read those instead. Trade-off: no upvote counts
 * in RSS, so Reddit items lose their engagement component in the buzz
 * score — they rank on freshness + clustering only. If Reddit engagement
 * matters later, the upgrade path is OAuth app-only credentials.
 *
 * Rate-limit note: Reddit answers ~1 request then 429s with
 * `x-ratelimit-remaining: 0`. Firing all four subreddits in parallel used to
 * guarantee three silent failures, and the adapter swallowed them. So: one at
 * a time, polite gap, and every rejection is reported as a degraded slice.
 * From a datacenter IP (GitHub Actions runners) this source may still come
 * back empty — that is now visible in the report instead of invisible.
 */
const SUBREDDITS = ["netsec", "cybersecurity", "blueteamsec", "InfoSec"];
const GAP_MS = 2_500;

const parser = new RssParser({
  timeout: 20000,
  headers: { "User-Agent": "cybuzz:research-reader:v0.1 (personal use)" },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function ingestReddit(): Promise<AdapterResult> {
  const items: RawItem[] = [];
  const failures: AdapterResult["failures"] = [];

  for (let i = 0; i < SUBREDDITS.length; i++) {
    const sub = SUBREDDITS[i];
    if (i > 0) await sleep(GAP_MS);
    try {
      const feed = await parser.parseURL(
        `https://www.reddit.com/r/${sub}/top.rss?t=day&limit=25`
      );
      for (const it of (feed.items ?? []).slice(0, 25)) {
        const summary = truncate(
          (it.content ?? it.contentSnippet ?? "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
          400
        );
        const cveId = extractCveId(`${it.title ?? ""} ${summary}`);
        items.push({
          title: (it.title ?? "").trim(),
          url: it.link ?? it.guid ?? "",
          summary: summary || undefined,
          source: `r/${sub}`,
          sourceKind: "reddit",
          type: cveId ? "cve" : "discussion",
          cveId,
          publishedAt: Date.parse(it.isoDate ?? it.pubDate ?? "") || Date.now(),
          meta: { subreddit: sub },
        });
      }
    } catch (e) {
      failures.push({ feed: `r/${sub}`, error: String(e).slice(0, 200) });
    }
  }
  return { items, failures };
}
