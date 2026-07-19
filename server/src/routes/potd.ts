import { Hono } from "hono";
import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { db, UPLOADS_DIR } from "../db.js";
import { newId } from "../lib/ids.js";
import { sessionAuth } from "../lib/authMiddleware.js";
import { today } from "../lib/dates.js";
import { ensureTodayAssignments } from "../lib/potd.js";
import { parseCsvRecords } from "../lib/csv.js";
import { parseMultipart } from "../lib/multipart.js";
import { getVerifier, isLiveMode } from "../lib/verifier.js";
import type { AppEnv } from "../honoEnv.js";
import type { Difficulty, PotdAssignmentRow, PotdQuestionRow, UserRow } from "../types.js";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export const potdRoutes = new Hono<AppEnv>();
potdRoutes.use("*", sessionAuth);

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

function serializeQuestion(q: PotdQuestionRow) {
  return { id: q.id, title: q.title, body: q.body, topic: q.topic, difficulty: q.difficulty, source: q.source };
}

function deriveTitle(text: string): string {
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length > 0 && firstLine.length <= 80) return firstLine;
  const truncated = text.trim().slice(0, 60).trim();
  return text.length > 60 ? `${truncated}…` : truncated;
}

function normalizeDifficulty(raw: string | undefined): Difficulty {
  const lower = (raw ?? "").toLowerCase();
  return DIFFICULTIES.includes(lower as Difficulty) ? (lower as Difficulty) : "medium";
}

potdRoutes.get("/today", (c) => {
  const user = c.get("user");
  if (!user.duo_id) return c.json({ yours: null, partners: null });

  const date = today();
  const question = ensureTodayAssignments(user.duo_id, date);
  if (!question) return c.json({ yours: null, partners: null });

  const yoursAssignment = db
    .prepare<[string, string], PotdAssignmentRow>(`SELECT * FROM potd_assignments WHERE user_id = ? AND date = ?`)
    .get(user.id, date);

  const partnerRow = db
    .prepare<[string, string], UserRow>(`SELECT * FROM users WHERE duo_id = ? AND id != ?`)
    .get(user.duo_id, user.id);

  const partnersAssignment = partnerRow
    ? db
        .prepare<[string, string], PotdAssignmentRow>(`SELECT * FROM potd_assignments WHERE user_id = ? AND date = ?`)
        .get(partnerRow.id, date)
    : undefined;

  return c.json({
    yours: yoursAssignment
      ? { id: yoursAssignment.id, status: yoursAssignment.status, question: serializeQuestion(question) }
      : null,
    partners: partnersAssignment
      ? { id: partnersAssignment.id, status: partnersAssignment.status, question: serializeQuestion(question) }
      : null,
  });
});

potdRoutes.post("/upload", async (c) => {
  const user = c.get("user");
  if (!user.duo_id) return c.json({ error: "join a duo first" }, 409);

  const form = await parseMultipart(c);
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "file is required" }, 400);
  if (file.size > MAX_IMPORT_BYTES) {
    return c.json({ error: "file too large — imports are capped at 10 MB" }, 400);
  }

  const sourceName = file.name.replace(/\.[^.]+$/, "") || "Uploaded set";
  const now = new Date().toISOString();
  const isCsv = file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  const insertQuestion = db.prepare(
    `INSERT INTO potd_questions (id, duo_id, source, topic, difficulty, title, body, answer, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  if (isCsv) {
    const text = Buffer.from(await file.arrayBuffer()).toString("utf-8");
    const records = parseCsvRecords(text);
    const added: string[] = [];

    for (const record of records) {
      const bodyText = record.text ?? "";
      if (!bodyText) continue;
      const title = deriveTitle(bodyText);
      insertQuestion.run(
        newId("potd_q"),
        user.duo_id,
        record.source || sourceName,
        record.topic || "General",
        normalizeDifficulty(record.difficulty),
        title,
        bodyText,
        record.answer || null,
        now,
      );
      added.push(title);
    }

    return c.json({ added: added.length, sample: added.slice(0, 5) });
  }

  if (isPdf) {
    if (!isLiveMode()) return c.json({ error: "PDF extraction needs a live AI key — use CSV" }, 400);

    const filePath = join(UPLOADS_DIR, `${newId("import")}.pdf`);
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

    try {
      const result = await getVerifier().extractQuestions({ filePath, sourceName });
      const added: string[] = [];
      for (const q of result.questions) {
        insertQuestion.run(
          newId("potd_q"),
          user.duo_id,
          q.source || result.sourceTitle || sourceName,
          q.topic,
          q.difficulty,
          q.title,
          q.body,
          q.answer,
          now,
        );
        added.push(q.title);
      }
      return c.json({ added: added.length, sample: added.slice(0, 5) });
    } catch {
      return c.json({ error: "PDF extraction failed — try a CSV export instead" }, 502);
    } finally {
      await unlink(filePath).catch(() => {});
    }
  }

  return c.json({ error: "only CSV or PDF files are accepted" }, 400);
});

potdRoutes.get("/bank", (c) => {
  const user = c.get("user");
  if (!user.duo_id) return c.json({ questions: [] });

  const questions = db
    .prepare<[string], PotdQuestionRow>(`SELECT * FROM potd_questions WHERE duo_id = ? ORDER BY id`)
    .all(user.duo_id);
  const solvedIds = new Set(
    db
      .prepare<[string], { question_id: string }>(
        `SELECT DISTINCT question_id FROM potd_assignments WHERE duo_id = ? AND status = 'solved'`,
      )
      .all(user.duo_id)
      .map((r) => r.question_id),
  );

  return c.json({
    questions: questions.map((q) => ({
      id: q.id,
      title: q.title,
      topic: q.topic,
      difficulty: q.difficulty,
      source: q.source,
      solved: solvedIds.has(q.id),
    })),
  });
});
