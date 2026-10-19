import { tavilySearch, type TavilyResult } from "./tavily.js";

export interface Resolution {
  name: string;
  website: string;
  docsDomain: string; // registrable domain the investigation is restricted to, e.g. "google.com"
  hits: TavilyResult[];
}

// Sites that write *about* other providers' OAuth. Ignored unless they are the app being asked about.
const THIRD_PARTY = new Set([
  "medium.com", "dev.to", "stackoverflow.com", "stackexchange.com", "reddit.com", "youtube.com",
  "github.com", "github.io", "nango.dev", "composio.dev", "pipedream.com", "zapier.com", "n8n.io",
  "merge.dev", "unified.to", "postman.com", "rapidapi.com", "apitracker.io", "freecodecamp.org",
  "geeksforgeeks.org", "hashnode.dev", "substack.com", "linkedin.com", "quora.com", "wikipedia.org",
  "stytch.com", "workos.com", "clerk.com", "auth0.com", "okta.com", "supertokens.com", "make.com",
]);

const DOCS_HOST = /^(developers?|docs|api|dev|learn|platform|devcenter|devportal)\./;

export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  const sld = parts[parts.length - 2];
  const tld = parts[parts.length - 1];
  const takeThree = tld.length === 2 && ["co", "com", "org", "net", "ac", "gov"].includes(sld);
  return parts.slice(takeThree ? -3 : -2).join(".");
}

const token = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function parseInput(input: string): { name: string; host?: string } {
  const trimmed = input.trim();
  const looksLikeUrl = /^https?:\/\//i.test(trimmed) || (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(trimmed) && !trimmed.includes(" "));
  if (!looksLikeUrl) return { name: trimmed };
  try {
    const host = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).hostname;
    const label = registrableDomain(host).split(".")[0];
    return { name: label.charAt(0).toUpperCase() + label.slice(1), host };
  } catch {
    return { name: trimmed };
  }
}

export async function resolve(input: string): Promise<Resolution | null> {
  const { name, host } = parseInput(input);
  if (!name) return null;
  // Search quality varies by phrasing (a quoted query once returned only app-store pages), so try a second form.
  for (const query of [`${name} API OAuth developer documentation`, `"${name}" developer API documentation OAuth create app`]) {
    let hits: TavilyResult[] = [];
    if (host) hits = await tavilySearch(query, { maxResults: 8, includeDomains: [registrableDomain(host)] });
    if (hits.length === 0) hits = await tavilySearch(query, { maxResults: 8 });
    const resolution = pickDocsDomain(name, host, hits);
    if (resolution) return resolution;
  }
  return null;
}

function pickDocsDomain(name: string, host: string | undefined, hits: TavilyResult[]): Resolution | null {
  const appToken = token(name);
  const scores = new Map<string, number>();
  for (const hit of hits) {
    let h: string;
    try {
      h = new URL(hit.url).hostname.toLowerCase();
    } catch {
      continue;
    }
    const reg = registrableDomain(h);
    const matchesApp = appToken.length > 1 && token(reg).includes(appToken);
    if (THIRD_PARTY.has(reg) && !matchesApp) continue;
    const docsLike = DOCS_HOST.test(h);
    const mentionsApp = appToken.length > 1 && token(`${hit.title} ${hit.content}`).includes(appToken);
    // e.g. Gmail lives on developers.google.com: accept a docs host on another domain only if the page is about the app.
    if (!matchesApp && !(docsLike && mentionsApp)) continue;
    let score = hit.score;
    if (matchesApp) score += 2;
    if (docsLike) score += 1;
    if (/oauth|auth|apps?\b|scopes?/i.test(hit.url)) score += 0.5;
    scores.set(reg, (scores.get(reg) ?? 0) + score);
  }

  const best = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!best) return null;
  const docsDomain = best[0];
  return {
    name,
    website: `https://${host ? host.replace(/^www\./, "") : docsDomain}`,
    docsDomain,
    hits: hits.filter((hit) => registrableDomain(new URL(hit.url).hostname) === docsDomain),
  };
}
