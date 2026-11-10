import { getFreshKev, getTrendingExploited, getRansomwareTrends, getEntityNamesByItem } from "@/lib/items";
import NewsCard from "@/components/NewsCard";
import { deadlineStatus } from "@/lib/time";

interface KevMeta {
  requiredAction?: string;
  dueDate?: string;
  ransomwareUse?: string;
  vendor?: string;
  product?: string;
}

export default async function ActionsPage() {
  const kev = await getFreshKev(14, 25);
  const trending = await getTrendingExploited(7, 12);
  const trends = await getRansomwareTrends(14);
  const entities = await getEntityNamesByItem(trending.map((i) => i.id));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-[34px] font-semibold tracking-tight">Action Center</h1>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Not news — things to do. Federal deadlines, confirmed exploitation, and who is
          attacking hardest right now.
        </p>
      </div>

      {/* 1 — Patch now */}
      <section>
        <h2 className="section-label mb-2 text-[var(--sev-critical)]">
          Patch now — new CISA KEV entries (14 days)
        </h2>
        {kev.length === 0 ? (
          <p className="py-6 text-sm text-[var(--dim)]">
            No new federal exploitation advisories in the last 14 days.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            {kev.map((item, i) => {
              const m = (item.meta ? JSON.parse(item.meta) : {}) as KevMeta;
              const dl = deadlineStatus(m.dueDate);
              return (
                <div
                  key={item.id}
                  className={`px-4 py-3 ${i > 0 ? "border-t border-[var(--rule)]" : ""}`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <code className="font-mono text-[12px] font-semibold sev-critical">
                      {item.cve_id}
                    </code>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate font-medium text-[15px] hover:text-[var(--accent)]"
                    >
                      {m.vendor ? `${m.vendor} ${m.product}` : item.title}
                    </a>
                    {dl && (
                      <span
                        className={`rounded-sm px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                          dl.overdue
                            ? "sev-badge sev-critical"
                            : dl.soon
                              ? "sev-badge sev-high"
                              : "text-[var(--dim)] border border-[var(--border)]"
                        }`}
                      >
                        {dl.label}
                      </span>
                    )}
                    {m.ransomwareUse === "Known" && (
                      <span className="text-[11px] font-bold uppercase tracking-wide sev-critical">
                        ransomware campaign
                      </span>
                    )}
                  </div>
                  {m.requiredAction && (
                    <p className="mt-1 text-[13px] text-[var(--dim)]">
                      <span className="font-semibold text-[var(--text)]">Required:</span>{" "}
                      {m.requiredAction}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2 — Trending exploitation */}
      <section>
        <h2 className="section-label mb-1">Trending &amp; exploited this week</h2>
        {trending.length === 0 ? (
          <p className="py-4 text-sm text-[var(--dim)]">Nothing clustered this week yet.</p>
        ) : (
          <div>
            {trending.map((it) => (
              <NewsCard key={it.id} item={it} entities={entities.get(it.id)} />
            ))}
          </div>
        )}
      </section>

      {/* 3 — Ransomware hot streak */}
      <section>
        <h2 className="section-label mb-3">Ransomware hot streak (14 days)</h2>
        <p className="mb-3 text-sm text-[var(--dim)]">
          <span className="font-semibold text-[var(--text)]">{trends.incidents}</span> victims
          claimed on leak sites in the last two weeks.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-[var(--text)]">Most active groups</h3>
            {trends.actors.map((a) => (
              <div key={a.name} className="flex items-baseline justify-between border-b border-[var(--rule)] py-1.5 text-[14px]">
                <span>{a.name}</span>
                <span className="text-[12px] tabular-nums text-[var(--dim)]">{a.count} hits</span>
              </div>
            ))}
          </div>
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-[var(--text)]">Targeted sectors</h3>
            {trends.sectors.map((s) => (
              <div key={s.name} className="flex items-baseline justify-between border-b border-[var(--rule)] py-1.5 text-[14px]">
                <span className="min-w-0 truncate">{s.name}</span>
                <span className="text-[12px] tabular-nums text-[var(--dim)]">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
