import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { prisma } from "./db.js";
import { attachUser } from "./loadUser.js";
import { authRouter } from "./routes/auth.js";
import { campaignsRouter } from "./routes/campaigns.js";
import { languagesRouter } from "./routes/languages.js";
import { publicRouter } from "./routes/publicSite.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

// Wires the API. Columns live in prisma/schema.prisma.
// Sign-in is routes/auth.js. One campaign is routes/campaigns.js.
// Languages are routes/languages.js. The public site is routes/publicSite.js.
const app = express();
const port = Number(process.env.PORT) || 4000;
const origins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: origins,
    credentials: true,
  }),
);
app.use(express.json());
app.use(attachUser);

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      service: "website-operations-api",
      database: "up",
    });
  } catch {
    res.status(503).json({
      ok: false,
      service: "website-operations-api",
      database: "down",
    });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/panel", campaignsRouter);
app.use("/api/panel", languagesRouter);
app.use("/api/public", publicRouter);

app.use((error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error.type === "entity.parse.failed") {
    res.status(400).json({ error: "Send valid JSON." });
    return;
  }
  const status = Number(error.status || error.statusCode);
  if (status >= 400 && status < 500) {
    res.status(status).json({ error: error.message || "Bad request." });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong." });
});

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
}

process.on("SIGINT", () => {
  shutdown().finally(() => process.exit(0));
});
process.on("SIGTERM", () => {
  shutdown().finally(() => process.exit(0));
});
