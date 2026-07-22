import assert from "node:assert/strict";
import test from "node:test";

interface AttemptLimiter {
  allow(normalizedName: string): boolean;
  readonly size: number;
}

interface AttemptLimiterModule {
  AuthAttemptLimiter: new (options: { maxAttempts: number; windowMs: number; maxEntries: number; now: () => number }) => AttemptLimiter;
}

const attemptLimiterModule = await import(`./authAttemptLimiter${".js"}`).then(
  (module) => module as AttemptLimiterModule,
  () => null,
);

test("credential attempt limiter caps attempts, expires entries, and keeps a bounded name set", () => {
  assert.ok(attemptLimiterModule, "expected the bounded credential attempt limiter module");
  let now = 0;
  const limiter = new attemptLimiterModule.AuthAttemptLimiter({ maxAttempts: 2, windowMs: 100, maxEntries: 2, now: () => now });

  assert.equal(limiter.allow("ada"), true);
  assert.equal(limiter.allow("ada"), true);
  assert.equal(limiter.allow("ada"), false);
  now = 101;
  assert.equal(limiter.allow("ada"), true);
  assert.equal(limiter.allow("bea"), true);
  assert.equal(limiter.allow("cyd"), true);
  assert.equal(limiter.size, 2);

  const singleEntryLimiter = new attemptLimiterModule.AuthAttemptLimiter({ maxAttempts: 1, windowMs: 100, maxEntries: 1, now: () => now });
  assert.equal(singleEntryLimiter.allow(""), true);
  assert.equal(singleEntryLimiter.allow("ada"), true);
  assert.equal(singleEntryLimiter.size, 1);
});
