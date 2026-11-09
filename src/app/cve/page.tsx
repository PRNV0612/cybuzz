import { getCves } from "@/lib/items";
import { SevDot } from "@/components/badges";

export default function CvePage() {
  const kev = getCves({ kevOnly: true, limit: 12 });
  const recent = getCves({ days: 10, limit: 60 });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-display text-[34px] font-semibold tracking-tight">CVEs</h1>

      {kev.length > 0 && (
        <div className="rounded-lg border border-[var(--sev-critical)] bg-[color-mix(in_srgb,var(--sev-critical)_10%,var(--surface))] p-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <span className="text-[var(--sev-critical)]">●</span>
            CISA KEV — Actively Exploited
          </h2>
          <div className="space-y-2">
            {kev.map((item) => (
              <div key={item.id} className="flex items-baseline gap-3 text-sm">
                <code className="shrink-0 font-mono text-xs text-[var(--dim)]">
                  {item.cve_id ?? "—"}
                </code>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 font-semibold text-[var(--text)] hover:text-[var(--accent)]"
                >
                  {item.title.replace(/^CVE-\d{4}-\d{4,7}\s*—\s*/, "")}
                </a>
                <span className="shrink-0 text-xs text-[var(--dim)]">{item.source}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 font-display text-lg font-semibold">Recent CVEs</h2>
        <div className="space-y-1">
          {recent.map((item) => (
            <div
              key={item.id}
              className="flex items-baseline gap-3 border-b border-[var(--rule)] py-2 text-sm"
            >
              <SevDot severity={item.severity} />
              <code className="shrink-0 font-mono text-xs text-[var(--dim)]">
                {item.cve_id ?? "—"}
              </code>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 hover:text-[var(--accent)]"
              >
                {item.title.replace(/^CVE-\d{4}-\d{4,7}:\s*/, "")}
              </a>
              <span className="shrink-0 text-xs text-[var(--dim)]">{item.source}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
