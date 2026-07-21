import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const command = process.argv.slice(2);

if (command.length === 0 || command[0] === "--") {
  console.error("Usage: npm run harness:isolated -- <command> [args...]");
  process.exit(1);
}

const dataDir = await mkdtemp(join(tmpdir(), "duogrow-harness-"));
const env = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => name.toUpperCase() !== "ANTHROPIC_API_KEY"),
);
env.DATA_DIR = dataDir;
env.DEMO_FAKE_AI = "1";

console.error(`Created isolated harness data directory: ${dataDir}`);

const commandName = command[0].toLowerCase();
const npmExecPath = Object.entries(process.env).find(
  ([name]) => name.toLowerCase() === "npm_execpath",
)?.[1];
const child = process.platform === "win32" && (commandName === "npm" || commandName === "npm.cmd") && npmExecPath
  ? spawn(process.execPath, [npmExecPath, ...command.slice(1)], { env, stdio: "inherit" })
  : spawn(command[0], command.slice(1), { env, stdio: "inherit" });
child.once("error", (error) => {
  console.error(`Could not run ${command[0]}: ${error.message}`);
  process.exitCode = 1;
});
child.once("close", (code) => {
  process.exitCode = code ?? 1;
});
