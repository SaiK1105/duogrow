import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, extname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { UPLOADS_DIR } from "./db.js";
import { isLiveMode } from "./lib/verifier.js";
import type { AppEnv } from "./honoEnv.js";
import { authRoutes } from "./routes/auth.js";
import { duoRoutes } from "./routes/duo.js";
import { todayRoutes } from "./routes/today.js";
import { moduleRoutes } from "./routes/modules.js";
import { proofRoutes } from "./routes/proofs.js";
import { potdRoutes } from "./routes/potd.js";
import { cheerRoutes } from "./routes/cheers.js";
import { insightsRoutes } from "./routes/insights.js";
import { healthRoutes, reportRoutes } from "./routes/report.js";

const app = new Hono<AppEnv>();

const api = new Hono<AppEnv>();
api.route("/auth", authRoutes);
api.route("/duo", duoRoutes);
api.route("/today", todayRoutes);
api.route("/modules", moduleRoutes);
api.route("/proofs", proofRoutes);
api.route("/potd", potdRoutes);
api.route("/cheers", cheerRoutes);
api.route("/insights", insightsRoutes);
api.route("/report", reportRoutes);
api.route("/health", healthRoutes);
app.route("/api", api);

function mimeFor(name: string): string {
  switch (extname(name).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

// Streams uploaded proof files. The name is sanitized with basename() and
// then re-verified against the resolved uploads root — defense in depth
// against path traversal even if a raw ".."-style segment slips through.
app.get("/uploads/:name", async (c) => {
  const name = basename(c.req.param("name"));
  if (!name || name === "." || name === "..") return c.json({ error: "not found" }, 404);

  const filePath = join(UPLOADS_DIR, name);
  const resolvedPath = resolve(filePath);
  const resolvedRoot = resolve(UPLOADS_DIR);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + sep)) {
    return c.json({ error: "not found" }, 404);
  }

  try {
    const stats = await stat(resolvedPath);
    if (!stats.isFile()) return c.json({ error: "not found" }, 404);
  } catch {
    return c.json({ error: "not found" }, 404);
  }

  const stream = Readable.toWeb(createReadStream(resolvedPath)) as ReadableStream;
  return new Response(stream, { headers: { "Content-Type": mimeFor(resolvedPath) } });
});

app.notFound((c) => c.json({ error: "not found" }, 404));

const port = Number(process.env.API_PORT) || 8787;
serve({ fetch: app.fetch, port }, (info) => {
  const mode = isLiveMode() ? "live" : "demo";
  console.log(`DuoGrow API listening on http://localhost:${info.port} (AI mode: ${mode})`);
});
