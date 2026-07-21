import { access, readFile } from "node:fs/promises";

const expectedFiles = [
  "scripts/harness/verify.mjs",
  "scripts/harness/doctor.mjs",
  "scripts/harness/isolated-run.mjs",
  "scripts/harness/create-run.mjs",
  ".agent-state/.gitignore",
  ".agent-state/README.md",
];
const expectedScripts = {
  test: "npm --prefix web run test",
  lint: "npm --prefix web run lint",
  verify: "node scripts/harness/verify.mjs",
  "verify:ci": "npm run verify",
  "harness:doctor": "node scripts/harness/doctor.mjs",
  "harness:isolated": "node scripts/harness/isolated-run.mjs",
  "harness:run": "node scripts/harness/create-run.mjs",
};

async function fileExists(relativePath) {
  try {
    await access(new URL(`../../${relativePath}`, import.meta.url));
    return true;
  } catch {
    return false;
  }
}

const failures = [];

for (const relativePath of expectedFiles) {
  if (await fileExists(relativePath)) {
    console.log(`ok file: ${relativePath}`);
  } else {
    failures.push(`missing file: ${relativePath}`);
  }
}

let packageJson;
try {
  packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
} catch (error) {
  failures.push(`could not read package.json: ${error.message}`);
}

for (const [name, command] of Object.entries(expectedScripts)) {
  if (packageJson?.scripts?.[name] === command) {
    console.log(`ok script: ${name}`);
  } else {
    failures.push(`missing or unexpected script: ${name}`);
  }
}

try {
  const isolatedRun = await readFile(new URL("./isolated-run.mjs", import.meta.url), "utf8");
  const requiredContract = [
    'name.toUpperCase() !== "ANTHROPIC_API_KEY"',
    "env.DATA_DIR = dataDir",
    'env.DEMO_FAKE_AI = "1"',
    "shell: isWindowsBatchCommand",
    "unsafeBatchCharacter.test(argument)",
    "unsafeBatchQuotingOrWhitespace.test(argument)",
  ];
  if (requiredContract.every((fragment) => isolatedRun.includes(fragment))) {
    console.log("ok isolated-run safety contract");
  } else {
    failures.push("isolated-run is missing the required environment safety contract");
  }
} catch (error) {
  failures.push(`could not inspect isolated-run: ${error.message}`);
}

try {
  const stateIgnore = await readFile(new URL("../../.agent-state/.gitignore", import.meta.url), "utf8");
  const patterns = new Set(stateIgnore.split(/\r?\n/).map((line) => line.trim()));
  if (patterns.has("*") && patterns.has("!.gitignore") && patterns.has("!README.md")) {
    console.log("ok agent-state ignore contract");
  } else {
    failures.push(".agent-state/.gitignore must ignore run state and preserve README.md and .gitignore");
  }
} catch (error) {
  failures.push(`could not inspect .agent-state/.gitignore: ${error.message}`);
}

if (failures.length > 0) {
  console.error("Harness doctor found problems:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Harness doctor passed.");
}
