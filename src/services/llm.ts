import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import { z } from "zod";

// Provider-neutral interface: the pipeline only ever asks for "structured JSON matching this schema".
export interface LLMProvider {
  name: string;
  generateStructured<T>(opts: { system: string; user: string; schema: z.ZodType<T>; schemaName: string }): Promise<T>;
}

class AnthropicProvider implements LLMProvider {
  name = "anthropic";
  private client: Anthropic;
  constructor(apiKey: string, private model: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateStructured<T>({ system, user, schema }: { system: string; user: string; schema: z.ZodType<T> }) {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: zodOutputFormat(schema as z.ZodType<T> & z.ZodObject) },
    });
    if (response.stop_reason === "refusal") throw new Error("The model declined to produce a guide.");
    if (!response.parsed_output) throw new Error(`Model returned no parseable output (stop_reason: ${response.stop_reason}).`);
    return response.parsed_output as T;
  }
}

// Works with OpenAI and any OpenAI-compatible endpoint (OpenRouter, Groq, Together, Ollama, ...) via LLM_BASE_URL.
class OpenAICompatibleProvider implements LLMProvider {
  name = "openai";
  private client: OpenAI;
  constructor(apiKey: string, private model: string, baseURL?: string) {
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async generateStructured<T>({ system, user, schema, schemaName }: { system: string; user: string; schema: z.ZodType<T>; schemaName: string }) {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, schema: z.toJSONSchema(schema) as Record<string, unknown>, strict: true },
      },
    });
    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("Model returned an empty response.");
    return schema.parse(JSON.parse(text));
  }
}

export function createLLMProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase();
  if (provider === "anthropic") {
    const key = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("Set LLM_API_KEY or ANTHROPIC_API_KEY");
    return new AnthropicProvider(key, process.env.LLM_MODEL || "claude-opus-5-5");
  }
  if (provider === "openai") {
    const key = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("Set LLM_API_KEY or OPENAI_API_KEY");
    if (!process.env.LLM_MODEL) throw new Error("Set LLM_MODEL when LLM_PROVIDER=openai");
    return new OpenAICompatibleProvider(key, process.env.LLM_MODEL, process.env.LLM_BASE_URL || undefined);
  }
  throw new Error(`Unknown LLM_PROVIDER "${provider}" (expected "anthropic" or "openai")`);
}
