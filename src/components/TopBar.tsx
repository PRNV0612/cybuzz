import RefreshButton from "./RefreshButton";

export default function TopBar() {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--rule)] bg-[var(--bg)] px-4 py-3">
      <form action="/search" method="get" className="relative flex-1 max-w-md">
        <input
          type="text"
          name="q"
          placeholder="Search CVEs, companies, headlines…"
          className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-sm text-[var(--text)] placeholder-[var(--dim)] outline-none focus:border-[var(--accent)]"
        />
      </form>
      <RefreshButton />
    </div>
  );
}
