# Codex Agentic Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give DuoGrow a project-local Codex harness with dedicated agents, safe run isolation, repeatable verification, and durable operating guidance.

**Architecture:** Codex TOML files define narrow roles. Node scripts expose a cross-platform verification and safety surface. Documentation connects those pieces to a required lifecycle, while CI runs the same gate on every pushed change.

**Tech Stack:** Codex configuration (TOML), Node.js 22 ESM scripts, npm, GitHub Actions, Markdown.

## Global Constraints

- Do not add runtime OpenAI/Codex dependencies or end-user AI features.
- Do not pin a project-default model, sandbox mode, approval policy, or personal
  account setting. Only the explicitly read-only scout and reviewer may enforce
  `sandbox_mode = "read-only"`; implementer and verifier inherit user permissions.
- Harness data must live under the OS temporary directory, not OneDrive, this repo, or `~/.duogrow`.
- Isolated child runs set `DEMO_FAKE_AI=1` and remove `ANTHROPIC_API_KEY`.
- **Security-driven deviation:** generic Windows batch support is intentionally
  not implemented. `harness:isolated` rejects command interpreters and every
  `.cmd`/`.bat` launcher outright, so it never invokes a command shell. This
  is a narrow command-launch safety boundary, not a sandbox or a general
  secret/data barrier.
- No automatic reset, seed, process stop, commit, push, deployment, or user-data mutation.
- `npm run verify` covers only web tests, typecheck, web lint, production build, and `git diff --check`.

---

### Task 1: Add project-scoped Codex roles

**Files:**
- Create: `.codex/config.toml`
- Create: `.codex/agents/duogrow-scout.toml`
- Create: `.codex/agents/duogrow-implementer.toml`
- Create: `.codex/agents/duogrow-reviewer.toml`
- Create: `.codex/agents/duogrow-verifier.toml`

**Produces:** Four selectable roles plus shallow, predictable agent fan-out.

- [ ] **Step 1: Write role files with stable metadata and clear authority**

```toml
name = "duogrow-reviewer"
description = "Read-only review of DuoGrow changes for correctness, security, and missing validation."
sandbox_mode = "read-only"
model_reasoning_effort = "high"
developer_instructions = """
Do not edit files. Report actionable findings with severity, file/line evidence,
a suggested fix, exact checks examined, and residual risk.
"""
```

Use equivalent explicit contracts for a read-only scout, a bounded implementer, and a verifier that runs commands but does not edit.

- [ ] **Step 2: Add only safe project defaults**

```toml
[agents]
max_threads = 4
max_depth = 1
interrupt_message = true
```

- [ ] **Step 3: Validate the contracts and commit**

Run: `Get-ChildItem .codex/agents -Filter '*.toml' | Measure-Object`

Expected: four TOML files, each with `name`, `description`, and `developer_instructions`; scout and reviewer are read-only.

```powershell
git add .codex
git commit -m "feat: add Codex project agents"
```

### Task 2: Add the safe root command surface

**Files:**
- Create: `scripts/harness/verify.mjs`
- Create: `scripts/harness/doctor.mjs`
- Create: `scripts/harness/isolated-run.mjs`
- Create: `scripts/harness/create-run.mjs`
- Create: `.agent-state/.gitignore`
- Create: `.agent-state/README.md`
- Modify: `package.json`

**Produces:** `npm run verify`, `npm run harness:doctor`, `npm run harness:isolated -- <command>`, and `npm run harness:run -- --id <id>`.

- [ ] **Step 1: Establish the expected failure before implementation**

Run:

```powershell
npm run harness:doctor
npm run harness:run -- --id harness-smoke
npm run harness:isolated -- node -e "console.log(process.env.DEMO_FAKE_AI)"
```

Expected: all three fail because the commands do not exist.

- [ ] **Step 2: Add the package scripts**

```json
{
  "scripts": {
    "test": "npm --prefix web run test",
    "lint": "npm --prefix web run lint",
    "verify": "node scripts/harness/verify.mjs",
    "verify:ci": "npm run verify",
    "harness:doctor": "node scripts/harness/doctor.mjs",
    "harness:isolated": "node scripts/harness/isolated-run.mjs",
    "harness:run": "node scripts/harness/create-run.mjs"
  }
}
```

- [ ] **Step 3: Implement a sequential verification runner**

```js
const checks = [
  ["web tests", "npm", ["--prefix", "web", "run", "test"]],
  ["typecheck", "npm", ["run", "typecheck"]],
  ["web lint", "npm", ["--prefix", "web", "run", "lint"]],
  ["production build", "npm", ["run", "build"]],
  ["whitespace diff", "git", ["diff", "--check"]],
];
```

Use `spawn` with inherited stdio, use Node's npm CLI entry point for a plain
`npm` command on Windows, and stop at the first nonzero exit. Do not support
generic `.cmd`/`.bat` launchers: reject them and command interpreters before
creating isolated data, as the security-driven deviation above requires.

- [ ] **Step 4: Implement isolated-child and ledger semantics**

```js
const dataDir = await mkdtemp(join(tmpdir(), "duogrow-harness-"));
const env = { ...process.env, DATA_DIR: dataDir, DEMO_FAKE_AI: "1" };
delete env.ANTHROPIC_API_KEY;
```

Reject a missing command after `--`. Accept only ledger IDs matching `^[a-z0-9][a-z0-9-]{2,63}$`, refuse overwrites, and write scope, ownership, acceptance criteria, commands, data, findings, commits, and handoff fields. Ignore run directories but track the state README and `.gitignore`.

- [ ] **Step 5: Validate the safe surface and commit**

Run:

```powershell
npm run harness:doctor
npm run harness:run -- --id harness-smoke
npm run harness:isolated -- node -e "if (process.env.DEMO_FAKE_AI !== '1' || !process.env.DATA_DIR || process.env.ANTHROPIC_API_KEY) process.exit(1)"
git check-ignore .agent-state/harness-smoke/status.md
```

Expected: all commands exit zero; the created status file is ignored.

```powershell
git add package.json scripts/harness .agent-state
git commit -m "feat: add safe Codex harness commands"
```

### Task 3: Publish the workflow, safety rules, and quality gates

**Files:**
- Create: `docs/agent-harness/README.md`
- Create: `docs/agent-harness/workflow.md`
- Create: `docs/agent-harness/quality-gates.md`
- Create: `docs/agent-harness/safety.md`
- Create: `docs/agent-harness/task-template.md`
- Modify: `AGENTS.md`
- Modify: `HANDOVER.md`

**Consumes:** task agents from Task 1 and commands from Task 2.

**Produces:** a self-contained contributor path from task intake through verified handoff.

- [ ] **Step 1: Document one mandatory lifecycle**

```text
Task brief → scout evidence → plan and file ownership → implementation →
read-only review → verification → ignored state ledger → user handoff.
```

State that reviewers do not edit, one writer owns one file set, and verifier output includes commands, exit codes, coverage, data path, and residual risks.

- [ ] **Step 2: Document gates with honest coverage**

```text
UI-only: focused test + npm run verify
Route, SQLite, session, proof, verifier, schema: reviewer + npm run verify + isolated-data smoke plan
Deployment, secrets, public API, data reset: stop and request fresh permission
```

Explicitly name server integration tests and two-browser E2E as planned coverage, not passing tests.

- [ ] **Step 3: Link the harness from `AGENTS.md` and `HANDOVER.md`**

Add a concise `AGENTS.md` section that routes nontrivial work through the state ledger and preserves current API-port/static-server gotchas. Update the human handover with exact harness commands and named-agent examples.

- [ ] **Step 4: Validate references and commit**

Run:

```powershell
rg -n "duogrow-(scout|implementer|reviewer|verifier)|harness:(doctor|isolated|run)|npm run verify" AGENTS.md HANDOVER.md docs/agent-harness
npm run harness:doctor
```

Expected: all referenced agents and scripts exist; doctor exits zero.

```powershell
git add AGENTS.md HANDOVER.md docs/agent-harness
git commit -m "docs: add Codex harness workflow"
```

### Task 4: Enforce the shared gate in CI

**Files:**
- Create: `.github/workflows/quality.yml`

**Produces:** a Node 22 workflow that installs all three locked dependency graphs and runs `npm run verify:ci` for push and pull-request events.

- [ ] **Step 1: Add the workflow**

```yaml
name: Quality
on:
  pull_request:
  push:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm --prefix server ci
      - run: npm --prefix web ci
      - run: npm run verify:ci
```

- [ ] **Step 2: Run the same gate locally and commit**

Run: `npm run verify:ci`

Expected: web tests, typecheck, lint, production build, and diff check pass.

```powershell
git add .github/workflows/quality.yml
git commit -m "ci: verify Codex quality gate"
```

### Task 5: Completion audit

**Files:**
- Modify: `docs/superpowers/plans/2026-07-22-codex-agentic-harness.md`

- [ ] **Step 1: Request independent read-only review**

Ask a reviewer to examine `.codex`, Node scripts, agent state policy, safety docs, and CI. Fix every Critical or Important finding before proceeding.

- [ ] **Step 2: Run final harness and quality gates**

```powershell
npm run harness:doctor
npm run harness:isolated -- node -e "if (process.env.DEMO_FAKE_AI !== '1' || !process.env.DATA_DIR || process.env.ANTHROPIC_API_KEY) process.exit(1)"
npm run verify
git diff --check 7a0930f..HEAD
git status --short
git ls-files .agent-state
```

Expected: every command exits zero, the worktree is clean, and only `.agent-state/README.md` plus `.agent-state/.gitignore` are tracked under the state directory.

- [ ] **Step 3: Mark completed tasks and commit the final ledger**

```powershell
git add docs/superpowers/plans/2026-07-22-codex-agentic-harness.md
git commit -m "docs: record Codex harness validation"
```
