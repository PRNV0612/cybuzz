import RssParser from "rss-parser";
import type { RawItem } from "../types";
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
 */
const SUBREDDITS = ["netsec", "cybersecurity", "blueteamsec", "InfoSec"];

const parser = new RssParser({
  timeout: 20000,
  headers: { "User-Agent": "cybuzz:research-reader:v0.1 (personal use)" },
});

export async function ingestReddit(): Promise<RawItem[]> {
  const results = await Promise.allSettled(
    SUBREDDITS.map(async (sub) => {
      const feed = await parser.parseURL(
        `https://www.reddit.com/r/${sub}/top.rss?t=day&limit=30`
      );
      return (feed.items ?? []).slice(0, 30).map((it): RawItem => {
        const summary = truncate(
          (it.content ?? it.contentSnippet ?? "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
          400
        );
        const cveId = extractCveId(`${it.title ?? ""} ${summary}`);
        return {
          title: (it.title ?? "").trim(),
          url: it.link ?? it.guid ?? "",
          summary: summary || undefined,
          source: `r/${sub}`,
          sourceKind: "reddit",
          type: cveId ? "cve" : "discussion",
          cveId,
          publishedAt: Date.parse(it.isoDate ?? it.pubDate ?? "") || Date.now(),
          meta: { subreddit: sub },
        };
      });
    })
  );
  const items = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  // Community posts stay "discussion" unless they name a CVE (set above).
  return items;
}
