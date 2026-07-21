# Daily Accountability UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Make the existing Night Terrarium UI feel app-native and reliable during daily check-ins, proof upload, and recovery from failed requests.

**Architecture:** Add two focused UI primitives: MealLogSheet owns accessible meal entry and ScreenState owns recoverable initial-load states. Existing screens keep their API calls and routes; they only compose these primitives and make request lifecycle explicit. Vitest plus React Testing Library covers every new component and changed interaction.

**Tech Stack:** React 19, TypeScript, Vite 8, Vitest 4, React Testing Library, existing CSS tokens and Hono API client.

## Global Constraints

- Preserve the HashRouter routes, relative /api client, and existing backend contracts.
- Preserve the Night Terrarium tokens and 430px phone-column layout.
- Keep controls labelled, keyboard-operable, and touch sized.
- Do not add a new API endpoint, data model, or runtime dependency.
- Verify with npm --prefix web run test, npm run typecheck, npm --prefix web run lint, npm run build, and a two-tab browser smoke test.

---

### Task 1: Establish component-test infrastructure

**Files:**
- Modify: web/package.json
- Modify: web/vite.config.ts
- Create: web/src/test/setup.ts

**Interfaces:**
- Produces npm --prefix web run test, using Vitest with JSDOM and web/src/test/setup.ts.
- Produces Testing Library matchers and automatic cleanup for every test file.

- [ ] **Step 1: Add the test command and development dependencies**

Add the script and packages, then run npm --prefix web install:

    "test": "vitest run --passWithNoTests"
    "@testing-library/jest-dom": "^6.9.1"
    "@testing-library/react": "^16.3.2"
    "@testing-library/user-event": "^14.6.1"
    "jsdom": "^28.0.0"
    "vitest": "^4.1.0"

- [ ] **Step 2: Configure Vite's test environment**

Add the Vitest config type reference and this test block to web/vite.config.ts:

    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
    },

- [ ] **Step 3: Add test setup**

Create web/src/test/setup.ts:

    import '@testing-library/jest-dom/vitest'
    import { cleanup } from '@testing-library/react'
    import { afterEach } from 'vitest'

    afterEach(() => cleanup())

- [ ] **Step 4: Verify the runner**

Run: npm --prefix web run test

Expected: the runner exits successfully before component tests are added.

### Task 2: Build and test the accessible meal-log sheet

**Files:**
- Create: web/src/components/MealLogSheet.tsx
- Create: web/src/components/meal-log-sheet.css
- Create: web/src/components/MealLogSheet.test.tsx

**Interfaces:**
- Produces MealLogSheet({ isOpen, initialCalories, onCancel, onSubmit }).
- onSubmit(calories: number): void is called only with a positive integer.
- Consumes no API client; Today owns persistence.

- [ ] **Step 1: Write the failing visible-behavior tests**

Write tests that:
1. choose the 700-calorie quick-add button, submit, and assert onSubmit was called with 700;
2. clear the labelled Calories field, enter 0, submit, and assert the role=alert text is Enter a positive number of calories.;
3. click Cancel and assert onCancel was called; and
4. assert the input receives focus after the sheet opens.

- [ ] **Step 2: Verify RED**

Run: npm --prefix web run test -- src/components/MealLogSheet.test.tsx

Expected: FAIL because MealLogSheet does not yet resolve.

- [ ] **Step 3: Implement the smallest accessible dialog**

Render nothing when isOpen is false. When open, render a dialog overlay with role=dialog, aria-modal=true, a labelled Calories input, buttons named 300 calories, 500 calories, and 700 calories, plus Cancel and Add meal actions. Use Number.parseInt; reject non-finite numbers and values below one without closing the sheet. Focus the input through a ref/effect.

- [ ] **Step 4: Verify GREEN and commit**

Run: npm --prefix web run test -- src/components/MealLogSheet.test.tsx

Expected: PASS, four behavior tests.

Commit:

    git add web/package.json web/package-lock.json web/vite.config.ts web/src/test/setup.ts web/src/components/MealLogSheet.tsx web/src/components/meal-log-sheet.css web/src/components/MealLogSheet.test.tsx
    git commit -m "feat: add native meal logging sheet"

### Task 3: Integrate the meal sheet and serialize Today mutations

**Files:**
- Modify: web/src/screens/Today.tsx
- Modify: web/src/screens/today.css
- Create: web/src/screens/Today.test.tsx

**Interfaces:**
- Consumes MealLogSheet from Task 2.
- Today owns isMealSheetOpen, isSaving, and the original launch-button ref.
- Existing api.updateModule(module, patch) is unchanged.

- [ ] **Step 1: Write failing interaction tests**

Mock api.today with diet value 200 and api.updateModule. Render Today within MemoryRouter and ToastProvider. Click + Log meal, choose 500 calories, submit, and assert:

    expect(api.updateModule).toHaveBeenCalledWith('diet', { value: 700 })

Use a deferred update promise in a second test: click Study +30m twice before resolving it, then assert updateModule was called once and the second action is disabled.

- [ ] **Step 2: Verify RED**

Run: npm --prefix web run test -- src/screens/Today.test.tsx

Expected: FAIL because the screen uses window.prompt and exposes no pending mutation state.

- [ ] **Step 3: Implement the integration**

Replace logMeal's prompt with the sheet flow. Add isMealSheetOpen and isSaving state, prevent a mutation when isSaving is true, disable all mutation controls while saving, close the sheet only after a successful update, and clear isSaving in finally. Preserve the entered meal amount on failure and surface the existing error toast. Restore focus to the Diet action when the sheet closes.

- [ ] **Step 4: Verify GREEN and commit**

Run: npm --prefix web run test -- src/screens/Today.test.tsx src/components/MealLogSheet.test.tsx

Expected: PASS.

Commit:

    git add web/src/screens/Today.tsx web/src/screens/today.css web/src/screens/Today.test.tsx
    git commit -m "feat: make daily check-ins app-native"

### Task 4: Add a reusable fetch-recovery surface and use it on data screens

**Files:**
- Create: web/src/components/ScreenState.tsx
- Create: web/src/components/screen-state.css
- Create: web/src/components/ScreenState.test.tsx
- Modify: web/src/screens/Today.tsx
- Modify: web/src/screens/Potd.tsx
- Modify: web/src/screens/Insights.tsx
- Modify: web/src/screens/Profile.tsx
- Modify: web/src/screens/Upload.tsx

**Interfaces:**
- Produces ScreenState({ title, message?, onRetry }) with an accessible retry action.
- Each screen adds loadError plus a reload function that resets the error before its existing requests.

- [ ] **Step 1: Write the failing ScreenState test**

Render ScreenState with title Insights are unavailable and a mocked retry callback. Assert the role=alert contains the title, click the button named Try again, and assert the callback is called once.

- [ ] **Step 2: Verify RED**

Run: npm --prefix web run test -- src/components/ScreenState.test.tsx

Expected: FAIL because ScreenState is missing.

- [ ] **Step 3: Implement the small recovery primitive**

Render a section with role=alert, a concise helper message, and an existing btn btn--outline action named Try again. Keep it in normal screen flow; do not add a nested card or overlay.

- [ ] **Step 4: Replace silent initial-load failures**

For Today, render `<ScreenState title="Today's check-in is unavailable" onRetry={refetch} />` when polling returns no data and an error; retain the skeleton for no-data/no-error. For POTD, load potdToday and potdBank from one callback and show ScreenState when no question loaded and loadError is true. For Insights and Profile, show it only when their primary data is absent. For Upload, show it inside Recent proofs if listProofs fails while keeping upload functional.

- [ ] **Step 5: Verify GREEN and commit**

Run: npm --prefix web run test -- src/components/ScreenState.test.tsx

Expected: PASS.

Commit:

    git add web/src/components/ScreenState.tsx web/src/components/screen-state.css web/src/components/ScreenState.test.tsx web/src/screens/Today.tsx web/src/screens/Potd.tsx web/src/screens/Insights.tsx web/src/screens/Profile.tsx web/src/screens/Upload.tsx
    git commit -m "feat: add retryable screen states"

### Task 5: Make proof upload single-submit and navigation safe

**Files:**
- Modify: web/src/screens/Upload.tsx
- Create: web/src/screens/Upload.test.tsx

**Interfaces:**
- The api.uploadProof(file, module?) contract does not change.
- Upload owns an optional resultTimerRef cleared on unmount.

- [ ] **Step 1: Write the failing duplicate-submit test**

Mock api.uploadProof with a deferred promise. Supply a File through the existing dropzone, click Verify with AI twice, then assert the button is disabled and uploadProof was called exactly once.

- [ ] **Step 2: Verify RED**

Run: npm --prefix web run test -- src/screens/Upload.test.tsx

Expected: FAIL because Verify remains enabled while analysing.

- [ ] **Step 3: Implement the submission guard**

Return early when analyzing is already true. Disable Verify, Change photo, module chips, and proof thumbnails while analyzing. Store result navigation timeout in resultTimerRef and clear it in an unmount effect. Keep the existing 1.8-second analysis duration.

- [ ] **Step 4: Verify GREEN and commit**

Run: npm --prefix web run test -- src/screens/Upload.test.tsx

Expected: PASS.

Commit:

    git add web/src/screens/Upload.tsx web/src/screens/Upload.test.tsx
    git commit -m "fix: guard proof upload submission"

### Task 6: Complete quality verification

**Files:**
- Verify only; no planned edits.

- [ ] **Step 1: Run the full web suite**

Run: npm --prefix web run test

Expected: PASS with no skipped tests.

- [ ] **Step 2: Run static verification**

Run: npm run typecheck && npm --prefix web run lint && npm run build && git diff --check

Expected: all commands exit 0. Resolve the existing Toast Fast Refresh warning if it still appears after UI work.

- [ ] **Step 3: Run a browser smoke test**

Run npm run dev and check both 390px and desktop viewports. In two tabs, log a meal, upload a proof, confirm partner progress updates within three seconds, open POTD and Insights, and force a failed fetch to verify each retry surface.

- [ ] **Step 4: Commit verified work**

    git add web
    git commit -m "test: cover daily accountability UI"

