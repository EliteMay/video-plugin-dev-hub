import test from "node:test";
import assert from "node:assert/strict";
import { defaultTrustStore, isRepositoryTrusted, setRepositoryTrust } from "../src/core/trust.mjs";

test("repositories are untrusted by default", () => {
  assert.equal(isRepositoryTrusted(defaultTrustStore(), "EliteMay/example"), false);
});

test("trust is explicit and revocable", () => {
  const trusted = setRepositoryTrust(defaultTrustStore(), "EliteMay/example", true);
  assert.equal(isRepositoryTrusted(trusted, "elitemay/example"), true);
  const revoked = setRepositoryTrust(trusted, "EliteMay/example", false);
  assert.equal(isRepositoryTrusted(revoked, "EliteMay/example"), false);
});
