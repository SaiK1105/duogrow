# DuoGrow Codex Agentic Harness

This harness makes nontrivial contributor work traceable without putting demo
data, secrets, or a live AI key at risk.

## Required lifecycle

```text
Task brief → scout evidence → plan and file ownership → implementation →
read-only review → verification → ignored state ledger → user handoff.
```

One writer owns one explicitly named file set. The reviewer and verifier are
read-only: they report findings and command results, never implementation edits.
The verifier handoff includes every command and exit code, coverage performed,
the data path used, and residual risks.

## Start here

```bash
npm run harness:doctor
npm run harness:run -- --id <lowercase-id>
```

The run command writes `.agent-state/<id>/status.md`. This state is ignored by
Git and the command refuses to overwrite an existing run, so use a new ID for
each attempt.

- [Workflow](workflow.md) — role sequence, ownership, and ledger use.
- [Quality gates](quality-gates.md) — the checks required by change type.
- [Safety](safety.md) — isolated data and permission boundaries.
- [Task template](task-template.md) — a ready-to-fill task brief.

The agents are `duogrow-scout`, `duogrow-implementer`, `duogrow-reviewer`, and
`duogrow-verifier`.
