import { searchItems } from "@/lib/items";
import { getEntityNamesByItem } from "@/lib/items";
import NewsCard from "@/components/NewsCard";

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim() ?? "";
  const items = q ? searchItems(q, 40) : [];
  const entities = getEntityNamesByItem(items.map((i) => i.id));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 font-display text-[34px] font-semibold tracking-tight">
        Search
        {q && <span className="text-[var(--dim)]"> — “{q}”</span>}
      </h1>
      {q ? (
        items.length === 0 ? (
          <p className="text-sm text-[var(--dim)]">
            No results for <span className="font-semibold text-[var(--text)]">{q}</span>. Try a CVE
            number, a company name, or a keyword like &quot;ransomware&quot;.
          </p>
        ) : (
          <div>
            {items.map((it) => (
              <NewsCard key={it.id} item={it} entities={entities.get(it.id) ?? []} />
            ))}
          </div>
        )
      ) : (
        <p className="text-sm text-[var(--dim)]">
          Type a query in the search bar above — CVE numbers, company names, or keywords.
        </p>
      )}
    </div>
  );
}
