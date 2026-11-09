import type { ItemType, Severity } from "@/lib/types";

export const TYPE_LABEL: Record<ItemType, string> = {
  cve: "CVE",
  attack: "Attack",
  breach: "Breach",
  ransomware: "Ransomware",
  news: "News",
  discussion: "Discussion",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`sev-badge sev-${severity} rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider`}
    >
      {severity}
    </span>
  );
}

export function TypeChip({ type }: { type: ItemType }) {
  return (
    <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--dim)]">
      {TYPE_LABEL[type]}
    </span>
  );
}

export function SevDot({ severity }: { severity?: Severity | null }) {
  return (
    <span
      className={`sev-dot inline-block h-2 w-2 shrink-0 rounded-full ${
        severity ? `sev-${severity}` : "text-[var(--border)]"
      }`}
    />
  );
}
