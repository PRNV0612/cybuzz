import { runIngest } from "../src/lib/ingest";
import { closeDb } from "../src/lib/db";

/**
 * The pg pool holds open sockets, which keep Node's event loop alive. Without
 * closeDb() this script would sit idle after printing its report until the
 * process was killed — in CI that means the Action runs to its timeout and
 * reports failure even though the ingest actually succeeded.
 */
runIngest()
  .then(async (r) => {
    console.log(
      `[cybuzz] fetched ${r.fetched} · inserted ${r.inserted} · updated ${r.updated} · ` +
        `entity links ${r.linked} · clusters ${r.clustered}`
    );
    // Partial source loss is a warning, not a failed run: Reddit rate-limits
    // and outlets publish quiet days. A whole adapter throwing is different —
    // that source contributed nothing, so the run is not trustworthy.
    if (r.degraded.length) {
      console.warn(`[cybuzz] ${r.degraded.length} feed(s) degraded:`);
      for (const e of r.degraded) console.warn(`  ~ ${e.source}: ${e.error}`);
    }
    if (r.errors.length) {
      console.error(`[cybuzz] ${r.errors.length} source(s) failed completely:`);
      for (const e of r.errors) console.error(`  - ${e.source}: ${e.error}`);
      process.exitCode = 1;
    }
    await closeDb();
  })
  .catch(async (e) => {
    console.error("[cybuzz] ingest crashed:", e);
    process.exitCode = 1;
    await closeDb().catch(() => {});
    process.exit(1);
  });
