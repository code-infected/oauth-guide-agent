import { Router } from "express";
import { getGuide, listGuides } from "../services/store.js";

export const guidesRouter = Router();

guidesRouter.get("/", (_req, res) => {
  res.json(listGuides());
});

guidesRouter.get("/:slug", (req, res) => {
  const guide = getGuide(req.params.slug);
  if (!guide) return res.status(404).json({ error: "Guide not found" });
  res.json(guide);
});
