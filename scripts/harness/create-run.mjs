import { access, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const idPattern = /^[a-z0-9][a-z0-9-]{2,63}$/;
const args = process.argv.slice(2);

if (args.length !== 2 || args[0] !== "--id" || !idPattern.test(args[1])) {
  console.error("Usage: npm run harness:run -- --id <lowercase-id>");
  console.error("IDs must match ^[a-z0-9][a-z0-9-]{2,63}$.");
  process.exit(1);
}

const id = args[1];
const stateRoot = fileURLToPath(new URL("../../.agent-state/", import.meta.url));
const runDirectory = fileURLToPath(new URL("../../.agent-state/" + id + "/", import.meta.url));
const statusPath = fileURLToPath(new URL("../../.agent-state/" + id + "/status.md", import.meta.url));
const ledger = [
  "# Harness run: " + id,
  "",
  "## Scope",
  "",
  "- Summary:",
  "- Files owned:",
  "",
  "## Scout evidence",
  "",
  "- Relevant paths:",
  "- Execution flow:",
  "- Open questions:",
  "",
  "## Ownership",
  "",
  "- Writer:",
  "- Reviewer:",
  "- Verifier:",
  "",
  "## Acceptance criteria",
  "",
  "- [ ]",
  "",
  "## Commands",
  "",
  "- Command:",
  "- Exit code:",
  "",
  "## Data",
  "",
  "- Isolated data directory:",
  "- Default user data touched: no",
  "",
  "## Findings",
  "",
  "- ",
  "",
  "## Commits",
  "",
  "- ",
  "",
  "## Handoff",
  "",
  "- Status:",
  "- Residual risks:",
  "- Next action:",
  "",
].join("\n");

try {
  await access(runDirectory);
  console.error("Refusing to overwrite existing harness run: " + id);
  process.exit(1);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

await mkdir(stateRoot, { recursive: true });
await mkdir(runDirectory);
await writeFile(statusPath, ledger, { encoding: "utf8", flag: "wx" });

console.log("Created harness run ledger: " + statusPath);
