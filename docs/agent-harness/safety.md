# Harness safety rules

## Permission boundaries

Do not automatically reset or seed normal data, terminate processes, commit,
push, deploy, mutate user data, or expose secrets. Deployment, secrets, public
API changes, and any data reset require fresh user permission, even when a task
otherwise has a passing quality gate.

Keep `.env` local. Do not record keys, credentials, real user data, or personal
data paths in the ledger, task brief, issue, or handoff.

## Isolated data

For smoke commands that may write data, use:

```bash
npm run harness:isolated -- <command>
```

It creates an OS-temporary `DATA_DIR`, sets `DEMO_FAKE_AI=1`, and removes every
casing of `ANTHROPIC_API_KEY` before starting the child process. It preserves
the child exit code and retains the temporary directory after the command, so
the verifier can report and inspect it. It never changes the normal data
directory.

## Windows batch restriction

On Windows, `.cmd` and `.bat` command inputs are rejected if any argument has
whitespace, quotes, or command-shell metacharacters. This prevents unsafe shell
interpretation; use a supported executable with safely separated arguments
instead.

## Ownership and reporting

One writer owns one file set. `duogrow-scout`, `duogrow-reviewer`, and
`duogrow-verifier` are read-only roles and do not modify implementation files.
The final verification report records commands and exit codes, coverage, the
isolated data path if used, and residual risks.
