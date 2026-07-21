import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const command = process.argv.slice(2);
const unsafeCommandNames = new Set(["cmd", "cmd.exe", "powershell", "powershell.exe", "pwsh", "pwsh.exe"]);

if (command.length === 0 || command[0] === "--") {
  console.error("Usage: npm run harness:isolated -- <command> [args...]");
  process.exit(1);
}

const commandName = command[0].split(/[\\/]/).at(-1).toLowerCase();
if (unsafeCommandNames.has(commandName)) {
  console.error("Command interpreters are rejected by harness:isolated as a safety boundary.");
  process.exit(1);
}
if (commandName.endsWith(".cmd") || commandName.endsWith(".bat")) {
  console.error("Windows batch launchers are rejected by harness:isolated as a safety boundary.");
  process.exit(1);
}

const dataDir = await mkdtemp(join(tmpdir(), "duogrow-harness-"));
const env = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => name.toUpperCase() !== "ANTHROPIC_API_KEY"),
);
env.DATA_DIR = dataDir;
env.DEMO_FAKE_AI = "1";

console.error(`Created isolated harness data directory: ${dataDir}`);

const npmExecPath = Object.entries(process.env).find(
  ([name]) => name.toLowerCase() === "npm_execpath",
)?.[1];
const child = process.platform === "win32" && commandName === "npm" && npmExecPath
  ? spawn(process.execPath, [npmExecPath, ...command.slice(1)], { env, stdio: "inherit" })
  : spawn(command[0], command.slice(1), { env, stdio: "inherit" });
child.once("error", (error) => {
  console.error(`Could not run ${command[0]}: ${error.message}`);
  process.exitCode = 1;
});
child.once("close", (code) => {
  process.exitCode = code ?? 1;
});
