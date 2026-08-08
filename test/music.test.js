import test from "node:test";
import assert from "node:assert/strict";
import {
  SCALES,
  buildScaleNotes,
  getScaleToneRole,
  midiToFrequency,
  midiToLabel,
  positionToNoteIndex,
} from "../src/music.js";

test("major scale spans two octaves and includes the third Do", () => {
  const notes = buildScaleNotes([0, 2, 4, 5, 7, 9, 11]);
  assert.deepEqual(notes, [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84]);
});

test("touch positions map safely to first and last regions", () => {
  assert.equal(positionToNoteIndex(-20, 0, 100, 15), 0);
  assert.equal(positionToNoteIndex(0, 0, 100, 15), 0);
  assert.equal(positionToNoteIndex(100, 0, 100, 15), 14);
  assert.equal(positionToNoteIndex(200, 0, 100, 15), 14);
});

test("MIDI values have expected labels and tuning", () => {
  assert.equal(midiToLabel(60), "Do 4");
  assert.equal(midiToLabel(84), "Do 6");
  assert.equal(midiToFrequency(69), 440);
});

test("all seven medieval modes are available", () => {
  const medievalModes = Object.values(SCALES).filter((scale) => scale.group === "中古调式");
  assert.equal(medievalModes.length, 7);
});

test("every scale contains sorted pitch classes within one octave", () => {
  for (const scale of Object.values(SCALES)) {
    assert.ok(scale.intervals.length > 0, `${scale.label} is empty`);
    assert.equal(scale.intervals[0], 0, `${scale.label} does not start on the tonic`);
    assert.deepEqual([...scale.intervals].sort((a, b) => a - b), scale.intervals, `${scale.label} is not sorted`);
    assert.equal(new Set(scale.intervals).size, scale.intervals.length, `${scale.label} has duplicate notes`);
    assert.ok(scale.intervals.every((interval) => interval >= 0 && interval <= 11), `${scale.label} is out of range`);
  }
});

test("scale tones receive semantic visual roles", () => {
  assert.equal(getScaleToneRole("major", 0), "tonic");
  assert.equal(getScaleToneRole("major", 4), "stable");
  assert.equal(getScaleToneRole("major", 7), "stable");
  assert.equal(getScaleToneRole("major", 11), "characteristic");
  assert.equal(getScaleToneRole("major", 2), "other");
});

test("compact and native-script scale labels are available", () => {
  assert.equal(SCALES.diminishedHalfWhole.shortLabel, "H–W Dim");
  assert.equal(SCALES.chineseGong.shortLabel, "宫");
  assert.equal(SCALES.hijaz.shortLabel, "حجاز");
  assert.equal(SCALES.bhairav.shortLabel, "भैरव");
});
