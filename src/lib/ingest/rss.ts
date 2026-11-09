import RssParser from "rss-parser";
import type { RawItem } from "../types";
import { classifyType, extractCveId } from "../entities";
import { truncate } from "./normalize";

const parser = new RssParser({ timeout: 20000 });

/**
 * News vertical via RSS/Atom — the backbone. Every outlet here publishes a
 * free, stable feed, which is why we never scrape their HTML.
 * Weights drive the buzz score: bigger scoop magnetism = bigger weight.
 */
export const FEEDS: { name: string; url: string; weight: number }[] = [
  { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", weight: 3 },
  { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", weight: 3 },
  { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", weight: 3 },
  { name: "SecurityWeek", url: "https://www.securityweek.com/feed/", weight: 2 },
  { name: "Dark Reading", url: "https://www.darkreading.com/rss.xml", weight: 2 },
  { name: "The Record", url: "https://therecord.media/feed", weight: 2 },
  { name: "CyberScoop", url: "https://cyberscoop.com/feed/", weight: 2 },
  { name: "SANS ISC", url: "https://isc.sans.edu/rssfeed.xml", weight: 2 },
  { name: "Cisco Talos", url: "https://blog.talosintelligence.com/feeds/posts/default", weight: 1 },
];

export async function ingestRss(): Promise<RawItem[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const feed = await parser.parseURL(f.url);
      return (feed.items ?? []).slice(0, 30).map((it): RawItem => {
        const title = (it.title ?? "").trim();
        const summary = truncate(
          (it.contentSnippet ?? it.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
          400
        );
        const cveId = extractCveId(`${title} ${summary}`);
        return {
          title,
          url: it.link ?? it.guid ?? title,
          summary,
          source: f.name,
          sourceKind: "rss",
          type: cveId ? "cve" : classifyType(title, summary),
          cveId,
          publishedAt: Date.parse(it.isoDate ?? it.pubDate ?? "") || Date.now(),
          meta: { weight: f.weight },
        };
      });
    })
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
