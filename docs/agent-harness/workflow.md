# Harness workflow

## 1. Create the task brief and ledger

State the desired behavior, acceptance criteria, file ownership, validation,
and the actions that require user permission. Check the installation, then make
an ignored run record:

```bash
npm run harness:doctor
npm run harness:run -- --id <lowercase-id>
```

The ledger is `.agent-state/<id>/status.md`. It is intentionally ignored and
will not be overwritten by the run command.

## 2. Gather evidence and assign ownership

`duogrow-scout` investigates the relevant paths and reports evidence, flow,
open questions, and risks without editing. Use that evidence to give one
`duogrow-implementer` a bounded, non-overlapping file set. Do not assign the
same file to more than one writer.

## 3. Implement, review, and verify

The implementer changes only the assigned scope and records focused validation.
`duogrow-reviewer` then performs a read-only review with severity, file/line
evidence, suggested fixes, and residual risks. Reviewers do not edit.

After findings are resolved, `duogrow-verifier` runs the approved checks without
editing. The verifier report must list commands, each exit code, coverage
performed, data path, failures or gaps, and residual risks.

## 4. Handoff

Update the ledger with ownership, acceptance status, commands, data isolation,
findings, commits, residual risks, and next action. The user handoff should
link the changed files and summarize what was verified and what remains.

For role and safety details, see [README](README.md),
[quality gates](quality-gates.md), and [safety](safety.md).
