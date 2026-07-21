# Task 5 — Proof upload submission guard

## Scope

Owned changes are limited to `web/src/screens/Upload.tsx` and
`web/src/screens/Upload.test.tsx`. The pre-existing recent-proofs recovery
test and retry behavior were preserved.

## TDD evidence

Two UI tests were written before changing `Upload.tsx`:

1. A real file-input selection starts a deferred `api.uploadProof` request;
   two Verify clicks result in one API call and a disabled Verify button.
2. A successful upload schedules result navigation; unmounting clears that
   pending timeout.

The initial focused test run was RED: Verify was not disabled, and unmount did
not call `clearTimeout`. After the minimal implementation, the focused suite
was GREEN: 3/3 tests passed.

## Implementation

- Added `resultTimerRef`, with unmount cleanup that clears a pending result
  navigation timeout.
- Added an early return when verification is already in progress.
- Disabled Verify, Change photo, module-choice chips, and recent proof
  thumbnail navigation during analysis.
- Kept the existing 1.8-second minimum analysis duration and failure toast.
- Did not change the proof-upload API contract or the recent-proofs recovery
  retry path.

## Verification

- `npm --prefix web run test -- src/screens/Upload.test.tsx` — pass (3 tests)
- `npm --prefix web run test` — pass (5 files, 19 tests)
- `npm run typecheck` — pass
- `npm --prefix web run lint` — pass, with an existing Fast Refresh warning in
  `src/components/Toast.tsx`
- `npm run build` — pass
- `git diff --check` — pass

The PowerShell command stream printed a trailing `tsc is not recognized` line
after successful builds, but each requested command returned exit code 0 and
the direct web typecheck (`npm --prefix web run typecheck`) also passed.

## Follow-up: post-unmount upload continuation

Reviewer feedback identified that clearing an already-created timer did not
stop a still-pending upload from scheduling a new navigation timer after the
screen unmounted.

### TDD evidence

The timer implementation-detail assertion was replaced with a behavior-level
test. It starts a deferred upload, unmounts the screen, resolves the upload,
advances the analysis timer, and asserts that the mocked navigation function
never receives `/verify/proof-1`.

This test was RED before the fix: navigation was called once with
`/verify/proof-1`. It is GREEN after the fix.

### Implementation

- Added an effect-managed `isMountedRef`.
- The post-upload success continuation returns before scheduling navigation
  when the screen is unmounted.
- The failure continuation returns before setting state or showing a toast
  when unmounted.
- Existing cleanup for a timer created before unmount remains in place.

### Follow-up verification

- Focused Upload suite — pass (3 tests)
- Full web test suite — pass (5 files, 19 tests)
- `npm run typecheck` — pass
- `npm --prefix web run lint` — pass with the existing `Toast.tsx` warning
- `npm run build` — pass
- `git diff --check` — pass
