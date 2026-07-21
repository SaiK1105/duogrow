# Daily Accountability UI Design

## Intent

DuoGrow already implements the screens and visual language required by `SPEC.md`.
This design keeps the established **Night Terrarium** direction and turns its
most frequent path—recording progress, uploading proof, and seeing the shared
result—into a more reliable, app-native experience. The scope is intentionally
limited to the existing product workflow; it does not change the API contract,
data model, routes, or AI-verification rules.

## Product direction

- **Purpose:** help two people see, record, and celebrate meaningful daily
  progress without interrupting their routine.
- **Audience:** a paired user checking in on a phone, often in a short break,
  who needs the next action and their partner's progress immediately legible.
- **Tone:** calm, focused, and quietly encouraging. Grow green identifies the
  current user, amber identifies the partner, and confidence colors are
  reserved for verification outcomes.
- **Memorable detail:** logging a meal becomes an inline, tactile sheet inside
  the terrarium rather than a browser prompt, so a basic habit action feels as
  considered as the proof-verification flow.

## Existing constraints to preserve

- React 19, TypeScript, Vite, CSS tokens, HashRouter, and the relative `/api`
  client remain unchanged.
- The phone column remains at a maximum width of 430px over the ambient
  backdrop; the floating tab bar stays available on primary screens.
- The six confidence and identity color tokens already in
  `web/src/styles/tokens.css` remain the source of truth.
- Today continues to poll every three seconds and refetches after a mutation.
- All controls remain keyboard-operable, labelled, touch-sized, and usable at
  a narrow mobile viewport.

## Experience changes

### 1. Native calorie logging sheet

Replace `window.prompt()` from the Diet row with a small in-screen sheet. It
opens from the existing `+ Log meal` control and contains:

- an accessible dialog title and a visible description;
- a numeric calorie input prefilled with 500 and constrained to positive whole
  numbers;
- quick-add chips for 300, 500, and 700 calories;
- Cancel and `Add meal` actions; and
- a validation message shown in the sheet when the value is invalid.

Submitting uses the same existing `PUT /api/modules/diet` update. No new meal
table, categories, or server-side state is introduced. Closing restores focus
to the launch control.

### 2. Mutation-safe Today controls

The Today screen owns a single pending mutation state. While saving, its
action buttons and the meal-sheet confirmation are disabled and expose their
busy state. This prevents duplicate proof-adjacent progress updates and makes
the eventual refetch the authoritative source of truth. A failed save keeps
the sheet open with the entered value and shows the existing error toast.

### 3. Clear load and failure recovery

Replace indefinite blank/skeleton states on the app's data-fetching screens
with a shared, unobtrusive recovery surface: concise message plus retry.
Today uses the polling hook's error state; POTD, Insights, Profile, and Upload
show the same recoverable state when their initial request fails. Successful
data keeps the current visual layout exactly as it is.

### 4. Proof-upload submission guard

The Upload action becomes disabled immediately after submission begins. Its
analysis status remains visible, and the delayed result navigation is cleaned
up if the page unmounts. This maintains the existing verification animation
while preventing duplicate uploads and unexpected later navigations.

## Component boundaries

| Unit | Responsibility |
| --- | --- |
| `MealLogSheet` | Accessible calorie-entry dialog; local validation; reports a valid amount or cancellation. |
| `ScreenState` | Reusable loading/error/retry presentation for fetch-driven screens. |
| `Today` | Owns current snapshot, serializes mutations, opens the sheet, and applies a submitted amount through the existing API client. |
| `Upload` | Owns one submission lifecycle and cancels the transition timer on unmount. |
| `usePolling` | Preserves its public return shape while preventing overlapping requests and surfacing a retryable error. |

## Acceptance criteria

1. The complete flow in `SPEC.md` remains available: onboarding, Today,
   upload/verification, POTD, cheers, insights, and profile.
2. A user can log a positive calorie amount without a native browser prompt;
   keyboard focus, validation, Cancel, and quick-add actions work.
3. Repeated controls cannot submit overlapping module mutations, and a failed
   save reports an error without discarding unsaved meal input.
4. Every fetch-driven screen presents a retry affordance after a failed initial
   request instead of remaining indefinitely empty or loading.
5. Uploading cannot submit more than once while analysing, and leaving the
   screen cannot trigger a stale delayed navigation.
6. The build, typecheck, lint, and a two-tab browser smoke test pass. The UI
   remains responsive at phone and desktop widths and preserves the existing
   dark token-based visual system.

## Non-goals

- New backend endpoints or database migrations.
- A visual rebrand, a desktop admin dashboard, or marketing pages.
- Replacing polling with WebSockets.
- Changing proof confidence thresholds or verification behavior.
