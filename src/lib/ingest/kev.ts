import type { RawItem } from "../types";
import { fetchJson } from "./normalize";

/**
 * CISA Known Exploited Vulnerabilities — the CVEs that are actually being
 * used in the wild, each with a federal remediation deadline. Highest-signal
 * list in security; KEV entries outrank plain NVD rows in the UI (the upsert
 * merges them onto the same URL).
 *
 * Catalog is NOT sorted by dateAdded — the Action Center sorts in the query.
 */
interface KevEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName?: string;
  dateAdded: string;
  dueDate?: string;
  requiredAction?: string;
  forensicTriage?: string;
  shortDescription?: string;
  knownRansomwareCampaignUse: string;
  cwes?: string[];
  notes?: string;
}
interface KevCatalog {
  vulnerabilities: KevEntry[];
}

export async function ingestKev(): Promise<RawItem[]> {
  const data = await fetchJson<KevCatalog>(
    "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
  );
  return (data.vulnerabilities ?? []).map((v): RawItem => ({
    title: `${v.cveID} — ${v.vulnerabilityName || `${v.vendorProject} ${v.product}`}`,
    url: `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
    summary: v.shortDescription ?? `Actively exploited: ${v.vendorProject} ${v.product}.`,
    source: "CISA KEV",
    sourceKind: "kev",
    type: "cve",
    severity: "critical", // KEV inclusion means confirmed exploitation
    cveId: v.cveID,
    publishedAt: Date.parse(v.dateAdded) || Date.now(),
    entityNames: [v.vendorProject, v.product].filter(Boolean),
    meta: {
      ransomwareUse: v.knownRansomwareCampaignUse,
      requiredAction: v.requiredAction,
      dueDate: v.dueDate,
      forensicTriage: v.forensicTriage,
      cwes: v.cwes,
      vendor: v.vendorProject,
      product: v.product,
      notes: v.notes,
    },
  }));
}
