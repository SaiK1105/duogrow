import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const command = process.argv.slice(2).filter((argument, index) => index !== 0 || argument !== "--");

if (command.length === 0) {
  console.error("Usage: npm run harness:isolated -- <command> [args...]");
  process.exit(1);
}

const dataDir = await mkdtemp(join(tmpdir(), "duogrow-harness-"));
const env = { ...process.env, DATA_DIR: dataDir, DEMO_FAKE_AI: "1" };
delete env.ANTHROPIC_API_KEY;

console.error(`Created isolated harness data directory: ${dataDir}`);

const child = spawn(command[0], command.slice(1), { env, stdio: "inherit" });
child.once("error", (error) => {
  console.error(`Could not run ${command[0]}: ${error.message}`);
  process.exitCode = 1;
});
child.once("close", (code) => {
  process.exitCode = code ?? 1;
});
