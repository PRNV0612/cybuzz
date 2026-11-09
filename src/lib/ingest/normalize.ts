import { createHash } from "node:crypto";

/** fetch with timeout + sane UA; every adapter goes through this. */
export async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 20_000): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "User-Agent": "cybuzz/0.1 (local research feed reader)",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return (await res.json()) as T;
}

export async function fetchText(url: string, timeoutMs = 20_000): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
}

/** Strip tracking params, lowercase host, drop hash/fragment → stable key. */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const drop = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "ref"]);
    [...u.searchParams.keys()].forEach((k) => {
      if (drop.has(k.toLowerCase())) u.searchParams.delete(k);
    });
    u.search = u.searchParams.toString();
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

export function urlHash(url: string): string {
  return createHash("sha1").update(normalizeUrl(url)).digest("hex");
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "for", "to", "with", "after", "before",
  "is", "are", "was", "were", "be", "been", "has", "have", "had", "its", "it", "this",
  "that", "from", "at", "as", "by", "new", "says", "say", "report", "reported", "over",
]);

/** Bag-of-significant-words for clustering. */
export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/[\s-]+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}
