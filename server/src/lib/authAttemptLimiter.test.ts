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

test("credential attempt limiter accepts new names during capacity churn while keeping an exhausted name denied", () => {
  assert.ok(attemptLimiterModule, "expected the bounded credential attempt limiter module");
  let now = 0;
  const limiter = new attemptLimiterModule.AuthAttemptLimiter({ maxAttempts: 2, windowMs: 100, maxEntries: 2, now: () => now });

  assert.equal(limiter.allow("target"), true);
  assert.equal(limiter.allow("target"), true);
  assert.equal(limiter.allow("target"), false);
  assert.equal(limiter.allow("neighbor"), true);
  assert.equal(limiter.allow("neighbor"), true);
  assert.equal(limiter.allow("neighbor"), false);
  for (let index = 0; index < 10; index += 1) {
    assert.equal(limiter.allow(`flood-${index}`), true);
    assert.equal(limiter.allow("target"), false);
    assert.equal(limiter.allow("neighbor"), false);
  }
  assert.equal(limiter.size, 2);

  now = 101;
  assert.equal(limiter.allow("target"), true);
  assert.equal(limiter.allow("fresh"), true);
  assert.equal(limiter.size, 2);
});
