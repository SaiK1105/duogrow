/**
 * Wipes all tables and seeds the exact demo state described in SPEC.md:
 * Sreya + Sai paired in one duo (invite code GROW42), 7 days of history
 * that lands the growth score in the mid-80s, a 6-day streak, a 12-question
 * POTD bank with 3 already solved, and today partially complete for both.
 *
 * The POTD pick for "today" is computed with the SAME deterministic
 * fnv1a(duoId:date) algorithm the API uses (see lib/potd.ts), so the id we
 * hand to "Two Sum" is chosen to land exactly on today's index — the seed
 * doesn't hardcode the outcome, it derives it.
 */
import { db } from "./db.js";
import { newId } from "./lib/ids.js";
import { hashSessionToken } from "./lib/session.js";
import { hashCredential } from "./lib/credentials.js";
import { lastNDays, timeToMinutes } from "./lib/dates.js";
import { fnv1a, ensureTodayAssignments } from "./lib/potd.js";
import { setStreak } from "./lib/streaks.js";
import { computeDuoGrowth } from "./lib/weeklyStats.js";
import { DEFAULT_USER_CONFIG, type EntryStatus, type ModuleName, type UserRow } from "./types.js";

const DUO_ID = "duo_demo_grow42";
const INVITE_CODE = "GROW42";
const SREYA_ID = "usr_demo_sreya";
const SAI_ID = "usr_demo_sai";
const SREYA_TOKEN = "demo-sreya";
const SAI_TOKEN = "demo-sai";
const SOURCE = "Striver SDE Sheet";

const now = new Date().toISOString();

// A deploy must never destroy real accounts. With --if-empty the seed becomes a
// first-boot bootstrap: it populates a blank database and does nothing to one
// that already holds users. Without the flag it stays the explicit, destructive
// demo reset that `npm run reset` relies on.
if (process.argv.includes("--if-empty")) {
  const existing = db.prepare<[], { count: number }>(`SELECT COUNT(*) AS count FROM users`).get();
  const userCount = existing?.count ?? 0;
  if (userCount > 0) {
    console.log(`Seed skipped — ${userCount} existing user(s). Run "npm run reset" to force a demo reset.`);
    process.exit(0);
  }
  console.log("No existing users; bootstrapping demo data...");
}

console.log("Wiping existing data...");
db.exec(`
  DELETE FROM cheers;
  DELETE FROM proofs;
  DELETE FROM potd_assignments;
  DELETE FROM daily_entries;
  DELETE FROM streaks;
  DELETE FROM potd_questions;
  DELETE FROM users;
  DELETE FROM duos;
`);

// --- Duo + users -----------------------------------------------------------

db.prepare(
  `INSERT INTO duos (id, name, invite_code, potd_mode, created_by, created_at) VALUES (?, ?, ?, 'same', ?, ?)`,
).run(DUO_ID, "Sreya & Sai", INVITE_CODE, SREYA_ID, now);

const insertUser = db.prepare(
  `INSERT INTO users (id, name, name_normalized, duo_id, session_token, session_token_hash, credential_salt, credential_hash, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const sreyaTokenHash = hashSessionToken(SREYA_TOKEN);
const saiTokenHash = hashSessionToken(SAI_TOKEN);
const sreyaCredential = await hashCredential("demo-sreya");
const saiCredential = await hashCredential("demo-sai");
insertUser.run(SREYA_ID, "Sreya", "sreya", DUO_ID, sreyaTokenHash, sreyaTokenHash, sreyaCredential.salt, sreyaCredential.hash, JSON.stringify(DEFAULT_USER_CONFIG), now);
insertUser.run(SAI_ID, "Sai", "sai", DUO_ID, saiTokenHash, saiTokenHash, saiCredential.salt, saiCredential.hash, JSON.stringify(DEFAULT_USER_CONFIG), now);

// --- Daily entries: 6 full prior days + today partially complete -----------

const days = lastNDays(7); // [today-6, ..., today-1, today]
const priorDays = days.slice(0, 6);
const todayStr = days[6];

const insertEntry = db.prepare(
  `INSERT INTO daily_entries (id, user_id, duo_id, date, module, status, value, target, detail_json, proof_id, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
);

function seedEntry(
  userId: string,
  date: string,
  module: ModuleName,
  status: EntryStatus,
  value: number | null,
  target: number | null,
  detail: unknown = null,
): void {
  insertEntry.run(newId("entry"), userId, DUO_ID, date, module, status, value, target, detail ? JSON.stringify(detail) : null, now);
}

const WAKE_TARGET = timeToMinutes(DEFAULT_USER_CONFIG.wake.target); // 390
const STUDY_TARGET = DEFAULT_USER_CONFIG.study.targetMinutes; // 120
const DIET_TARGET = DEFAULT_USER_CONFIG.diet.targetMax; // 2200
const TASKS_TARGET = DEFAULT_USER_CONFIG.tasks.target; // 6

// 6 near-perfect prior days for both partners. Tasks dip below target on one
// day each (still counted via the value/target ratio, not just done/pending).
const sreyaTaskCounts = [6, 6, 5, 6, 6, 6];
const saiTaskCounts = [6, 5, 6, 6, 5, 6];

priorDays.forEach((date, i) => {
  seedEntry(SREYA_ID, date, "wake", "done", timeToMinutes("06:15"), WAKE_TARGET, { time: "06:15" });
  seedEntry(SREYA_ID, date, "study", "done", 125, STUDY_TARGET);
  seedEntry(SREYA_ID, date, "workout", "done", 1, 1, { name: "Full body" });
  seedEntry(SREYA_ID, date, "diet", "done", 2000, DIET_TARGET);
  seedEntry(SREYA_ID, date, "tasks", sreyaTaskCounts[i] >= TASKS_TARGET ? "done" : "pending", sreyaTaskCounts[i], TASKS_TARGET);

  seedEntry(SAI_ID, date, "wake", "done", timeToMinutes("06:25"), WAKE_TARGET, { time: "06:25" });
  seedEntry(SAI_ID, date, "study", "done", 130, STUDY_TARGET);
  seedEntry(SAI_ID, date, "workout", "done", 1, 1, { name: "Push/Pull/Legs" });
  seedEntry(SAI_ID, date, "diet", "done", 2050, DIET_TARGET);
  seedEntry(SAI_ID, date, "tasks", saiTaskCounts[i] >= TASKS_TARGET ? "done" : "pending", saiTaskCounts[i], TASKS_TARGET);
});

// Today: partially complete, per SPEC.md's demo script.
seedEntry(SREYA_ID, todayStr, "wake", "done", timeToMinutes("06:10"), WAKE_TARGET, { time: "06:10" });
seedEntry(SREYA_ID, todayStr, "study", "pending", 90, STUDY_TARGET); // 1.5 / 2h
seedEntry(SREYA_ID, todayStr, "tasks", "pending", 4, TASKS_TARGET); // 4 / 6
// Sreya hasn't touched workout/diet yet today — left unset (pending by absence).

seedEntry(SAI_ID, todayStr, "wake", "done", timeToMinutes("06:20"), WAKE_TARGET, { time: "06:20" });
seedEntry(SAI_ID, todayStr, "diet", "pending", 1350, DIET_TARGET); // 1350 / 1900 kcal
seedEntry(SAI_ID, todayStr, "workout", "pending", null, 1); // explicitly NOT done
seedEntry(SAI_ID, todayStr, "study", "pending", 30, STUDY_TARGET);
seedEntry(SAI_ID, todayStr, "tasks", "pending", 3, TASKS_TARGET);

// --- Streak: 6, last advanced yesterday -------------------------------------

setStreak(DUO_ID, 6, 6, priorDays[priorDays.length - 1]);

// --- POTD bank: 12 questions, engineered so today's deterministic pick is
// "Two Sum" -------------------------------------------------------------

const TWO_SUM = {
  title: "Two Sum",
  topic: "Arrays & Hashing",
  difficulty: "easy" as const,
  body: "Given an array of integers nums and a target, return the indices of the two numbers that add up to target. Assume exactly one solution exists and you may not use the same element twice.",
};

const OTHER_UNSOLVED = [
  {
    title: "Longest Substring Without Repeating Characters",
    topic: "Sliding Window",
    difficulty: "medium" as const,
    body: "Given a string, find the length of the longest substring without repeating characters.",
  },
  {
    title: "Binary Tree Level Order Traversal",
    topic: "Trees",
    difficulty: "medium" as const,
    body: "Given the root of a binary tree, return the level-order traversal of its node values (left to right, level by level).",
  },
  {
    title: "Kth Largest Element in an Array",
    topic: "Heap",
    difficulty: "medium" as const,
    body: "Find the kth largest element in an unsorted array. Note: it's the kth largest in sorted order, not the kth distinct element.",
  },
  {
    title: "Course Schedule",
    topic: "Graphs",
    difficulty: "medium" as const,
    body: "There are numCourses courses with prerequisite pairs. Determine if it's possible to finish all courses given the prerequisites (i.e. the graph has no cycle).",
  },
  {
    title: "Word Break",
    topic: "Dynamic Programming",
    difficulty: "medium" as const,
    body: "Given a string s and a dictionary of strings wordDict, return true if s can be segmented into a space-separated sequence of dictionary words.",
  },
  {
    title: "Trapping Rain Water",
    topic: "Two Pointers",
    difficulty: "hard" as const,
    body: "Given n non-negative integers representing an elevation map, compute how much water it can trap after raining.",
  },
  {
    title: "Merge k Sorted Lists",
    topic: "Heap",
    difficulty: "hard" as const,
    body: "You are given an array of k linked-lists, each sorted in ascending order. Merge all the linked-lists into one sorted linked-list.",
  },
  {
    title: "N-Queens",
    topic: "Backtracking",
    difficulty: "hard" as const,
    body: "Place n queens on an n x n chessboard such that no two queens attack each other. Return all distinct solutions.",
  },
];

const SOLVED_QUESTIONS = [
  {
    title: "Reverse Linked List",
    topic: "Linked List",
    difficulty: "easy" as const,
    body: "Given the head of a singly linked list, reverse the list and return the new head.",
  },
  {
    title: "Valid Parentheses",
    topic: "Stack",
    difficulty: "easy" as const,
    body: "Given a string containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid (every bracket closes in the right order).",
  },
  {
    title: "Merge Intervals",
    topic: "Arrays",
    difficulty: "medium" as const,
    body: "Given an array of intervals, merge all overlapping intervals and return an array of the non-overlapping intervals covering all the input intervals.",
  },
];

// 12 ids, sorted lexicographically — the same order pickTodaysQuestion() uses.
const allIds = Array.from({ length: 12 }, () => newId("potd_q")).sort();
const poolIds = allIds.slice(0, 9); // will remain unsolved -> today's candidate pool
const solvedSlotIds = allIds.slice(9); // 3 ids reserved for the "already solved" questions

const hash = fnv1a(`${DUO_ID}:${todayStr}`);
const twoSumIndex = hash % poolIds.length;
const twoSumId = poolIds[twoSumIndex];
const remainingPoolIds = poolIds.filter((id) => id !== twoSumId);

const insertQuestion = db.prepare(
  `INSERT INTO potd_questions (id, duo_id, source, topic, difficulty, title, body, answer, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
);

insertQuestion.run(twoSumId, DUO_ID, SOURCE, TWO_SUM.topic, TWO_SUM.difficulty, TWO_SUM.title, TWO_SUM.body, now);
remainingPoolIds.forEach((id, i) => {
  const q = OTHER_UNSOLVED[i];
  insertQuestion.run(id, DUO_ID, SOURCE, q.topic, q.difficulty, q.title, q.body, now);
});
solvedSlotIds.forEach((id, i) => {
  const q = SOLVED_QUESTIONS[i];
  insertQuestion.run(id, DUO_ID, SOURCE, q.topic, q.difficulty, q.title, q.body, now);
});

// 3 prior days solved (by both partners), 3 prior days assigned-but-unsolved.
const insertAssignment = db.prepare(
  `INSERT INTO potd_assignments (id, duo_id, user_id, question_id, date, mode, status, proof_id, updated_at)
   VALUES (?, ?, ?, ?, ?, 'same', ?, NULL, ?)`,
);

const solvedDays = priorDays.slice(0, 3);
const unsolvedPastDays = priorDays.slice(3);
const fallbackUnsolvedQuestionId = remainingPoolIds[0];

solvedDays.forEach((date, i) => {
  const questionId = solvedSlotIds[i];
  for (const userId of [SREYA_ID, SAI_ID]) {
    insertAssignment.run(newId("potd_a"), DUO_ID, userId, questionId, date, "solved", now);
  }
});
unsolvedPastDays.forEach((date) => {
  for (const userId of [SREYA_ID, SAI_ID]) {
    insertAssignment.run(newId("potd_a"), DUO_ID, userId, fallbackUnsolvedQuestionId, date, "assigned", now);
  }
});

// Today's assignment is created via the same path the API uses, so the pick
// is provably identical to what GET /api/potd/today will return.
const todaysQuestion = ensureTodayAssignments(DUO_ID, todayStr);

// --- Sanity check: confirm the growth score lands in SPEC's ~85-90 window --

const members = db.prepare<[string], UserRow>(`SELECT * FROM users WHERE duo_id = ?`).all(DUO_ID);
const { growthScore, subscores } = computeDuoGrowth(DUO_ID, members, 6, days);

console.log("");
console.log("DuoGrow demo seed complete.");
console.log(`  Duo: Sreya & Sai  |  invite code: ${INVITE_CODE}`);
console.log("  Demo-only sign-in secrets: Sreya / demo-sreya, Sai / demo-sai");
console.log(`  Streak: 6 (last advanced ${priorDays[priorDays.length - 1]})`);
console.log(`  Today's POTD pick: "${todaysQuestion?.title ?? "none"}"`);
console.log(
  `  Growth score: ${growthScore} (discipline ${subscores.discipline}, mind ${subscores.mind}, health ${subscores.health}, consistency ${subscores.consistency})`,
);
