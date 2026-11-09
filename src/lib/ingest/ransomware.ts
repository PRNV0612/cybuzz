import type { RawItem } from "../types";
import { fetchJson } from "./normalize";

/**
 * ransomware.live v2 — public tracker of ransomware-crew leak sites.
 * The "affected companies" backbone: every incident names a real victim.
 *
 * API drift note (2026-11): v1 (`/recentincidents`) is deprecated and now
 * 302-redirects to docs; v2 is free, no auth, rate-limited 1 req/min per
 * endpoint. Route naming is flat (`/v2/recentvictims`, not REST-style).
 * At 1 req/min we comfortably fetch once per ingest cycle.
 */
interface Victim {
  victim?: string;
  group?: string;
  url?: string; // victim's public site
  claim_url?: string; // leak-site listing (onion)
  domain?: string;
  attackdate?: string;
  discovered?: string;
  activity?: string; // sector
  country?: string;
  data_size?: string | null;
  ransom?: string | null;
  description?: string;
}

export async function ingestRansomware(): Promise<RawItem[]> {
  const victims = await fetchJson<Victim[]>(
    "https://api.ransomware.live/v2/recentvictims"
  );
  // ~10% of listings are redacted placeholders for victims the site hasn't
  // verified/published: "Company #137", "… (Not Found)", "page-<hash>".
  // They pollute feeds and entities, so drop them at the adapter boundary.
  const isPlaceholder = (v?: string) =>
    !v ||
    /^company #\d+$/i.test(v) ||
    /^page-[a-z0-9]+$/i.test(v) ||
    /not found/i.test(v);
  return victims
    .filter((v) => !isPlaceholder(v.victim) && (v.url || v.claim_url))
    .map((v): RawItem => ({
      title: `${v.group ?? "Unknown actor"} ransomware attack on ${v.victim}${
        v.activity ? ` (${v.activity})` : ""
      }`,
      url: v.url || v.claim_url!,
      summary: [
        v.description?.slice(0, 500),
        v.data_size ? `Data claimed: ${v.data_size}` : null,
        v.ransom ? `Ransom: ${v.ransom}` : null,
        v.country ? `Country: ${v.country}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      source: "ransomware.live",
      sourceKind: "ransomware",
      type: "ransomware",
      severity: "high",
      publishedAt:
        Date.parse(v.attackdate ?? v.discovered ?? "") || Date.now(),
      entityNames: [v.victim!, ...(v.group ? [v.group] : [])],
      meta: {
        actor: v.group,
        sector: v.activity,
        country: v.country,
        data_size: v.data_size,
        ransom: v.ransom,
        claim_url: v.claim_url,
      },
    }));
}
