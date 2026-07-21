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

## Reviewer follow-up

### RED

Added the following behavior tests before the follow-up implementation:

- A deferred Diet save disables the `Add meal` confirmation control.
- A deferred Today module update disables `Cheer Partner`.
- Meal-trigger focus is restored only after the successful save has cleared and
  the trigger is enabled again.
- A direct `MealLogSheet` test verifies its new submission prop reaches the
  native confirmation button.

The focused run failed with all expected gaps: the meal confirmation and cheer
buttons were not disabled, and focus ended on the document body because focus
was requested while the trigger was still disabled.

### GREEN

`MealLogSheet` now accepts `isSubmitting` and disables only its confirmation
button, retaining all entered input during a failed request. `CheerButton` now
accepts an optional `disabled` prop, guards its handler before creating an
animation burst, and forwards the value to its native button. Today passes its
single saving state to both controls. A focus-restoration ref plus effect waits
until the sheet has closed and saving has cleared; cancellation retains its
post-close focus behavior.

Validation after the follow-up:

```text
npm --prefix web run test -- src/screens/Today.test.tsx src/components/MealLogSheet.test.tsx
Test Files  2 passed (2)
Tests       12 passed (12)

npm --prefix web run typecheck  # passed
npm --prefix web run lint       # passed; existing Toast fast-refresh warning only
npm --prefix web run build      # passed
```
