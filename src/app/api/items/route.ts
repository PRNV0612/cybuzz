import { NextResponse } from "next/server";
import {
  getFeed, getCves, getAttacks, searchItems, getStats,
  getEntity, getEntityOptions, getItemsByEntities,
} from "@/lib/items";

/**
 * GET /api/items?type=&days=&limit=&offset=&q=&entity=&entities=a,b&
 *      view=cves|attacks|stats|entities
 * The pages themselves read the DB directly; this is the JSON surface for
 * the client-side watchlist, the refresh widget and any future consumer.
 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const num = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined);

  if (p.get("view") === "stats") return NextResponse.json(getStats());
  if (p.get("view") === "entities")
    return NextResponse.json(getEntityOptions(num("limit") ?? 120));

  const entity = p.get("entity");
  if (entity) {
    const r = getEntity(entity);
    return r ? NextResponse.json(r) : NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const entities = p.get("entities");
  if (entities) {
    const slugs = entities.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
    return NextResponse.json(getItemsByEntities(slugs, num("days") ?? 14, num("limit")));
  }

  const q = p.get("q")?.trim();
  if (q) return NextResponse.json(searchItems(q, num("limit") ?? 40));

  const view = p.get("view");
  if (view === "cves")
    return NextResponse.json(
      getCves({ kevOnly: p.get("kev") === "1", days: num("days"), limit: num("limit") })
    );
  if (view === "attacks") return NextResponse.json(getAttacks({ days: num("days"), limit: num("limit") }));

  return NextResponse.json(
    getFeed({
      type: (p.get("type") as never) ?? "all",
      days: num("days"),
      limit: num("limit"),
      offset: num("offset"),
    })
  );
}
