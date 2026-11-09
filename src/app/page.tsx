import Link from "next/link";
import { getFeed, getEntityNamesByItem, getFreshKev } from "@/lib/items";
import NewsCard from "@/components/NewsCard";
import FilterChips from "@/components/FilterChips";
import { BUCKET_ORDER, dayBucketOf, type DayBucket } from "@/lib/time";
import type { ItemType } from "@/lib/types";

export default function FeedPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const type = (searchParams.type as ItemType) ?? "all";
  const items = getFeed({ type, days: 7, limit: 40 });
  const entities = getEntityNamesByItem(items.map((i) => i.id));
  const freshKev = getFreshKev(7, 30);

  const [lead, ...rest] = items;
  const buckets = new Map<DayBucket, typeof items>();
  for (const it of rest) {
    const b = dayBucketOf(it.published_at);
    buckets.set(b, [...(buckets.get(b) ?? []), it]);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="font-display text-[34px] font-semibold tracking-tight">
          The Buzz
        </h1>
        <span className="text-[12px] text-[var(--dim)]">buzz-ranked · last 7 days</span>
      </div>

      <FilterChips active={type} />

      {freshKev.length > 0 && (
        <Link
          href="/actions"
          className="mt-4 flex items-center justify-between rounded-lg border border-[var(--accent)] bg-[var(--accent-dim)] px-4 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))]"
        >
          <span className="text-[14px] font-semibold text-[var(--accent)]">
            {freshKev.length} new federal patch deadline{freshKev.length === 1 ? "" : "s"} this
            week — confirmed exploitation
          </span>
          <span className="text-[13px] font-semibold text-[var(--accent)]">
            Action Center →
          </span>
        </Link>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--dim)]">
          Nothing here yet. Run <code className="font-mono text-[var(--accent)]">npm run ingest</code>{" "}
          or hit <span className="font-semibold text-[var(--text)]">Refresh</span> to pull the
          first batch from 15+ sources.
        </div>
      ) : (
        <div className="mt-2">
          <NewsCard item={lead} entities={entities.get(lead.id)} lead />

          {[...buckets.keys()]
            .filter((b) => BUCKET_ORDER.includes(b))
            .sort((a, b) => BUCKET_ORDER.indexOf(a) - BUCKET_ORDER.indexOf(b))
            .map((bucket) => (
              <section key={bucket}>
                <h2 className="section-label sticky top-0 z-10 bg-[var(--bg)] px-3 pb-1 pt-5">
                  {bucket}
                </h2>
                {buckets.get(bucket)!.map((it) => (
                  <NewsCard key={it.id} item={it} entities={entities.get(it.id)} />
                ))}
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
