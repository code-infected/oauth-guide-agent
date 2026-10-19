import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Guide, GuideSummary } from "../types/guide.js";

const dbPath = process.env.DATABASE_PATH || "./data/guides.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.exec(`CREATE TABLE IF NOT EXISTS guides (
  slug TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  is_live INTEGER NOT NULL,
  created_at TEXT NOT NULL
)`);

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";
}

export function uniqueSlug(name: string): string {
  const base = slugify(name);
  const exists = db.prepare("SELECT 1 FROM guides WHERE slug = ?");
  if (!exists.get(base)) return base;
  for (let i = 2; ; i++) if (!exists.get(`${base}-${i}`)) return `${base}-${i}`;
}

export function saveGuide(guide: Guide): void {
  db.prepare("INSERT OR REPLACE INTO guides (slug, json, is_live, created_at) VALUES (?, ?, ?, ?)").run(
    guide.slug,
    JSON.stringify(guide),
    guide.isLive ? 1 : 0,
    guide.generatedAt,
  );
}

export function getGuide(slug: string): Guide | null {
  const row = db.prepare("SELECT json FROM guides WHERE slug = ?").get(slug) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as Guide) : null;
}

export function listGuides(): GuideSummary[] {
  const rows = db.prepare("SELECT json FROM guides ORDER BY is_live ASC, created_at DESC").all() as { json: string }[];
  return rows.map(({ json }) => {
    const g = JSON.parse(json) as Guide;
    return { slug: g.slug, name: g.app.name, difficulty: g.difficulty, isLive: g.isLive };
  });
}

function hostOf(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Finds a guide for the same app so "Linear", "linear.app" and "https://www.linear.app/" don't each trigger a new generation.
export function findExistingGuide(name: string, host?: string): Guide | null {
  const slug = slugify(name);
  const bySlug = getGuide(slug);
  if (bySlug) return bySlug;
  const rows = db.prepare("SELECT json FROM guides ORDER BY is_live ASC, created_at ASC").all() as { json: string }[];
  for (const { json } of rows) {
    const g = JSON.parse(json) as Guide;
    if (slugify(g.app.name) === slug) return g;
    if (host && hostOf(g.app.website) === host.toLowerCase().replace(/^www\./, "")) return g;
  }
  return null;
}

// Seed guides are committed as JSON and (re)loaded on every start, so they survive redeploys.
export function loadSeedGuides(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  for (const f of files) saveGuide(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Guide);
  return files.length;
}
