"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefreshButton() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const router = useRouter();

  async function refresh() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/ingest", { method: "POST" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const r = await res.json();
      setNote(`+${r.inserted} new, ${r.updated} upgraded${r.errors?.length ? ` · ${r.errors.length} source(s) failed` : ""}`);
      router.refresh();
    } catch {
      setNote("refresh failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {note && <span className="hidden text-xs text-[var(--dim)] lg:inline">{note}</span>}
      <button
        onClick={refresh}
        disabled={busy}
        className="rounded-full border border-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-dim)] disabled:opacity-50"
      >
        {busy ? "Fetching…" : "Refresh"}
      </button>
    </div>
  );
}
