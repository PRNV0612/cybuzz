"use client";

import { useEffect, useState } from "react";
import BookmarkButton, { readBookmarks, type Bookmark } from "@/components/BookmarkButton";
import { timeAgo } from "@/lib/time";

export default function BookmarksPage() {
  const [items, setItems] = useState<Bookmark[] | null>(null);

  useEffect(() => {
    setItems(readBookmarks());
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 flex items-baseline justify-between">
        <h1 className="font-display text-[34px] font-semibold tracking-tight">Bookmarks</h1>
        {items && (
          <button
            onClick={() => {
              localStorage.removeItem("cybuzz.bookmarks");
              setItems([]);
            }}
            className="text-xs text-[var(--dim)] hover:text-[var(--sev-critical)]"
          >
            Clear all
          </button>
        )}
      </div>

      {items === null ? (
        <p className="text-sm text-[var(--dim)]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--dim)]">
          Nothing saved yet. Click the star on any story to bookmark it.
        </p>
      ) : (
        <div>
          {items.map((b) => (
            <article
              key={b.id}
              className="news-row flex items-start gap-3 px-3 py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-x-2 text-[12px] text-[var(--dim)]">
                  <span className="font-semibold text-[var(--text)]">{b.source}</span>
                  <span aria-hidden>·</span>
                  <span>{timeAgo(b.publishedAt)}</span>
                  {b.severity && (
                    <span
                      className={`sev-badge sev-${b.severity} ml-1 rounded-sm px-1.5 py-px text-[10px] font-bold uppercase tracking-wider`}
                    >
                      {b.severity}
                    </span>
                  )}
                </div>
                <a
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-display text-[18px] font-medium leading-tight text-[var(--text)] hover:text-[var(--accent)]"
                >
                  {b.title}
                </a>
                {b.cveId && (
                  <div className="mt-1">
                    <code className="font-mono text-[11px] font-semibold sev-high">{b.cveId}</code>
                  </div>
                )}
              </div>
              <div className="pt-0.5">
                <BookmarkButton item={b} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
