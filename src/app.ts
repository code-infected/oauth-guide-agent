import express from "express";
import path from "node:path";
import { generateRouter } from "./routes/generate.js";
import { guidesRouter } from "./routes/guides.js";

const publicDir = path.join(process.cwd(), "public");

export const app = express();
app.use(express.json());
app.use("/api/guides", guidesRouter);
app.use("/api/generate", generateRouter);
app.use(express.static(publicDir));

// Shareable guide URLs: /guides/<slug>
app.get("/guides/:slug", (_req, res) => res.sendFile(path.join(publicDir, "guide.html")));
