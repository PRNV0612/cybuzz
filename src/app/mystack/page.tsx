"use client";

import { useEffect, useMemo, useState } from "react";
import NewsCard from "@/components/NewsCard";
import { readWatchlist, saveWatchlist } from "@/lib/watchlist";
import type { FeedItem } from "@/lib/items";

interface EntityOption {
  slug: string;
  name: string;
  kind: string;
  n: number;
}

export default function MyStackPage() {
  const [slugs, setSlugs] = useState<string[] | null>(null);
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setSlugs(readWatchlist());
    fetch("/api/items?view=entities&limit=120")
      .then((r) => r.json())
      .then(setOptions)
      .catch(() => setOptions([]));
  }, []);

  const query = useMemo(() => (slugs ?? []).join(","), [slugs]);
  useEffect(() => {
    if (slugs === null) return;
    if (!slugs.length) {
      setItems([]);
      return;
    }
    setBusy(true);
    fetch(`/api/items?entities=${encodeURIComponent(query)}&days=14&limit=60`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setBusy(false));
  }, [query, slugs === null]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(slug: string) {
    setSlugs((cur) => {
      const next = cur?.includes(slug) ? cur.filter((s) => s !== slug) : [...(cur ?? []), slug];
      saveWatchlist(next);
      return next;
    });
  }

  const nameOf = (slug: string) => options.find((o) => o.slug === slug)?.name ?? slug;
  const shown = filter
    ? options.filter((o) => o.name.toLowerCase().includes(filter.toLowerCase())).slice(0, 40)
    : options.slice(0, 24);

  if (slugs === null) return <p className="text-sm text-[var(--dim)]">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-[34px] font-semibold tracking-tight">My Stack</h1>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Pick the vendors and products you actually run. Every story, CVE and incident that
          names them shows up here — a personal alert feed, no account needed.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="section-label">Watching</span>
          {slugs.length === 0 ? (
            <span className="text-[13px] text-[var(--dim)]">nothing yet — pick below</span>
          ) : (
            slugs.map((s) => (
              <button
                key={s}
                onClick={() => toggle(s)}
                className="rounded-full bg-[var(--accent-dim)] px-3 py-1 text-[13px] font-semibold text-[var(--accent)]"
                title="Remove"
              >
                {nameOf(s)} ×
              </button>
            ))
          )}
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter suggestions…"
          className="mb-3 w-full max-w-xs rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
        />
        <div className="flex flex-wrap gap-2">
          {shown.map((o) => {
            const on = slugs.includes(o.slug);
            return (
              <button
                key={o.slug}
                onClick={() => toggle(o.slug)}
                className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${
                  on
                    ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)] font-semibold"
                    : "border-[var(--border)] text-[var(--dim)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                }`}
              >
                {o.name} <span className="tabular-nums opacity-60">{o.n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {slugs.length > 0 && (
        <div>
          <h2 className="section-label mb-1">Last 14 days · {items?.length ?? 0} items</h2>
          {busy ? (
            <p className="py-6 text-sm text-[var(--dim)]">Scanning…</p>
          ) : items && items.length > 0 ? (
            <div>
              {items.map((it) => (
                <NewsCard key={it.id} item={it} />
              ))}
            </div>
          ) : (
            <p className="py-6 text-sm text-[var(--dim)]">
              Nothing in the news mentioning your stack right now — genuinely good news.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
