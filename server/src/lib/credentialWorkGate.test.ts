import assert from "node:assert/strict";
import test from "node:test";

import { CREDENTIAL_WORK_REJECTED, CredentialWorkGate } from "./credentialWorkGate.js";

test("credential work runs normally while the gate has capacity", async () => {
  const gate = new CredentialWorkGate({ maxConcurrent: 2, maxQueued: 2 });
  assert.equal(await gate.run(async () => "derived"), "derived");
  assert.equal(gate.pending, 0);
});

test("a saturated credential work gate refuses excess work instead of queueing it without bound", async () => {
  const gate = new CredentialWorkGate({ maxConcurrent: 1, maxQueued: 1 });
  const release: (() => void)[] = [];
  const blocked = () => new Promise<string>((resolve) => release.push(() => resolve("done")));

  const active = gate.run(blocked);
  await Promise.resolve();
  const queued = gate.run(blocked);
  await Promise.resolve();

  // One task holds the slot and one waits; anything beyond that is refused immediately.
  assert.equal(await gate.run(async () => "overflow"), CREDENTIAL_WORK_REJECTED);

  release.shift()?.();
  assert.equal(await active, "done");
  release.shift()?.();
  assert.equal(await queued, "done");
  assert.equal(gate.pending, 0);
});

test("the gate releases its slot when credential work throws", async () => {
  const gate = new CredentialWorkGate({ maxConcurrent: 1, maxQueued: 1 });
  await assert.rejects(gate.run(async () => {
    throw new Error("scrypt failed");
  }));
  assert.equal(gate.pending, 0);
  assert.equal(await gate.run(async () => "recovered"), "recovered");
});
