import test from "node:test";
import assert from "node:assert/strict";
import { clampTempo, isTapIntervalInRange, tapTempoFromTimestamps } from "../src/tempo.js";

test("tempo adjustments stay within the supported integer range", () => {
  assert.equal(clampTempo(39), 40);
  assert.equal(clampTempo(120.6), 121);
  assert.equal(clampTempo(241), 240);
});

test("tap tempo starts on the second tap and averages up to the most recent four taps", () => {
  assert.equal(tapTempoFromTimestamps([0]), null);
  assert.equal(tapTempoFromTimestamps([0, 500]), 120);
  assert.equal(tapTempoFromTimestamps([0, 480, 1000]), 120);
  assert.equal(tapTempoFromTimestamps([0, 500, 1000, 1500]), 120);
  assert.equal(tapTempoFromTimestamps([0, 1000, 1500, 2000, 2500]), 120);
});

test("tap intervals must stay between half and two beats at the current tempo", () => {
  assert.equal(isTapIntervalInRange(249, 120), false);
  assert.equal(isTapIntervalInRange(250, 120), true);
  assert.equal(isTapIntervalInRange(1000, 120), true);
  assert.equal(isTapIntervalInRange(1001, 120), false);
  assert.equal(isTapIntervalInRange(2500, 40), true);
});
