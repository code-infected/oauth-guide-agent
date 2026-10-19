import "dotenv/config";
import path from "node:path";
import { app } from "./app.js";
import { loadSeedGuides } from "./services/store.js";

const count = loadSeedGuides(path.join(process.cwd(), "src", "seed", "seed-guides"));
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Loaded ${count} seed guides. Listening on http://localhost:${port}`));
