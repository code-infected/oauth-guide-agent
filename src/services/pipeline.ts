import type { Guide } from "../types/guide.js";
import { investigate, MIN_TOTAL_CHARS } from "./investigator.js";
import { resolve } from "./resolver.js";
import { synthesize } from "./synthesizer.js";

export class InsufficientInfoError extends Error {}

// resolve → investigate → synthesize. Persisting is left to the caller.
export async function runPipeline(
  input: string,
  onProgress: (message: string) => void = () => {},
): Promise<Omit<Guide, "slug">> {
  onProgress(`Searching for ${input}'s developer docs`);
  const resolution = await resolve(input);
  if (!resolution) {
    throw new InsufficientInfoError(`Couldn't find official developer documentation for "${input}".`);
  }
  onProgress(`Using docs on ${resolution.docsDomain}`);

  const pages = await investigate(resolution, onProgress);
  const totalChars = pages.reduce((n, p) => n + p.text.length, 0);
  if (totalChars < MIN_TOTAL_CHARS) {
    throw new InsufficientInfoError(
      `Found too little OAuth documentation on ${resolution.docsDomain} to build a trustworthy guide for "${input}".`,
    );
  }

  onProgress(`Drafting the guide from ${pages.length} pages`);
  const draft = await synthesize(resolution.name, resolution.website, pages);
  if (!draft.enoughInformation) {
    throw new InsufficientInfoError(draft.insufficientReason || `The docs found weren't enough to build a guide for "${input}".`);
  }

  const { enoughInformation: _e, insufficientReason: _r, ...rest } = draft;
  return {
    ...rest,
    sources: pages.map((p) => ({ title: p.title, url: p.url })),
    isLive: true,
    generatedAt: new Date().toISOString(),
  };
}
