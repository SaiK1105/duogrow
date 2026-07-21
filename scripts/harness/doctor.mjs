import { access, readFile } from "node:fs/promises";

const expectedFiles = [
  ".codex/config.toml",
  ".codex/agents/duogrow-scout.toml",
  ".codex/agents/duogrow-implementer.toml",
  ".codex/agents/duogrow-reviewer.toml",
  ".codex/agents/duogrow-verifier.toml",
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
const expectedRoles = {
  "duogrow-scout": { readOnly: true },
  "duogrow-implementer": { readOnly: false },
  "duogrow-reviewer": { readOnly: true },
  "duogrow-verifier": { readOnly: false },
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
  const config = await readFile(new URL("../../.codex/config.toml", import.meta.url), "utf8");
  const requiredAgentSettings = [
    ["max_threads", "4"],
    ["max_depth", "1"],
    ["interrupt_message", "true"],
  ];
  const agentsHeader = /^\s*\[agents\]\s*$/m.exec(config);
  const agentsSection = agentsHeader
    ? config.slice(agentsHeader.index + agentsHeader[0].length).split(/^\s*\[/m, 1)[0]
    : undefined;
  if (agentsSection === undefined) {
    failures.push(".codex/config.toml is missing the [agents] section");
  }
  for (const [name, value] of requiredAgentSettings) {
    if (!new RegExp(`^\\s*${name}\\s*=\\s*${value}\\s*(?:#.*)?$`, "m").test(agentsSection)) {
      failures.push(`.codex/config.toml must set [agents].${name} = ${value}`);
    }
  }
  if (requiredAgentSettings.every(([name, value]) => new RegExp(`^\\s*${name}\\s*=\\s*${value}\\s*(?:#.*)?$`, "m").test(agentsSection))) {
    console.log("ok Codex agent delegation configuration");
  }
} catch (error) {
  failures.push(`could not read .codex/config.toml: ${error.message}`);
}

for (const [roleName, { readOnly }] of Object.entries(expectedRoles)) {
  try {
    const role = await readFile(new URL(`../../.codex/agents/${roleName}.toml`, import.meta.url), "utf8");
    const requiredMetadata = [
      [`name = \"${roleName}\"`, new RegExp(`^\\s*name\\s*=\\s*\"${roleName}\"\\s*$`, "m")],
      ["description", /^\s*description\s*=\s*"[^"\r\n]+"\s*$/m],
      ["model_reasoning_effort", /^\s*model_reasoning_effort\s*=\s*"[^"\r\n]+"\s*$/m],
      ["developer_instructions", /^\s*developer_instructions\s*=\s*"""[\s\S]*?"""\s*$/m],
    ];
    for (const [metadataName, pattern] of requiredMetadata) {
      if (!pattern.test(role)) {
        failures.push(`${roleName}.toml is missing required ${metadataName} metadata`);
      }
    }

    const sandboxSettings = [...role.matchAll(/^\s*sandbox_mode\s*=\s*"([^"]+)"\s*$/gm)].map((match) => match[1]);
    if (readOnly && (sandboxSettings.length !== 1 || sandboxSettings[0] !== "read-only")) {
      failures.push(`${roleName}.toml must set sandbox_mode = "read-only" exactly once`);
    }
    if (!readOnly && sandboxSettings.length > 0) {
      failures.push(`${roleName}.toml must not set sandbox_mode; only scout and reviewer are read-only`);
    }
    if (requiredMetadata.every(([, pattern]) => pattern.test(role)) && (!readOnly || sandboxSettings[0] === "read-only") && (readOnly || sandboxSettings.length === 0)) {
      console.log(`ok role: ${roleName}`);
    }
  } catch (error) {
    failures.push(`could not read .codex/agents/${roleName}.toml: ${error.message}`);
  }
}

try {
  const isolatedRun = await readFile(new URL("./isolated-run.mjs", import.meta.url), "utf8");
  const requiredContract = [
    'name.toUpperCase() !== "ANTHROPIC_API_KEY"',
    "env.DATA_DIR = dataDir",
    'env.DEMO_FAKE_AI = "1"',
    "unsafeCommandNames",
    "commandName.endsWith(\".cmd\") || commandName.endsWith(\".bat\")",
    "spawn(process.execPath",
  ];
  if (requiredContract.every((fragment) => isolatedRun.includes(fragment)) && !/shell\s*:\s*true/.test(isolatedRun)) {
    console.log("ok isolated-run safety contract");
  } else {
    failures.push("isolated-run must isolate data, reject command interpreters and batch launchers, and never use shell: true");
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
