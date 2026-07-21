# Accountability UI accessibility fix report

## Scope

Updated only the meal logger and Upload-screen accessibility behavior, together
with focused regression coverage. No API, server, or configuration files were
changed for this work.

## Changes delivered

- `MealLogSheet` now renders through a portal to `document.body`. While it is
  open, `#root` is made inert and its previous inert state is restored on close
  or unmount. The dialog itself is outside that inert subtree.
- Keyboard navigation is contained in the enabled controls of the meal dialog:
  Tab advances from the final control to Calories and Shift+Tab moves from
  Calories to the final control. Escape cancels the sheet.
- The Calories input exposes `aria-invalid="true"` whenever the calorie
  validation error is shown.
- Upload category chips expose their selected state using `aria-pressed`.
- Recent-proof buttons now have names such as `Morning run — high confidence`,
  so confidence is communicated without relying on the coloured band marker.
- The existing Today focus-restoration behavior is covered for both a
  successful save and Cancel.

## Test-first evidence

Before implementation, focused tests were added for Tab/Shift+Tab wrapping,
calorie invalid state, category pressed state, and recent-proof confidence
names. The targeted test command failed as expected for all four missing
behaviors. The new Escape test passed before the change because the component
already cancelled on Escape; the event handling was retained within the shared
keyboard handler.

Targeted red command:

```text
npm --prefix web test -- src/components/MealLogSheet.test.tsx src/screens/Upload.test.tsx src/screens/Today.test.tsx
```

After implementation, the same command passed: 3 files, 20 tests.

## Verification

| Command | Result |
| --- | --- |
| `npm --prefix web test` | Passed: 5 files, 24 tests |
| `npm run typecheck` | Passed: server and web TypeScript checks |
| `npm --prefix web run lint` | Passed with one pre-existing `Toast.tsx` Fast Refresh warning |
| `npm run build` | Passed: production Vite build completed |
| `git diff --check` | Passed: no whitespace errors |

## Worktree note

`server/package-lock.json` was already modified when this task began and was
left untouched.
