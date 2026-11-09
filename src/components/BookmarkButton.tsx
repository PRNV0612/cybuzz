"use client";

import { useCallback, useEffect, useState } from "react";

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  source: string;
  type: string;
  severity?: string | null;
  cveId?: string | null;
  publishedAt: number;
}

const KEY = "cybuzz.bookmarks";

/**
 * Bookmarks without accounts (v1 call): localStorage, same shape the API
 * rows have, so moving server-side later is just swapping load/save.
 */
export function readBookmarks(): Bookmark[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Bookmark[];
  } catch {
    return [];
  }
}

export function useBookmarks() {
  const [ids, setIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    setIds(new Set(readBookmarks().map((b) => b.id)));
  }, []);

  const toggle = useCallback((b: Bookmark) => {
    const all = readBookmarks();
    const i = all.findIndex((x) => x.id === b.id);
    if (i >= 0) all.splice(i, 1);
    else all.unshift(b);
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, 200)));
    setIds(new Set(all.map((x) => x.id)));
  }, []);

  return { ids, toggle };
}

export default function BookmarkButton({ item }: { item: Bookmark }) {
  const { ids, toggle } = useBookmarks();
  const active = ids?.has(item.id) ?? false;
  return (
    <button
      aria-label={active ? "Remove bookmark" : "Bookmark"}
      title={active ? "Remove bookmark" : "Bookmark"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(item);
      }}
      className={`rounded p-1 text-base leading-none transition-colors ${
        active
          ? "text-[var(--accent)]"
          : "text-[var(--border)] hover:text-[var(--dim)]"
      }`}
    >
      {active ? "\u2605" : "\u2606"}
    </button>
  );
}
