import { notFound } from "next/navigation";
import { getEntity, getEntityNamesByItem } from "@/lib/items";
import NewsCard from "@/components/NewsCard";
import { TYPE_LABEL } from "@/components/badges";
import type { ItemType } from "@/lib/types";

export default function EntityDetail({ params }: { params: { slug: string } }) {
  const data = getEntity(params.slug);
  if (!data) notFound();

  const { entity, items } = data;
  const byType = new Map<ItemType, number>();
  for (const i of items) byType.set(i.type, (byType.get(i.type) ?? 0) + 1);
  const entities = getEntityNamesByItem(items.map((i) => i.id));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-[34px] font-semibold tracking-tight">{entity.name}</h1>
      <div className="mb-4 mt-2 flex flex-wrap gap-x-4 text-[13px] text-[var(--dim)]">
        {[...byType].map(([t, n]) => (
          <span key={t}>
            {n} <span className="text-[var(--text)]">{TYPE_LABEL[t]}</span>
          </span>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--dim)]">
          No coverage yet. Run <code className="font-mono">npm run ingest</code> or click{" "}
          <span className="font-semibold">Refresh</span> to populate.
        </p>
      ) : (
        <div>
          {items.map((it) => (
            <NewsCard key={it.id} item={it} entities={entities.get(it.id) ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}
