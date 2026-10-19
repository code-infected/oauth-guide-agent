export interface TavilyResult {
  url: string;
  title: string;
  content: string;
  raw_content?: string | null;
  score: number;
}

interface SearchOptions {
  maxResults?: number;
  includeDomains?: string[];
  advanced?: boolean;
  rawContent?: boolean;
}

export async function tavilySearch(query: string, opts: SearchOptions = {}): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers.authorization = `Bearer ${key}`;
  else headers["X-Tavily-Access-Mode"] = "keyless";

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      max_results: opts.maxResults ?? 5,
      search_depth: opts.advanced ? "advanced" : "basic",
      ...(opts.advanced ? { chunks_per_source: 3 } : {}),
      include_domains: opts.includeDomains ?? [],
      include_raw_content: opts.rawContent ? "markdown" : false,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Tavily search failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { results?: TavilyResult[] };
  return data.results ?? [];
}
