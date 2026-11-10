import { getAttacks } from "@/lib/items";
import NewsCard from "@/components/NewsCard";

export default async function AttacksPage() {
  const items = await getAttacks({ days: 14, limit: 60 });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 font-display text-[34px] font-semibold tracking-tight">
        Attacks &amp; Breaches
      </h1>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--dim)]">
          No incidents in the last 14 days. Run <code className="font-mono">npm run ingest</code> to
          populate.
        </div>
      ) : (
        <div>
          {items.map((it) => (
            <NewsCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}
