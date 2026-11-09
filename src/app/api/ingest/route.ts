import { NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";

/**
 * POST /api/ingest — triggers one cycle. Local v1: hit it from the UI
 * refresh button or curl; when deployed this goes behind a cron.
 */
export async function POST() {
  try {
    const report = await runIngest();
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
