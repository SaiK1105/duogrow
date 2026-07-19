import { db } from "../db.js";
import { newId } from "./ids.js";
import type { PotdQuestionRow } from "../types.js";

/** 32-bit FNV-1a hash, unsigned. Deterministic across processes/platforms. */
export function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Deterministic daily pick: fnv1a(duoId:date) modulo the unsolved-question
 * pool, sorted by id. Same duo + same date always yields the same question
 * for both partners, with zero AI calls (SPEC.md "POTD selection").
 */
export function pickTodaysQuestion(duoId: string, date: string, pool: PotdQuestionRow[]): PotdQuestionRow | null {
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const hash = fnv1a(`${duoId}:${date}`);
  const index = hash % sorted.length;
  return sorted[index];
}

function unsolvedPool(duoId: string): PotdQuestionRow[] {
  const solvedRows = db
    .prepare<[string], { question_id: string }>(
      `SELECT DISTINCT question_id FROM potd_assignments WHERE duo_id = ? AND status = 'solved'`,
    )
    .all(duoId);
  const solvedIds = new Set(solvedRows.map((r) => r.question_id));
  const all = db.prepare<[string], PotdQuestionRow>(`SELECT * FROM potd_questions WHERE duo_id = ?`).all(duoId);
  const unsolved = all.filter((q) => !solvedIds.has(q.id));
  // If the duo has solved every question in the bank, recycle the full bank
  // rather than leaving POTD empty.
  return unsolved.length > 0 ? unsolved : all;
}

/** The question this duo would be assigned today, without persisting anything. */
export function getTodaysQuestionForDuo(duoId: string, date: string): PotdQuestionRow | null {
  return pickTodaysQuestion(duoId, date, unsolvedPool(duoId));
}

/**
 * Ensure every member of the duo has a potd_assignments row for `date`,
 * creating them (same question for both — SPEC's "same" mode) on first
 * call. Idempotent: safe to call from every /today and /potd/today request.
 */
export function ensureTodayAssignments(duoId: string, date: string): PotdQuestionRow | null {
  const question = getTodaysQuestionForDuo(duoId, date);
  if (!question) return null;

  const members = db.prepare<[string], { id: string }>(`SELECT id FROM users WHERE duo_id = ?`).all(duoId);
  const now = new Date().toISOString();

  const insert = db.prepare(
    `INSERT INTO potd_assignments (id, duo_id, user_id, question_id, date, mode, status, proof_id, updated_at)
     VALUES (?, ?, ?, ?, ?, 'same', 'assigned', NULL, ?)`,
  );
  const exists = db.prepare<[string, string], { id: string }>(
    `SELECT id FROM potd_assignments WHERE user_id = ? AND date = ?`,
  );

  for (const member of members) {
    if (exists.get(member.id, date)) continue;
    insert.run(newId("potd_a"), duoId, member.id, question.id, date, now);
  }

  return question;
}
