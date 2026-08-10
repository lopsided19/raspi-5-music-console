import assert from "node:assert/strict";
import test from "node:test";

import {
  TUTORIAL_CHORD_SEQUENCE,
  chordSequenceComplete,
  nextChordProgress,
} from "../src/tutorial.js";

test("the beginner progression advances through C G Am F", () => {
  let progress = 0;
  for (const chord of TUTORIAL_CHORD_SEQUENCE) progress = nextChordProgress(progress, chord);
  assert.equal(chordSequenceComplete(progress), true);
});

test("a wrong chord resets progress while a new C immediately restarts it", () => {
  assert.equal(nextChordProgress(2, "ii"), 0);
  assert.equal(nextChordProgress(2, "I"), 1);
});
