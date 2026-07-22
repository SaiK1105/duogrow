import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { hashSessionToken } from "./lib/session.js";

export const DATA_DIR = process.env.DATA_DIR || join(homedir(), ".duogrow");
export const UPLOADS_DIR = join(DATA_DIR, "uploads");

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new Database(join(DATA_DIR, "duogrow.sqlite"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// 8-table schema per SPEC.md. All CREATE statements are idempotent so booting
// against an existing database is always safe.
db.exec(`
  CREATE TABLE IF NOT EXISTS duos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    potd_mode TEXT NOT NULL DEFAULT 'same',
    created_by TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    duo_id TEXT REFERENCES duos(id),
    session_token TEXT NOT NULL UNIQUE,
    config_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS daily_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    duo_id TEXT NOT NULL REFERENCES duos(id),
    date TEXT NOT NULL,
    module TEXT NOT NULL CHECK (module IN ('wake','study','workout','diet','tasks')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
    value REAL,
    target REAL,
    detail_json TEXT,
    proof_id TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, date, module)
  );

  CREATE TABLE IF NOT EXISTS proofs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    duo_id TEXT NOT NULL REFERENCES duos(id),
    date TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    target_module TEXT,
    target_ref_id TEXT,
    ai_status TEXT NOT NULL DEFAULT 'pending' CHECK (ai_status IN ('pending','verified','review','rejected','error')),
    ai_confidence INTEGER,
    ai_band TEXT CHECK (ai_band IN ('high','medium','low')),
    ai_summary TEXT,
    ai_evidence_json TEXT,
    ai_metrics_json TEXT,
    ai_coach_message TEXT,
    ai_applied_update_json TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS potd_questions (
    id TEXT PRIMARY KEY,
    duo_id TEXT NOT NULL REFERENCES duos(id),
    source TEXT NOT NULL,
    topic TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    answer TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS potd_assignments (
    id TEXT PRIMARY KEY,
    duo_id TEXT NOT NULL REFERENCES duos(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    question_id TEXT NOT NULL REFERENCES potd_questions(id),
    date TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'same',
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','attempted','solved')),
    proof_id TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, date)
  );

  CREATE TABLE IF NOT EXISTS streaks (
    id TEXT PRIMARY KEY,
    duo_id TEXT NOT NULL REFERENCES duos(id),
    scope TEXT NOT NULL,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_date TEXT,
    UNIQUE(duo_id, scope)
  );

  CREATE TABLE IF NOT EXISTS cheers (
    id TEXT PRIMARY KEY,
    duo_id TEXT NOT NULL REFERENCES duos(id),
    from_user_id TEXT NOT NULL REFERENCES users(id),
    to_user_id TEXT NOT NULL REFERENCES users(id),
    message TEXT,
    emoji TEXT NOT NULL,
    seen INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ai_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    personal_enabled INTEGER NOT NULL DEFAULT 0 CHECK (personal_enabled IN (0, 1)),
    duo_enabled INTEGER NOT NULL DEFAULT 0 CHECK (duo_enabled IN (0, 1)),
    policy_version TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'disabled' CHECK (mode IN ('live', 'demo', 'disabled')),
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ai_duo_consents (
    duo_id TEXT NOT NULL REFERENCES duos(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
    policy_version TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (duo_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS ai_usage_daily (
    user_id TEXT NOT NULL,
    duo_id TEXT,
    feature TEXT NOT NULL CHECK (feature IN ('daily_plan', 'duo_reflection', 'potd_tutor', 'chat')),
    date TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    reserved_cost_cents INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, feature, date)
  );

  CREATE TABLE IF NOT EXISTS ai_project_usage_month (
    user_id TEXT NOT NULL,
    month TEXT NOT NULL,
    reserved_cost_cents INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, month)
  );

  CREATE TABLE IF NOT EXISTS ai_audit_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    duo_id TEXT,
    feature TEXT NOT NULL CHECK (feature IN ('daily_plan', 'duo_reflection', 'potd_tutor', 'chat')),
    policy_version TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_daily_entries_user_date ON daily_entries(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_daily_entries_duo_date ON daily_entries(duo_id, date);
  CREATE INDEX IF NOT EXISTS idx_proofs_duo ON proofs(duo_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_potd_assignments_duo_date ON potd_assignments(duo_id, date);
  CREATE INDEX IF NOT EXISTS idx_potd_questions_duo ON potd_questions(duo_id);
  CREATE INDEX IF NOT EXISTS idx_cheers_to_user ON cheers(to_user_id, seen);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_duo_feature_date ON ai_usage_daily(duo_id, feature, date);
  CREATE INDEX IF NOT EXISTS idx_ai_audit_actor ON ai_audit_events(actor_user_id, created_at);
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
if (!userColumns.some((column) => column.name === "session_token_hash")) {
  db.exec("ALTER TABLE users ADD COLUMN session_token_hash TEXT");
}

const migrateSessions = db.transaction(() => {
  const users = db
    .prepare("SELECT id, session_token, session_token_hash FROM users")
    .all() as { id: string; session_token: string; session_token_hash: string | null }[];
  const update = db.prepare("UPDATE users SET session_token = ?, session_token_hash = ? WHERE id = ?");
  for (const user of users) {
    const tokenHash = user.session_token_hash || hashSessionToken(user.session_token);
    update.run(tokenHash, tokenHash, user.id);
  }
});
migrateSessions();
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_session_token_hash ON users(session_token_hash)");
