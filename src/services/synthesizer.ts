import { GuideDraftSchema, type GuideDraft } from "../types/guide.js";
import type { ExtractedPage } from "./investigator.js";
import { createLLMProvider } from "./llm.js";

const SYSTEM = `You help developers understand what it takes to register an OAuth app with a specific provider and get it approved for use.

The reader is a developer building an AI agent product. Their own end users (people outside the developer's company) will connect their accounts to the agent through this OAuth app. So "ready for use" means: real external users can authorize it, not just the developer's own test account.

You will be given the provider's name, a website hint, and raw text extracted from several of the provider's own documentation pages. Produce one JSON object matching the schema.

Evidence rules — these matter more than completeness:
- Put a claim in evidence.verified only if it is actually present in the provided text. Quote or closely paraphrase it and name the page it came from.
- Anything you believe from general knowledge of the provider but did not see in the text goes in evidence.inferred, never in verified.
- Anything the text does not address goes in evidence.unverifiable.
- Never state a specific wait time or approval requirement you saw no evidence for. If the pages say nothing about review, set approval.typicalWait to "unknown" and say so in unverifiable rather than guessing.
- Steps, gotchas and blockers may draw on inferred knowledge, but the evidence section must make clear which parts are inferred.
- Some pages may be about a different product from the same company (e.g. another API, an e-signature product, a hardware platform), or be legacy/outdated pages. Ignore anything that doesn't apply to this provider's current OAuth flow for the product named.
- If the text is too thin or is not about this provider's OAuth setup, set enoughInformation to false and explain in insufficientReason. Do not invent a guide.

Difficulty bands:
- trivial: self-serve app creation, no manual review gate before external users can connect.
- moderate: self-serve, but with real nuances (user caps in development mode, distribution toggles, scope tiers, sandbox/production split, optional review for marketplace listing).
- hard: a mandatory manual review, verification, security assessment or partner approval before external users can connect, with a meaningful wait.

Field guidance:
- effort.activeTime is hands-on time; effort.waitTime is time spent waiting on the provider.
- steps: ordered, concrete, mention the console/page names the docs use. Mark automatable=true only for steps an agent could realistically do (research, choosing scopes, drafting policy text, writing integration code, filling forms the developer is logged into); false for anything needing the developer's identity, legal acceptance, payment, domain ownership, or the provider's decision.
- blockers: things that commonly stop or stall setup, each with what to do about it.
- agentCanDo: what this research agent already did (it read the provider's docs listed in the sources) and what an agent could further do. youMustDo: what only the developer can do.
- app.website is the product's own homepage (e.g. https://mail.google.com for Gmail), not the parent company's root domain when the two differ.
- app.docsUrl must be one of the provided page URLs.`;

export async function synthesize(name: string, websiteHint: string, pages: ExtractedPage[]): Promise<GuideDraft> {
  const llm = createLLMProvider();
  const context = pages
    .map((p, i) => `--- Page ${i + 1} [${p.intent}] ${p.title}\nURL: ${p.url}\n\n${p.text}`)
    .join("\n\n");
  const user = `Provider: ${name}\nWebsite hint: ${websiteHint}\n\nExtracted documentation text:\n\n${context}`;
  return llm.generateStructured({ system: SYSTEM, user, schema: GuideDraftSchema, schemaName: "oauth_setup_guide" });
}
