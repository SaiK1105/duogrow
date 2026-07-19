import { Hono } from "hono";
import { writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { db, UPLOADS_DIR } from "../db.js";
import { newId } from "../lib/ids.js";
import { sessionAuth } from "../lib/authMiddleware.js";
import { today } from "../lib/dates.js";
import { buildTodayContext } from "../lib/todayContext.js";
import { getVerifier } from "../lib/verifier.js";
import { parseMultipart } from "../lib/multipart.js";
import { applyUpdate, describeUpdate } from "../lib/applyProof.js";
import { advanceDuoStreak } from "../lib/streaks.js";
import type { AppEnv } from "../honoEnv.js";
import { MODULE_NAMES, type ProofRow, type UserRow } from "../types.js";
import type { ModuleHint } from "../lib/verifierTypes.js";

export const proofRoutes = new Hono<AppEnv>();
proofRoutes.use("*", sessionAuth);

const ACCEPTED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};
const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};
const GENERIC_MIME = new Set(["", "application/octet-stream", "binary/octet-stream"]);
const MAX_BYTES = 5 * 1024 * 1024;

function isModuleHint(value: unknown): value is ModuleHint {
  if (value == null || value === "") return true;
  return typeof value === "string" && ((MODULE_NAMES as string[]).includes(value) || value === "potd");
}

/**
 * Some clients (observed: PowerShell's `Invoke-RestMethod -Form`) don't
 * infer a file part's Content-Type from its extension and send a generic
 * "application/octet-stream" instead. Fall back to sniffing the filename
 * extension in that case rather than rejecting an otherwise-valid upload.
 */
function resolveMimeType(file: File): string | null {
  if (ACCEPTED_MIME[file.type]) return file.type;
  if (GENERIC_MIME.has(file.type)) {
    const inferred = EXT_TO_MIME[extname(file.name).toLowerCase()];
    if (inferred) return inferred;
  }
  return null;
}

function buildSummary(taskType: string, matchedModule: string | null, confidence: number): string {
  const label = matchedModule ?? taskType;
  const readable = label.charAt(0).toUpperCase() + label.slice(1);
  return `${readable} proof recognized with ${confidence}% confidence.`;
}

function serializeProof(row: ProofRow) {
  return {
    id: row.id,
    url: `/uploads/${basename(row.file_path)}`,
    module: row.target_module,
    aiStatus: row.ai_status,
    aiConfidence: row.ai_confidence,
    band: row.ai_band,
    evidence: row.ai_evidence_json ? JSON.parse(row.ai_evidence_json) : [],
    metrics: row.ai_metrics_json ? JSON.parse(row.ai_metrics_json) : null,
    coachMessage: row.ai_coach_message,
    summary: row.ai_summary,
    appliedUpdate: row.ai_applied_update_json ? JSON.parse(row.ai_applied_update_json) : null,
    createdAt: row.created_at,
  };
}

proofRoutes.post("/", async (c) => {
  const user = c.get("user");
  if (!user.duo_id) return c.json({ error: "join a duo first" }, 409);

  const form = await parseMultipart(c);
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "file is required" }, 400);

  const mimeType = resolveMimeType(file);
  if (!mimeType) return c.json({ error: "only jpeg, png, webp, or pdf proofs are accepted" }, 400);
  if (file.size > MAX_BYTES) return c.json({ error: "file exceeds the 5MB limit" }, 400);

  const moduleRaw = form.get("module");
  const moduleField = typeof moduleRaw === "string" && moduleRaw.length > 0 ? moduleRaw : null;
  if (!isModuleHint(moduleField)) return c.json({ error: "unknown module" }, 400);
  const moduleHint = moduleField;

  const fileName = `${newId("proof")}${ACCEPTED_MIME[mimeType]}`;
  const filePath = join(UPLOADS_DIR, fileName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, bytes);

  const date = today();
  const todayContext = buildTodayContext(user, date);
  const verifier = getVerifier();
  const verdict = await verifier.verify({ filePath, mimeType, moduleHint, todayContext });

  const targetModule: ModuleHint = verdict.matched_module ?? moduleHint;
  const proofId = newId("proof_row");
  let aiStatus: "verified" | "review" | "rejected" = "rejected";
  let appliedUpdate: ReturnType<typeof describeUpdate> = null;

  if (verdict.band === "high") {
    const update = describeUpdate(verdict, targetModule);
    if (update) {
      applyUpdate(user, user.duo_id, date, update, proofId);
      advanceDuoStreak(user.duo_id, date);
      appliedUpdate = update;
      aiStatus = "verified";
    } else {
      // High confidence but nothing to apply (no module match): ask the user
      // to confirm instead of reporting a "verified" no-op.
      verdict.band = "medium";
      aiStatus = "review";
    }
  } else if (verdict.band === "medium") {
    appliedUpdate = describeUpdate(verdict, targetModule);
    aiStatus = "review";
  }

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO proofs (id, user_id, duo_id, date, file_path, mime_type, target_module, target_ref_id,
       ai_status, ai_confidence, ai_band, ai_summary, ai_evidence_json, ai_metrics_json, ai_coach_message,
       ai_applied_update_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    proofId,
    user.id,
    user.duo_id,
    date,
    filePath,
    mimeType,
    targetModule,
    aiStatus,
    verdict.confidence,
    verdict.band,
    buildSummary(verdict.task_type, verdict.matched_module, verdict.confidence),
    JSON.stringify(verdict.evidence),
    JSON.stringify(verdict.extracted_metrics),
    verdict.coach_message,
    appliedUpdate ? JSON.stringify(appliedUpdate) : null,
    now,
  );

  const row = db.prepare<[string], ProofRow>(`SELECT * FROM proofs WHERE id = ?`).get(proofId)!;
  return c.json({ proof: serializeProof(row) });
});

proofRoutes.post("/:id/apply", (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const row = db.prepare<[string], ProofRow>(`SELECT * FROM proofs WHERE id = ?`).get(id);
  if (!row || row.duo_id !== user.duo_id) return c.json({ error: "proof not found" }, 404);
  if (row.ai_status !== "review") return c.json({ error: "only proofs pending review can be applied" }, 409);

  const update = row.ai_applied_update_json ? JSON.parse(row.ai_applied_update_json) : null;
  if (!update) return c.json({ error: "no suggested update to apply" }, 409);

  const proofUser = db.prepare<[string], UserRow>(`SELECT * FROM users WHERE id = ?`).get(row.user_id)!;
  applyUpdate(proofUser, row.duo_id, row.date, update, row.id);
  db.prepare(`UPDATE proofs SET ai_status = 'verified' WHERE id = ?`).run(row.id);

  const updated = db.prepare<[string], ProofRow>(`SELECT * FROM proofs WHERE id = ?`).get(row.id)!;
  return c.json({ ok: true, proof: serializeProof(updated) });
});

proofRoutes.get("/", (c) => {
  const user = c.get("user");
  if (!user.duo_id) return c.json({ proofs: [] });
  const rows = db
    .prepare<[string], ProofRow>(`SELECT * FROM proofs WHERE duo_id = ? ORDER BY created_at DESC LIMIT 12`)
    .all(user.duo_id);
  return c.json({ proofs: rows.map(serializeProof) });
});

proofRoutes.get("/:id", (c) => {
  const user = c.get("user");
  const row = db.prepare<[string], ProofRow>(`SELECT * FROM proofs WHERE id = ?`).get(c.req.param("id"));
  if (!row || row.duo_id !== user.duo_id) return c.json({ error: "proof not found" }, 404);
  return c.json({ proof: serializeProof(row) });
});
