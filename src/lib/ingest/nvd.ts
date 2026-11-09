import type { RawItem } from "../types";
import { fetchJson } from "./normalize";
import { severityFromCvss } from "../entities";

/**
 * NVD API 2.0 — authoritative CVE stream.
 * Without an API key the limit is 5 requests / 30 s, so we make exactly one
 * request per ingest cycle covering the window since the last run.
 * Set NVD_API_KEY to raise this to 50 req/s and widen the window.
 *
 * API drift note (2026-11): the classic `startDate` param now 404s — NVD
 * replaced it with `pubStartDate`/`pubEndDate` (both required together,
 * format yyyy-MM-ddTHH:mm:ss.SSS UTC, no "Z" suffix).
 */
interface NvdResponse {
  vulnerabilities?: {
    cve: {
      id: string;
      published?: string;
      descriptions?: { value: string }[];
      metrics?: {
        cvssMetricV31?: { cvssData?: { baseScore?: number } }[];
        cvssMetricV30?: { cvssData?: { baseScore?: number } }[];
        cvssMetricV2?: { baseScore?: string }[];
      };
    };
  }[];
}

export async function ingestNvd(sinceMs: number): Promise<RawItem[]> {
  // NVD 2.0 wants exactly yyyy-MM-ddTHH:mm:ss.SSS (UTC, no "Z" suffix),
  // and pubStartDate requires a matching pubEndDate.
  const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 23);
  const params = new URLSearchParams({
    resultsPerPage: "500",
    pubStartDate: fmt(sinceMs),
    pubEndDate: fmt(Date.now() + 3600_000), // small clock-skew margin
  });
  const key = process.env.NVD_API_KEY;
  if (key) params.set("apiKey", key);
  const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?${params}`;

  const data = await fetchJson<NvdResponse>(url, undefined, 45_000);
  return (data.vulnerabilities ?? []).map((v) => {
    const cve = v.cve;
    const desc = cve.descriptions?.[0]?.value ?? cve.id;
    const score =
      cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ??
      cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore ??
      (cve.metrics?.cvssMetricV2?.[0]?.baseScore
        ? parseFloat(cve.metrics.cvssMetricV2[0].baseScore)
        : undefined);
    return {
      title: `${cve.id}: ${desc.split(/\s*—\s*|\.\s/)[0]}`,
      url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
      summary: desc,
      source: "NVD",
      sourceKind: "nvd",
      type: "cve",
      severity: severityFromCvss(score),
      cveId: cve.id,
      publishedAt: Date.parse(cve.published ?? "") || Date.now(),
      meta: { cvss: score },
    } satisfies RawItem;
  });
}
