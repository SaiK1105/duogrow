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

It gives a cooperating child command an OS-temporary `DATA_DIR`, sets
`DEMO_FAKE_AI=1`, and removes every casing of `ANTHROPIC_API_KEY` before starting
the child process. It preserves the child exit code and retains the temporary
directory after the command, so the verifier can report and inspect it.

This is not a sandbox. It does not remove other secrets, and an arbitrary
command can ignore `DATA_DIR` or otherwise reach normal or untrusted data.
Request explicit permission before running a command that could touch that data.

## Command-interpreter boundary

`harness:isolated` rejects `cmd`, `cmd.exe`, `powershell`,
`powershell.exe`, `pwsh`, and `pwsh.exe`, case-insensitively. It also
rejects every `.cmd` and `.bat` launcher outright. This is a safety boundary
against command-interpreter bypass: the wrapper never invokes a command shell.
Use a normal executable with separately supplied arguments instead.

## Ownership and reporting

One writer owns one file set. `duogrow-scout` and `duogrow-reviewer` have
sandbox-enforced read-only access. `duogrow-verifier` does not edit files, but
inherits the caller's permissions to run commands. The final verification report
records commands and exit codes, coverage, the isolated data path if used, and
residual risks.
