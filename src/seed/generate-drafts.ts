// Runs each seed app through the same pipeline as live generation and writes a draft JSON per app
// to src/seed/drafts/. Drafts are then checked against the provider's docs and copied into
// seed-guides/ with isLive: false and evidence.review filled in.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { runPipeline } from "../services/pipeline.js";
import { slugify } from "../services/store.js";

const seedDir = path.join(process.cwd(), "src", "seed");
const apps = JSON.parse(fs.readFileSync(path.join(seedDir, "seed-apps.json"), "utf8")) as { name: string; website: string }[];
const only = process.argv.slice(2).map((s) => s.toLowerCase());
const outDir = path.join(seedDir, "drafts");
fs.mkdirSync(outDir, { recursive: true });

for (const { name } of apps.filter((a) => !only.length || only.includes(a.name.toLowerCase()))) {
  try {
    const draft = await runPipeline(name, (m) => console.log(`[${name}] ${m}`));
    const slug = slugify(name);
    fs.writeFileSync(path.join(outDir, `${slug}.json`), JSON.stringify({ slug, ...draft }, null, 2));
    console.log(`[${name}] → ${draft.difficulty}, wait ${draft.effort.waitTime}`);
  } catch (err) {
    console.error(`[${name}] failed:`, err instanceof Error ? err.message : err);
  }
}
