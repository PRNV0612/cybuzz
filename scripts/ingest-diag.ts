import { runIngest } from "../src/lib/ingest";
import { closeDb } from "../src/lib/db";

// Diagnostic: time each adapter independently so one hanging source
// doesn't mask which one it is. Run: npx tsx scripts/ingest-diag.ts
async function timed(label: string, fn: () => Promise<unknown>) {
  const t0 = Date.now();
  try {
    const r = await fn();
    const ms = Date.now() - t0;
    // Adapters return { items, failures }; runIngest returns a report.
    const res = r as { items?: unknown[]; failures?: unknown[] };
    const count = Array.isArray(res?.items) ? res.items!.length : "n/a";
    const bad = Array.isArray(res?.failures) ? ` degraded=${res.failures!.length}` : "";
    console.log(`OK   ${label.padEnd(16)} ${ms}ms  count=${count}${bad}`);
  } catch (e) {
    const ms = Date.now() - t0;
    console.log(`FAIL ${label.padEnd(16)} ${ms}ms  ${String(e).slice(0, 120)}`);
  }
}

async function main() {
  console.log("=== adapter timing ===");
  const { ingestRss } = await import("../src/lib/ingest/rss");
  const { ingestNvd } = await import("../src/lib/ingest/nvd");
  const { ingestKev } = await import("../src/lib/ingest/kev");
  const { ingestRansomware } = await import("../src/lib/ingest/ransomware");
  const { ingestReddit } = await import("../src/lib/ingest/reddit");
  const { ingestHackerNews } = await import("../src/lib/ingest/hackernews");

  await Promise.all([
    timed("rss", () => ingestRss()),
    timed("nvd", () => ingestNvd(Date.now() - 24 * 3600_000)),
    timed("kev", () => ingestKev()),
    timed("ransomware", () => ingestRansomware()),
    timed("reddit", () => ingestReddit()),
    timed("hackernews", () => ingestHackerNews()),
  ]);

  console.log("=== full runIngest ===");
  await timed("runIngest", () => runIngest());
  await closeDb(); // otherwise the pool keeps the process alive
}

main().catch(async (e) => {
  console.error("diag crashed:", e);
  await closeDb().catch(() => {});
  process.exit(1);
});
