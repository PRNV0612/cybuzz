/**
 * Stack watchlist: entity slugs the reader cares about, localStorage-only
 * (same no-accounts v1 contract as bookmarks). Shape mirrors the API rows,
 * so moving server-side later is swapping read/save.
 */
const KEY = "cybuzz.watchlist";

export function readWatchlist(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(slugs: string[]): void {
  localStorage.setItem(KEY, JSON.stringify([...new Set(slugs)].slice(0, 40)));
}
