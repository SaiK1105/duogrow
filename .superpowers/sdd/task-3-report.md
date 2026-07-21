# Task 3 — Today meal-sheet integration and mutation serialization

## TDD evidence

### RED

Created `web/src/screens/Today.test.tsx` before production changes. The tests
mock `api.today` and `api.updateModule`, then render `Today` with its real
`MemoryRouter` and `ToastProvider`.

Ran:

```text
npm --prefix web run test -- src/screens/Today.test.tsx
```

The initial run failed as expected:

- The meal-flow test could not find the `500 calories` quick-add control after
  pressing `+ Log meal`; the old implementation invoked `window.prompt`.
- The deferred Study mutation test observed two `api.updateModule` calls after
  two rapid `+30m` clicks, proving there was no pending-mutation guard.

### GREEN

`Today` now owns one `isSaving` state plus the meal-sheet open state and launch
button ref. Its shared mutation helper serializes updates, disables daily
module controls while saving, and always clears the pending state. The Diet
action opens `MealLogSheet`; submitting adds the selected calories to the
current diet total. The sheet closes only after a successful update, so its
unmodified local input is retained on failure. Cancelling or a successful save
returns focus to `+ Log meal`.

Focused test run:

```text
npm --prefix web run test -- src/screens/Today.test.tsx src/components/MealLogSheet.test.tsx

Test Files  2 passed (2)
Tests       8 passed (8)
```

## Validation

```text
npm --prefix web run typecheck  # passed
npm --prefix web run lint       # passed; existing Toast fast-refresh warning only
npm --prefix web run build      # passed
```

No `ScreenState` work was added; that remains Task 4 ownership.
