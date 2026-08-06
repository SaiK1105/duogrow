import assert from "node:assert/strict";
import test from "node:test";

import { buildAllowedOrigins, isValidOrigin, resolveAllowedOrigin } from "./corsOrigins.js";

test("both Capacitor webview origins are allowed by default", () => {
  const allowed = buildAllowedOrigins();
  assert.equal(resolveAllowedOrigin("capacitor://localhost", allowed), "capacitor://localhost");
  assert.equal(resolveAllowedOrigin("https://localhost", allowed), "https://localhost");
});

test("an unlisted origin is denied, including look-alikes of an allowed one", () => {
  const allowed = buildAllowedOrigins();
  for (const origin of [
    "https://evil.example",
    "https://localhost.evil.example",
    "https://notlocalhost",
    "http://localhost",
    "capacitor://elsewhere",
    "null",
  ]) {
    assert.equal(resolveAllowedOrigin(origin, allowed), null, `${origin} must not be allowed`);
  }
});

test("dev origins are opt-in so a production server does not trust a local page", () => {
  assert.equal(resolveAllowedOrigin("http://localhost:5173", buildAllowedOrigins()), null);
  assert.equal(
    resolveAllowedOrigin("http://localhost:5173", buildAllowedOrigins({ includeDev: true })),
    "http://localhost:5173",
  );
});

test("extra origins are parsed from a comma-separated list and de-duplicated", () => {
  const allowed = buildAllowedOrigins({ extra: " https://staging.example , https://localhost ,, " });
  assert.equal(resolveAllowedOrigin("https://staging.example", allowed), "https://staging.example");
  assert.equal(allowed.filter((entry) => entry === "https://localhost").length, 1);
});

test("a malformed extra entry is dropped rather than widening or breaking the list", () => {
  const allowed = buildAllowedOrigins({ extra: "not-a-url,https://ok.example/path,*,https://fine.example" });
  assert.equal(resolveAllowedOrigin("https://fine.example", allowed), "https://fine.example");
  assert.equal(resolveAllowedOrigin("https://ok.example", allowed), null);
  assert.equal(resolveAllowedOrigin("*", allowed), null);
  // The defaults must survive a bad neighbour in the same list.
  assert.equal(resolveAllowedOrigin("capacitor://localhost", allowed), "capacitor://localhost");
});

test("an origin is scheme, host and port only", () => {
  assert.equal(isValidOrigin("https://example.com"), true);
  assert.equal(isValidOrigin("https://example.com:8443"), true);
  assert.equal(isValidOrigin("capacitor://localhost"), true);

  assert.equal(isValidOrigin("https://example.com/"), false);
  assert.equal(isValidOrigin("https://example.com/app"), false);
  assert.equal(isValidOrigin("https://example.com?q=1"), false);
  assert.equal(isValidOrigin("example.com"), false);
  assert.equal(isValidOrigin(""), false);
  assert.equal(isValidOrigin("null"), false);
});
