# Codex harness task brief

Copy this template for a nontrivial task before creating its ledger.

```md
# <task title>

## Outcome

<User-visible behavior to deliver.>

## Scope and ownership

- Writer: `duogrow-implementer`
- Owned files: `<explicit paths or a bounded directory>`
- Out of scope: `<paths or behavior>`

## Scout evidence

- Scout: `duogrow-scout`
- Relevant paths and flow:
- Risks and open questions:

## Acceptance criteria

- [ ]

## Required review and verification

- Reviewer: `duogrow-reviewer` (read-only)
- Verifier: `duogrow-verifier` (read-only)
- Focused test or smoke plan:
- Standard gate: `npm run verify`
- Isolated command, if data can be written:
  `npm run harness:isolated -- <command>`

## Permission checkpoint

Request fresh permission before deployment, secrets, public API, or a data reset.

## Handoff requirements

Record commands and exit codes, coverage, data path, findings, commits, and
residual risks in `.agent-state/<id>/status.md`.
```
