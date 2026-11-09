import type { ItemType, Severity } from "./types";

/**
 * Curated entity dictionary for "affected companies/apps" tagging (v1).
 * Deliberately dumb and deterministic: word-boundary matching over
 * title+summary. An LLM extraction pass is the planned v2 upgrade — this
 * dictionary seeds it and covers 90% of headlines meanwhile.
 *
 * names must be lowercase; aliases optional. Longest match wins per entity.
 */
export const ENTITY_DICT: { name: string; kind: "company" | "product"; aliases?: string[] }[] = [
  // Hyperscalers / big tech
  { name: "Google", kind: "company", aliases: ["Alphabet", "Gmail", "Chrome"] },
  { name: "Microsoft", kind: "company", aliases: ["Azure", "Windows", "Office 365", "Outlook", "Teams", "Bing"] },
  { name: "Apple", kind: "company", aliases: ["iCloud", "iPhone", "macOS", "Safari"] },
  { name: "Amazon", kind: "company", aliases: ["AWS", "Alexa"] },
  { name: "Meta", kind: "company", aliases: ["Facebook", "Instagram", "WhatsApp"] },
  { name: "Netflix", kind: "company" },
  { name: "Tesla", kind: "company" },
  { name: "IBM", kind: "company" },
  { name: "Oracle", kind: "company", aliases: ["Java", "Solaris"] },
  { name: "Samsung", kind: "company", aliases: ["Tizen"] },
  { name: "Intel", kind: "company" },
  { name: "AMD", kind: "company" },
  { name: "Nvidia", kind: "company" },
  { name: "Qualcomm", kind: "company" },
  // Security & infrastructure vendors
  { name: "Cisco", kind: "company", aliases: ["Umbrella", "Snort"] },
  { name: "Fortinet", kind: "company", aliases: ["FortiGate", "FortiOS"] },
  { name: "Palo Alto Networks", kind: "company", aliases: ["Cortex XSOAR"] },
  { name: "CrowdStrike", kind: "company" },
  { name: "Zscaler", kind: "company" },
  { name: "Okta", kind: "company" },
  { name: "VMware", kind: "company", aliases: ["ESXi", "vSphere"] },
  { name: "Broadcom", kind: "company" },
  { name: "Sophos", kind: "company" },
  { name: "Kaspersky", kind: "company" },
  { name: "ESET", kind: "company" },
  { name: "Mandiant", kind: "company" },
  { name: "Recorded Future", kind: "company" },
  // Identity / SaaS / dev tools
  { name: "LastPass", kind: "company" },
  { name: "1Password", kind: "company" },
  { name: "NordVPN", kind: "company" },
  { name: "Moveit", kind: "company", aliases: ["Cleopatra"] },
  { name: "3CX", kind: "company" },
  { name: "Log4j", kind: "product" },
  { name: "GitHub", kind: "company" },
  { name: "GitLab", kind: "company" },
  { name: "Atlassian", kind: "company", aliases: ["Jira", "Confluence"] },
  { name: "Slack", kind: "company" },
  { name: "Zoom", kind: "company" },
  { name: "Salesforce", kind: "company" },
  { name: "ServiceNow", kind: "company" },
  { name: "Workday", kind: "company" },
  { name: "Shopify", kind: "company" },
  { name: "Wordpress", kind: "product", aliases: ["WooCommerce"] },
  { name: "Cloudflare", kind: "company" },
  { name: "Akamai", kind: "company" },
  { name: "Fastly", kind: "company" },
  { name: "Xmrig", kind: "product" },
  // Telecom / finance / healthcare / retail breach regulars
  { name: "T-Mobile", kind: "company" },
  { name: "AT&T", kind: "company" },
  { name: "Verizon", kind: "company" },
  { name: "Vodafone", kind: "company" },
  { name: "JPMorgan", kind: "company", aliases: ["Chase"] },
  { name: "Bank of America", kind: "company" },
  { name: "Wells Fargo", kind: "company" },
  { name: "PayPal", kind: "company" },
  { name: "Stripe", kind: "company" },
  { name: "Coinbase", kind: "company" },
  { name: "Binance", kind: "company" },
  { name: "Bybit", kind: "company" },
  { name: "Change Healthcare", kind: "company" },
  { name: "UnitedHealth", kind: "company", aliases: ["Aetna"] },
  { name: "Cencora", kind: "company", aliases: ["AmerisourceBergen"] },
  { name: "Scout24", kind: "company" },
  { name: "MGM Resorts", kind: "company", aliases: ["Caesars Entertainment"] },
  { name: "Marriott", kind: "company" },
  { name: "Hilton", kind: "company" },
  { name: "Target", kind: "company" },
  { name: "Home Depot", kind: "company" },
  { name: "Ticketmaster", kind: "company", aliases: ["Live Nation"] },
  { name: "Adidas", kind: "company" },
  { name: "Nike", kind: "company" },
  { name: "Sony", kind: "company", aliases: ["PlayStation"] },
  { name: "EA", kind: "company", aliases: ["Electronic Arts"] },
  { name: "Ubisoft", kind: "company" },
  { name: "Steam", kind: "product", aliases: ["Valve"] },
  // Governments / agencies
  { name: "CISA", kind: "company" },
  { name: "FBI", kind: "company" },
  { name: "NSA", kind: "company" },
  { name: "IRS", kind: "company" },
  { name: "SEC", kind: "company" },
  { name: "NATO", kind: "company" },
  // Open-source projects that headline constantly
  { name: "Linux", kind: "product", aliases: ["Kernel"] },
  { name: "Apache", kind: "product", aliases: ["Struts", "Spark", "Solr"] },
  { name: "Nginx", kind: "product" },
  { name: "Openssl", kind: "product" },
  { name: "Xz", kind: "product" },
  { name: "React2Shell", kind: "product", aliases: ["React Server Components"] },
  { name: "LangChain", kind: "product" },
  { name: "XWiki", kind: "product" },
  { name: "Ivanti", kind: "company" },
  { name: "Progress", kind: "company", aliases: ["RadServer"] },
  { name: "Sonatype", kind: "company", aliases: ["Nexus"] },
  // Ransomware brands (tracked as entities too — users search for them)
  { name: "Lockbit", kind: "product", aliases: ["LockBit"] },
  { name: "Blackcat", kind: "product", aliases: ["ALPHV"] },
  { name: "Cl0p", kind: "product", aliases: ["Clop"] },
  { name: "Akira", kind: "product" },
  { name: "Medusa", kind: "product" },
  { name: "Ransomhub", kind: "product" },
];

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Precompile one matcher per entity, longest-name-first at call site.
const matchers: { name: string; kind: "company" | "product"; re: RegExp }[] = [];
for (const e of ENTITY_DICT) {
  const terms = [e.name, ...(e.aliases ?? [])];
  for (const t of terms) {
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    matchers.push({
      name: e.name,
      kind: e.kind,
      re: new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, "i"),
    });
  }
}
// Longer terms first so "Change Healthcare" beats "Change".
matchers.sort((a, b) => b.re.source.length - a.re.source.length);

/** Which entities from the dictionary appear in this text? */
export function matchEntities(text: string): { name: string; kind: "company" | "product" }[] {
  const found = new Map<string, "company" | "product">();
  for (const m of matchers) {
    if (found.has(m.name)) continue;
    if (m.re.test(text)) found.set(m.name, m.kind);
  }
  return [...found].map(([name, kind]) => ({ name, kind }));
}

/** Classify a news headline into a content vertical. */
export function classifyType(title: string, summary = ""): ItemType {
  const t = `${title} ${summary}`.toLowerCase();
  if (/\bcve-\d{4}-\d{4,7}\b/.test(t)) return "cve";
  if (/ransomware|ransom[- ]?hub|lockbit|blackcat|cl0p/.test(t)) return "ransomware";
  if (/breach|leak(ed|s)? of|data theft|stolen (data|records)|exposed/.test(t)) return "breach";
  if (/attack(ed|s)?|exploit(ed|s)?|hack(ed|s|ing)?|breach|intrusion|compromis|phishing|malware|botnet/.test(t))
    return "attack";
  if (/patch|update|advisory|bulletin|fixed|vulnerab/.test(t)) return "news";
  return "news";
}

export function extractCveId(text: string): string | undefined {
  const m = text.match(/\bCVE-(\d{4})-(\d{4,7})\b/i);
  return m ? `CVE-${m[1]}-${m[2]}` : undefined;
}

export function severityFromCvss(score?: number): Severity | undefined {
  if (score == null) return undefined;
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score > 0) return "low";
  return "info";
}
