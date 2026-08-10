import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";

import {
  createProfile,
  loadProfiles,
  normalizeTutorialProgress,
  saveProfiles,
  scopedStorageKey,
  validatePin,
  verifyProfilePin,
} from "../src/profiles.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("profiles persist independently and PINs are verified without storing plaintext", async () => {
  const profile = await createProfile(" 小明 ", "1234", {
    cryptoImpl: webcrypto,
    now: () => new Date("2026-08-10T00:00:00.000Z"),
  });
  assert.equal(profile.name, "小明");
  assert.notEqual(profile.pinHash, "1234");
  assert.equal(await verifyProfilePin(profile, "1234", webcrypto), true);
  assert.equal(await verifyProfilePin(profile, "4321", webcrypto), false);

  const storage = memoryStorage();
  saveProfiles([profile], storage);
  assert.deepEqual(loadProfiles(storage), [profile]);
});

test("PINs are optional but numeric when supplied", async () => {
  assert.equal(validatePin(""), "");
  assert.equal(validatePin("1234"), "");
  assert.match(validatePin("12ab"), /4～8/);
  const profile = await createProfile("访客", "", { cryptoImpl: webcrypto });
  assert.equal(await verifyProfilePin(profile, "", webcrypto), true);
});

test("tutorial progress and project keys are scoped to a profile", () => {
  assert.deepEqual(normalizeTutorialProgress(null), {
    version: 1,
    status: "not-started",
    step: 0,
    chordProgress: 0,
    completedAt: null,
  });
  assert.notEqual(scopedStorageKey("project", "one"), scopedStorageKey("project", "two"));
});
