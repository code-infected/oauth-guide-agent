import { z } from "zod";

export const DifficultySchema = z.enum(["trivial", "moderate", "hard"]);

export const GuideStepSchema = z.object({
  title: z.string(),
  detail: z.string(),
  automatable: z.boolean().describe("Could an agent plausibly do this step on the developer's behalf?"),
});

export const ApprovalInfoSchema = z.object({
  required: z.boolean(),
  process: z.string().describe('Short description of the review/approval flow, or "" if none'),
  typicalWait: z.string().describe('e.g. "none", "1-2 business days", "1-3 weeks", or "unknown"'),
  rejectionRisks: z.array(z.string()).describe("Things that commonly cause rejection or delay"),
});

export const BlockerSchema = z.object({
  issue: z.string().describe("Something that can stop or stall the developer"),
  whatToDo: z.string().describe("How to get past it"),
});

export const EvidenceSchema = z.object({
  verified: z.array(z.string()).describe("Claims directly supported by the extracted source text"),
  inferred: z.array(z.string()).describe("Reasonable inferences not directly stated in the sources"),
  unverifiable: z.array(z.string()).describe("Things that could not be determined from the sources"),
});

// What the LLM produces in Stage 3. Sources are attached by the pipeline from the
// pages actually read, so the model can't invent them.
export const GuideDraftSchema = z.object({
  enoughInformation: z
    .boolean()
    .describe("false if the provided text is too thin or off-topic to build a trustworthy guide"),
  insufficientReason: z.string().describe('Why the information is insufficient, or "" if it is enough'),
  app: z.object({
    name: z.string(),
    website: z.string(),
    docsUrl: z.string().describe("The most relevant OAuth/app-registration docs URL from the provided pages"),
  }),
  difficulty: DifficultySchema,
  effort: z.object({
    activeTime: z.string().describe('Hands-on time, e.g. "~15 minutes", "1-2 hours"'),
    waitTime: z.string().describe('Waiting on the provider, e.g. "none", "1-3 weeks", "unknown"'),
  }),
  steps: z.array(GuideStepSchema),
  gotchas: z.array(z.string()),
  approval: ApprovalInfoSchema,
  blockers: z.array(BlockerSchema),
  agentCanDo: z.array(z.string()),
  youMustDo: z.array(z.string()),
  evidence: EvidenceSchema,
});

export type GuideDraft = z.infer<typeof GuideDraftSchema>;
export type Difficulty = z.infer<typeof DifficultySchema>;

export interface Source {
  title: string;
  url: string;
}

export interface Guide {
  slug: string;
  app: GuideDraft["app"];
  difficulty: Difficulty;
  effort: GuideDraft["effort"];
  steps: GuideDraft["steps"];
  gotchas: string[];
  approval: GuideDraft["approval"];
  blockers: GuideDraft["blockers"];
  agentCanDo: string[];
  youMustDo: string[];
  evidence: GuideDraft["evidence"] & {
    review?: string[]; // seed guides only: what was checked or corrected against the live provider docs
  };
  sources: Source[];
  isLive: boolean; // true = live-generated/unverified, false = seed guide checked against live docs
  generatedAt: string;
}

export interface GuideSummary {
  slug: string;
  name: string;
  difficulty: Difficulty;
  isLive: boolean;
}
