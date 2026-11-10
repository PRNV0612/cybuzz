import Link from "next/link";
import { getTopEntities } from "@/lib/items";

export default async function CompaniesPage() {
  const entities = await getTopEntities(30);
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-[34px] font-semibold tracking-tight">
        Companies &amp; Products
      </h1>
      <p className="mb-4 mt-1 text-sm text-[var(--dim)]">
        Most-mentioned in the last 30 days — from headlines, CVE vendors and ransomware victim
        lists.
      </p>
      {entities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--dim)]">
          Run <code className="font-mono">npm run ingest</code> first.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {entities.map((e) => (
            <Link
              key={e.slug}
              href={`/companies/${e.slug}`}
              className="flex items-baseline justify-between border-b border-[var(--rule)] px-2 py-2.5 text-[15px] hover:text-[var(--accent)]"
            >
              <span className="min-w-0 truncate font-medium">{e.name}</span>
              <span className="ml-3 shrink-0 text-[12px] tabular-nums text-[var(--dim)]">
                {e.n}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
