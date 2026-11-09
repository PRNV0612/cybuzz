import { getTicker } from "@/lib/items";
import { timeAgo } from "@/lib/time";

/**
 * Breaking strip: the single most recent critical/high story, stated plainly.
 * Replaced the scrolling marquee — moving text failed the "easy to read" bar.
 */
export default function Ticker() {
  const items = getTicker(6);
  if (!items.length) return null;
  const lead = items[0];

  return (
    <div className="border-b border-[var(--rule)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-4xl items-baseline gap-3 px-4 py-2.5">
        <span className="section-label shrink-0 text-[var(--sev-critical)]">
          Breaking
        </span>
        <a
          href={lead.url}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text)] hover:text-[var(--accent)]"
        >
          {lead.title}
        </a>
        <span className="shrink-0 text-[12px] text-[var(--dim)]">
          {timeAgo(lead.published_at)}
          {items.length > 1 && ` · ${items.length - 1} more`}
        </span>
      </div>
    </div>
  );
}
