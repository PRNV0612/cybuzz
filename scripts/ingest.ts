import { runIngest } from "../src/lib/ingest";

runIngest()
  .then((r) => {
    console.log(
      `[cybuzz] fetched ${r.fetched} · inserted ${r.inserted} · updated ${r.updated} · clusters ${r.clustered}`
    );
    if (r.errors.length) {
      console.error(`[cybuzz] ${r.errors.length} source(s) failed:`);
      for (const e of r.errors) console.error(`  - ${e.source}: ${e.error}`);
      process.exitCode = 1;
    }
  })
  .catch((e) => {
    console.error("[cybuzz] ingest crashed:", e);
    process.exit(1);
  });
