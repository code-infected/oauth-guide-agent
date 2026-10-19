import type { Resolution } from "./resolver.js";
import { tavilySearch, type TavilyResult } from "./tavily.js";

export interface ExtractedPage {
  title: string;
  url: string;
  intent: string;
  text: string;
}

const PER_PAGE_CHARS = 3500;
const MAX_PAGES = 10;
export const MIN_TOTAL_CHARS = 1500;

const INTENTS = [
  { key: "registration", label: "app registration page", query: (n: string) => `${n} create OAuth app register application client ID redirect URI` },
  { key: "scopes", label: "scopes and permissions", query: (n: string) => `${n} OAuth scopes permissions list` },
  { key: "review", label: "app review / verification process", query: (n: string) => `${n} OAuth app review verification approval publish marketplace` },
  { key: "limits", label: "rate limits and sandbox vs production", query: (n: string) => `${n} API rate limits sandbox development mode production access` },
];

function toPageText(r: TavilyResult): string {
  // Tavily's `content` holds the chunks most relevant to the query; raw markdown adds surrounding context.
  const raw = (r.raw_content ?? "").replace(/\n{3,}/g, "\n\n");
  const text = raw && !raw.includes(r.content.slice(0, 80)) ? `${r.content}\n\n${raw}` : raw || r.content;
  return text.slice(0, PER_PAGE_CHARS);
}

export async function investigate(
  resolution: Resolution,
  onProgress: (message: string) => void,
): Promise<ExtractedPage[]> {
  const pages = new Map<string, ExtractedPage>();

  const results = await Promise.all(
    INTENTS.map(async (intent) => {
      const hits = await tavilySearch(intent.query(resolution.name), {
        maxResults: 3,
        includeDomains: [resolution.docsDomain],
        advanced: true,
        rawContent: true,
      }).catch(() => [] as TavilyResult[]);
      onProgress(hits.length ? `Read ${hits.length} page(s) about ${intent.label}` : `Found nothing on ${intent.label}`);
      return { intent, hits };
    }),
  );

  for (const { intent, hits } of results) {
    for (const hit of hits) {
      if (pages.has(hit.url) || pages.size >= MAX_PAGES) continue;
      const text = toPageText(hit);
      if (text.trim().length < 200) continue;
      pages.set(hit.url, { title: hit.title, url: hit.url, intent: intent.key, text });
    }
  }

  // Stage 1 hits on the docs domain are also usable evidence.
  for (const hit of resolution.hits) {
    if (pages.has(hit.url) || pages.size >= MAX_PAGES || hit.content.length < 200) continue;
    pages.set(hit.url, { title: hit.title, url: hit.url, intent: "overview", text: hit.content.slice(0, PER_PAGE_CHARS) });
  }

  return [...pages.values()];
}
