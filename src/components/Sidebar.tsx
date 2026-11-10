"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { getStats } from "@/lib/items";
import { timeAgo } from "@/lib/time";

type Stats = Awaited<ReturnType<typeof getStats>>;

const NAV = [
  { href: "/", label: "The Buzz", key: "all" },
  { href: "/actions", label: "Action Center", key: "kev" },
  { href: "/mystack", label: "My Stack", key: "" },
  { href: "/cve", label: "CVEs", key: "cve" },
  { href: "/attacks", label: "Attacks & Breaches", key: "attack" },
  { href: "/companies", label: "Companies", key: "" },
  { href: "/bookmarks", label: "Bookmarks", key: "" },
] as const;

export default function Sidebar({ stats }: { stats: Stats }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[var(--rule)] bg-[var(--bg)] px-5 py-6 md:flex">
      <Link href="/" className="mb-8 font-display text-[26px] font-semibold tracking-tight">
        <span className="text-[var(--accent)]">Cy</span>Buzz
      </Link>

      <nav className="flex flex-col">
        {NAV.map((n) => {
          const active = pathname === n.href;
          const count =
            n.key === "kev" ? stats.kevNew : n.key && n.key !== "all" ? stats.week[n.key as never] : undefined;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-baseline justify-between border-b border-[var(--rule)] py-2.5 text-[15px] transition-colors ${
                active
                  ? "font-semibold text-[var(--accent)]"
                  : "text-[var(--text)] hover:text-[var(--accent)]"
              }`}
            >
              <span>{n.label}</span>
              {count != null && count > 0 && (
                <span className="text-[12px] tabular-nums text-[var(--dim)]">{count}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 text-[12px] leading-relaxed text-[var(--dim)]">
        <div>{stats.total.toLocaleString()} stories tracked</div>
        <div>
          {stats.lastIngestAt
            ? `Updated ${timeAgo(stats.lastIngestAt)}`
            : "No ingest yet — hit Refresh"}
        </div>
      </div>
    </aside>
  );
}
