import Link from "next/link";
import BookmarkButton from "./BookmarkButton";
import { timeAgo } from "@/lib/time";
import { slugify } from "@/lib/entities";
import type { FeedItem } from "@/lib/items";

export default function NewsCard({
  item,
  entities = [],
  lead = false,
}: {
  item: FeedItem;
  entities?: string[];
  lead?: boolean;
}) {
  const edge = item.severity ? `sev-edge-${item.severity}` : "";
  // Severity is the left edge for everything; the explicit badge only shows
  // for critical/high, where it actually changes reader behavior.
  const showBadge = item.severity === "critical" || item.severity === "high";

  return (
    <article className={`news-row flex items-start gap-3 px-3 py-4 ${edge}`}>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 text-[12px] text-[var(--dim)]">
          <span className="font-semibold text-[var(--text)]">{item.source}</span>
          <span aria-hidden>·</span>
          <span>{timeAgo(item.published_at)}</span>
          {item.mentions > 1 && (
            <>
              <span aria-hidden>·</span>
              <span className="font-semibold text-[var(--accent)]">
                {item.mentions} sources
              </span>
            </>
          )}
          {item.engagement > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="font-semibold">{item.engagement} pts</span>
            </>
          )}
          {showBadge && (
            <span
              className={`sev-badge sev-${item.severity} ml-1 rounded-sm px-1.5 py-px text-[10px] font-bold uppercase tracking-wider`}
            >
              {item.severity}
            </span>
          )}
        </div>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`block font-display font-medium leading-tight text-[var(--text)] hover:text-[var(--accent)] ${
            lead ? "text-[30px]" : "text-[18px]"
          }`}
        >
          {item.title}
        </a>

        {item.summary && (
          <p
            className={`mt-1.5 text-[14px] leading-relaxed text-[var(--dim)] ${
              lead ? "clamp-3" : "clamp-2"
            }`}
          >
            {item.summary}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
          {item.cve_id && (
            <code className="font-mono text-[11px] font-semibold sev-high">
              {item.cve_id}
            </code>
          )}
          {entities.slice(0, 4).map((name) => (
            <Link
              key={name}
              href={`/companies/${slugify(name)}`}
              className="text-[var(--dim)] underline decoration-[var(--rule)] underline-offset-2 hover:text-[var(--accent)] hover:decoration-[var(--accent)]"
            >
              {name}
            </Link>
          ))}
        </div>
      </div>

      <div className="pt-0.5">
        <BookmarkButton
          item={{
            id: item.id,
            title: item.title,
            url: item.url,
            source: item.source,
            type: item.type,
            severity: item.severity,
            cveId: item.cve_id,
            publishedAt: item.published_at,
          }}
        />
      </div>
    </article>
  );
}
