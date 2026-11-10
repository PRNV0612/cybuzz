import type { AdapterResult, RawItem } from "../types";
import { fetchJson } from "./normalize";

/**
 * Hacker News via the free Algolia API. Keyword search over the last week,
 * points-weighted — HN front-page security stories are a strong "the industry
 * is paying attention" signal.
 */
const TERMS = ["data breach", "ransomware", "CVE", "vulnerability", "exploit", "zero-day", "cyberattack"];

interface HnHit {
  objectID: string;
  title?: string;
  url?: string;
  points?: number;
  num_comments?: number;
  created_at_i?: number;
}

export async function ingestHackerNews(): Promise<AdapterResult> {
  const since = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
  const results = await Promise.allSettled(
    TERMS.map(async (term) => {
      const params = new URLSearchParams({
        query: term,
        tags: "story",
        hitsPerPage: "15",
        numericFilters: `created_at_i>${since},points>40`,
      });
      const data = await fetchJson<{ hits: HnHit[] }>(
        `https://hn.algolia.com/api/v1/search?${params}`
      );
      return (data.hits ?? [])
        .filter((h) => h.title)
        .map((h): RawItem => ({
          title: h.title!,
          url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
          summary: `${h.points ?? 0} points, ${h.num_comments ?? 0} comments on Hacker News.`,
          source: "Hacker News",
          sourceKind: "hn",
          type: "discussion",
          publishedAt: (h.created_at_i ?? 0) * 1000 || Date.now(),
          engagement: h.points ?? 0,
          meta: { hnId: h.objectID, comments: num_comments_safe(h), query: term },
        }));
    })
  );

  const items: RawItem[] = [];
  const failures: AdapterResult["failures"] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...r.value);
    else failures.push({ feed: `hn:"${TERMS[i]}"`, error: String(r.reason).slice(0, 200) });
  });
  return { items, failures };
}

/** Algolia occasionally omits the comment count; never let it break the row. */
function num_comments_safe(h: HnHit): number {
  return h.num_comments ?? 0;
}
