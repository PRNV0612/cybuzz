import { NextResponse } from "next/server";
import { getStats } from "@/lib/items";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Operational probe: is ingestion actually still running?
 *
 * A GitHub Actions cron can look green while producing nothing — the schedule
 * is delayed, an adapter 404s, or the workflow simply stops firing when a repo
 * is inactive for 60 days. The failure mode is silent staleness, so this
 * endpoint answers the only question that matters and returns 503 when the
 * answer is bad, which makes it directly usable as an uptime-check URL.
 *
 * Threshold: the cron fires 3x/day, so anything past 20 hours without a
 * successful cycle means at least one missed schedule.
 */
const STALE_AFTER_MS = 20 * 3600_000;

export async function GET() {
  const stats = await getStats();
  const sources = await query<{ source_kind: string; n: number }>(
    "SELECT source_kind, COUNT(*) AS n FROM items GROUP BY source_kind ORDER BY n DESC"
  );

  const ageMs = stats.lastIngestAt ? Date.now() - stats.lastIngestAt : null;
  const stale = ageMs === null || ageMs > STALE_AFTER_MS;

  return NextResponse.json(
    {
      ok: !stale,
      lastIngestAt: stats.lastIngestAt,
      lastIngestAgoHours: ageMs === null ? null : Math.round((ageMs / 3600_000) * 10) / 10,
      totalItems: stats.total,
      kevAddedThisWeek: stats.kevNew,
      byType: stats.week,
      bySource: Object.fromEntries(sources.map((s) => [s.source_kind, s.n])),
    },
    { status: stale ? 503 : 200 }
  );
}
