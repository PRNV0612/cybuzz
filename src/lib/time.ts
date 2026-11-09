export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export type DayBucket = "Today" | "Yesterday" | "This week" | "Earlier";

/** Editorial day grouping for the feed. Local calendar days. */
export function dayBucketOf(ts: number, now = Date.now()): DayBucket {
  if (dayKey(ts) === dayKey(now)) return "Today";
  if (dayKey(ts) === dayKey(now - 24 * 3600_000)) return "Yesterday";
  if (ts > now - 7 * 24 * 3600_000) return "This week";
  return "Earlier";
}

export const BUCKET_ORDER: DayBucket[] = ["Today", "Yesterday", "This week", "Earlier"];

/** CISA KEV remediation deadline → human status. */
export function deadlineStatus(
  dueDate: string | undefined,
  now = Date.now()
): { label: string; overdue: boolean; soon: boolean } | null {
  if (!dueDate) return null;
  const due = Date.parse(`${dueDate}T23:59:59`);
  if (Number.isNaN(due)) return null;
  const days = Math.ceil((due - now) / 86400_000);
  if (days < 0) return { label: `overdue by ${-days}d`, overdue: true, soon: false };
  if (days === 0) return { label: "due today", overdue: false, soon: true };
  if (days <= 7) return { label: `due in ${days}d`, overdue: false, soon: true };
  return { label: `due in ${days}d`, overdue: false, soon: false };
}
