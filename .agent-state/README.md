# Harness run ledger

`npm run harness:run -- --id <id>` creates an ignored run directory here.
Each `status.md` captures the run's scope, ownership, acceptance criteria,
commands and exit codes, isolated-data path, findings, commits, and handoff.

Run ledgers are intentionally local and must not contain secrets, sessions,
or default user-data paths. The harness does not create, reset, seed, or delete
application data; use `npm run harness:isolated -- <command>` when a command
needs a fresh temporary `DATA_DIR`.
