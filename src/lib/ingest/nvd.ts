import type { AdapterResult, RawItem } from "../types";
import { fetchJson } from "./normalize";
import { severityFromCvss } from "../entities";

/**
 * NVD API 2.0 — authoritative CVE stream.
 *
 * Rate limits: 5 requests / 30 s without a key, 50 req/s with one. So pages
 * are spaced by the limit we are actually under, and the page size is large
 * (the API accepts up to 2000) to keep the request count down.
 *
 * API drift note (2026-11): the classic `startDate` param now 404s — NVD
 * replaced it with `pubStartDate`/`pubEndDate` (both required together,
 * format yyyy-MM-ddTHH:mm:ss.SSS UTC, no "Z" suffix).
 *
 * Pagination note: a single request returns at most `resultsPerPage` rows and
 * reports the real size in `totalResults`. The first-run 10-day backfill is
 * routinely 10-20k CVEs, so one page silently discarded most of the CVE
 * history. Now we walk the pages and report it as degraded if we hit the cap.
 */
interface NvdResponse {
  resultsPerPage?: number;
  startIndex?: number;
  totalResults?: number;
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

const PAGE_SIZE = 2000;
const MAX_ROWS = 24_000; // ~12 pages; bounds worst-case runtime inside the Action
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function ingestNvd(sinceMs: number): Promise<AdapterResult> {
  // NVD 2.0 wants exactly yyyy-MM-ddTHH:mm:ss.SSS (UTC, no "Z" suffix),
  // and pubStartDate requires a matching pubEndDate.
  const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 23);
  const key = process.env.NVD_API_KEY;
  const gap = key ? 250 : 6_500; // stay inside 50 req/s or 5 req/30 s
  const raw: NonNullable<NvdResponse["vulnerabilities"]> = [];
  const failures: AdapterResult["failures"] = [];

  let start = 0;
  let total = Infinity;

  while (raw.length < Math.min(total, MAX_ROWS)) {
    const params = new URLSearchParams({
      resultsPerPage: String(PAGE_SIZE),
      startIndex: String(start),
      pubStartDate: fmt(sinceMs),
      pubEndDate: fmt(Date.now() + 3600_000), // small clock-skew margin
    });
    if (key) params.set("apiKey", key);
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?${params}`;

    const data = await fetchJson<NvdResponse>(url, undefined, 60_000);
    total = data.totalResults ?? raw.length;
    const page = data.vulnerabilities ?? [];
    if (page.length === 0) break; // defensive: never spin on an empty page
    raw.push(...page);
    start += page.length;
    if (raw.length < Math.min(total, MAX_ROWS)) await sleep(gap);
  }

  if (total > MAX_ROWS) {
    failures.push({
      feed: "NVD",
      error: `window contains ${total} CVEs; collected ${raw.length} (cap ${MAX_ROWS}). Set NVD_API_KEY or narrow the window.`,
    });
  }

  const items = raw.map((v): RawItem => {
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
    };
  });

  return { items, failures };
}
