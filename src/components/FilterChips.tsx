"use client";

import { useRouter } from "next/navigation";
import type { ItemType } from "@/lib/types";

const CHIPS: { label: string; value: ItemType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "CVEs", value: "cve" },
  { label: "Attacks", value: "attack" },
  { label: "Breaches", value: "breach" },
  { label: "Ransomware", value: "ransomware" },
  { label: "Discussions", value: "discussion" },
];

/** Editorial underline tabs instead of pills. */
export default function FilterChips({ active }: { active: string }) {
  const router = useRouter();
  return (
    <div className="flex gap-5 border-b border-[var(--rule)]">
      {CHIPS.map((c) => (
        <button
          key={c.value}
          onClick={() => router.push(c.value === "all" ? "/" : `/?type=${c.value}`)}
          className={`-mb-px border-b-2 pb-2 text-[13px] font-semibold tracking-wide transition-colors ${
            active === c.value
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--dim)] hover:text-[var(--text)]"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
