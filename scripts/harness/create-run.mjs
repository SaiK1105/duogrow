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
const runDirectory = fileURLToPath(new URL(`../../.agent-state/${id}/`, import.meta.url));
const statusPath = fileURLToPath(new URL(`../../.agent-state/${id}/status.md`, import.meta.url));

try {
  await access(runDirectory);
  console.error(`Refusing to overwrite existing harness run: ${id}`);
  process.exit(1);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

await mkdir(stateRoot, { recursive: true });
await mkdir(runDirectory);
await writeFile(
  statusPath,
  `# Harness run: ${id}\n\n## Scope\n\n- Summary:\n- Files owned:\n\n## Ownership\n\n- Writer:\n- Reviewer:\n- Verifier:\n\n## Acceptance criteria\n\n- [ ]\n\n## Commands\n\n- Command:\n- Exit code:\n\n## Data\n\n- Isolated data directory:\n- Default user data touched: no\n\n## Findings\n\n- \n\n## Commits\n\n- \n\n## Handoff\n\n- Status:\n- Residual risks:\n- Next action:\n`,
  { encoding: "utf8", flag: "wx" },
);

console.log(`Created harness run ledger: ${statusPath}`);
