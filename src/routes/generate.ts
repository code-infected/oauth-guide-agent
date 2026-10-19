import { Router } from "express";
import { InsufficientInfoError, runPipeline } from "../services/pipeline.js";
import { parseInput } from "../services/resolver.js";
import { findExistingGuide, saveGuide, uniqueSlug } from "../services/store.js";

export const generateRouter = Router();

// POST /api/generate { input } → Guide.
// With "Accept: text/event-stream" it streams progress events, then a final "guide" or "error" event.
generateRouter.post("/", async (req, res) => {
  const input = typeof req.body?.input === "string" ? req.body.input.trim() : "";
  if (!input || input.length > 200) {
    return res.status(400).json({ error: "Provide an app name or website (max 200 characters)." });
  }

  const streaming = req.headers.accept?.includes("text/event-stream");
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  if (streaming) {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  }

  // Same app already covered: return that guide instead of spending another pipeline run.
  const { name, host } = parseInput(input);
  const existing = findExistingGuide(name, host);
  if (existing) {
    if (!streaming) return res.json(existing);
    send("status", { message: `Found an existing guide for ${existing.app.name}` });
    send("guide", existing);
    return res.end();
  }

  try {
    const draft = await runPipeline(input, (message) => streaming && send("status", { message }));
    // The input may have been an alias ("Google Mail") for an app that already has a guide ("Gmail").
    const known = findExistingGuide(draft.app.name);
    const guide = known ?? { slug: uniqueSlug(draft.app.name), ...draft };
    if (!known) saveGuide(guide);
    if (streaming) {
      send("guide", guide);
      return res.end();
    }
    res.json(guide);
  } catch (err) {
    const insufficient = err instanceof InsufficientInfoError;
    console.error(`generate "${input}" failed:`, err);
    const error = insufficient
      ? err.message
      : "Something went wrong while generating this guide. Please try again.";
    if (streaming) {
      send("error", { error, insufficient });
      return res.end();
    }
    res.status(insufficient ? 422 : 500).json({ error, insufficient });
  }
});
