import test from "node:test";
import assert from "node:assert/strict";
import {
  DRUM_PATTERN_COUNT,
  drumEventsAt,
  drumPatternIndexAtX,
  drumStepAtLoopStep,
  isDrumTriggerLoopStep,
} from "../src/drums.js";

test("the drum surface hard-switches between five intensity patterns", () => {
  assert.equal(DRUM_PATTERN_COUNT, 5);
  assert.equal(drumPatternIndexAtX(0), 0);
  assert.equal(drumPatternIndexAtX(0.2), 1);
  assert.equal(drumPatternIndexAtX(0.999), 4);
  assert.equal(drumPatternIndexAtX(1), 4);
});

test("each House pattern is one bar and becomes denser with intensity", () => {
  const eventCounts = Array.from({ length: 5 }, (_, patternIndex) => (
    Array.from({ length: 16 }, (_, step) => drumEventsAt(patternIndex, step).length)
      .reduce((total, count) => total + count, 0)
  ));
  assert.deepEqual(eventCounts, [4, 8, 10, 16, 28]);
});

test("drum patterns use sixteen steps per bar and wrap negative pre-roll into the tail", () => {
  assert.equal(isDrumTriggerLoopStep(0), true);
  assert.equal(isDrumTriggerLoopStep(7), false);
  assert.equal(isDrumTriggerLoopStep(-8), true);
  assert.equal(drumStepAtLoopStep(0), 0);
  assert.equal(drumStepAtLoopStep(120), 15);
  assert.equal(drumStepAtLoopStep(-8), 15);
});
