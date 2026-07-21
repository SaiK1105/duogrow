# Quality gates

Run the smallest gate that honestly covers the change, plus any focused test
that proves the modified behavior.

| Change area | Required gate |
|---|---|
| UI-only | Focused web test + `npm run verify` |
| Route, SQLite, session, proof, verifier, or schema | Read-only reviewer + `npm run verify` + isolated-data smoke plan |
| Deployment, secrets, public API, or data reset | Stop and request fresh user permission |

## Standard verification

```bash
npm run verify
# equivalent CI entry point
npm run verify:ci
```

These run only web tests, typecheck, web lint, production build, and
`git diff --check` whitespace checks. They are not evidence that server behavior
or the paired-browser flow works.

## Current coverage limitation

Server integration tests and a tracked two-browser E2E suite are planned
coverage, not passing tests. For behavior involving the Hono routes, SQLite,
session headers, proof application, the verifier seam, or schema, write an
isolated-data smoke plan. Include exact commands, expected result, the temporary
data path, and the remaining gap in the verifier report.

For a cooperating smoke command that accepts `DATA_DIR`, use
[`npm run harness:isolated -- <command>`](safety.md#isolated-data). It is not a
sandbox; follow the safety permission boundary for normal or untrusted data.
The wrapper rejects command interpreters and `.cmd`/`.bat` launchers outright
as a safety boundary, not as a general secret or data barrier.
