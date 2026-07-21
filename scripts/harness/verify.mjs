import { spawn } from "node:child_process";

const checks = [
  ["web tests", "npm", ["--prefix", "web", "run", "test"]],
  ["typecheck", "npm", ["run", "typecheck"]],
  ["web lint", "npm", ["--prefix", "web", "run", "lint"]],
  ["production build", "npm", ["run", "build"]],
  ["whitespace diff", "git", ["diff", "--check"]],
];

function commandForPlatform(command) {
  return process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(commandForPlatform(command), args, {
      shell: process.platform === "win32",
      stdio: "inherit",
    });

    child.once("error", (error) => {
      console.error(`Could not run ${command}: ${error.message}`);
      resolve(1);
    });
    child.once("close", (code) => resolve(code ?? 1));
  });
}

for (const [name, command, args] of checks) {
  console.log(`\n==> ${name}`);
  const exitCode = await run(command, args);
  if (exitCode !== 0) {
    console.error(`Verification stopped: ${name} exited with ${exitCode}.`);
    process.exit(exitCode);
  }
}

console.log("\nVerification passed.");
