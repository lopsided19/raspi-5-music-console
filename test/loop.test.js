import test from "node:test";
import assert from "node:assert/strict";
import {
  beatPulseAt,
  eraseTrackRange,
  loopProgressAt,
  loopPosition,
  loopStepCount,
  normalizedPoint,
  recordPoint,
  recordingPhraseGapMs,
  recordingTransportStart,
  rhythmicEnvelopeAt,
  shiftTrackLoop,
  stepDurationMs,
  trackPointsAtStep,
  trackPointsAtAbsoluteStep,
} from "../src/loop.js";

test("a 4/4 bar contains 128 quantized 128th-note steps", () => {
  assert.equal(loopStepCount(1), 128);
  assert.equal(loopStepCount(3), 384);
  assert.equal(loopStepCount(4), 512);
  assert.equal(stepDurationMs(120), 15.625);
});

test("a recording phrase closes after half of that track's loop", () => {
  assert.equal(recordingPhraseGapMs(1, 120), 1000);
  assert.equal(recordingPhraseGapMs(4, 120), 4000);
  assert.equal(recordingPhraseGapMs(1, 60), 2000);
});

test("transport positions wrap at the configured loop length", () => {
  assert.deepEqual(loopPosition(0, 4), { step: 0, bar: 1, beat: 1, subdivision: 0 });
  assert.deepEqual(loopPosition(32, 4), { step: 32, bar: 1, beat: 2, subdivision: 0 });
  assert.deepEqual(loopPosition(128, 4), { step: 128, bar: 2, beat: 1, subdivision: 0 });
  assert.deepEqual(loopPosition(512, 4), { step: 0, bar: 1, beat: 1, subdivision: 0 });
  assert.equal(loopProgressAt(64, 1), 0.5);
  assert.equal(loopProgressAt(128, 1), 0);
  assert.equal(loopProgressAt(128, 2), 0.5);
});

test("each track reads playback at its own loop length", () => {
  const tracks = new Map([
    ["melody", new Map([[0, { x: 0.2, y: 0.3 }]])],
    ["bass", new Map([[128, { x: 0.7, y: 0.6 }]])],
  ]);
  const trackLoopBars = new Map([["melody", 1], ["bass", 2]]);
  const points = trackPointsAtAbsoluteStep(tracks, trackLoopBars, 128);
  assert.deepEqual([...points.keys()], ["melody", "bass"]);
});

test("a recording touch in the first half of a beat uses the current beat as loop start", () => {
  assert.equal(recordingTransportStart(1120, 1000, 120), 1000);
  assert.equal(recordingTransportStart(1249, 1000, 120), 1000);
});

test("a recording touch in the second half of a beat uses the next beat as loop start", () => {
  assert.equal(recordingTransportStart(1250, 1000, 120), 1500);
  assert.equal(recordingTransportStart(1499, 1000, 120), 1500);
  assert.equal(loopPosition(-1, 1).step, 127);
});

test("recording at an existing loop step overwrites its old point", () => {
  const track = new Map();
  recordPoint(track, 7, { x: 0.1, y: 0.2 });
  recordPoint(track, 7, { x: 0.8, y: 0.9 });
  assert.equal(track.size, 1);
  assert.deepEqual(track.get(7), { x: 0.8, y: 0.9 });
});

test("the eraser removes only transport steps crossed while it is held", () => {
  const track = new Map([
    [0, { x: 0.1, y: 0.2 }],
    [1, { x: 0.2, y: 0.3 }],
    [2, { x: 0.3, y: 0.4 }],
    [127, { x: 0.9, y: 0.8 }],
  ]);
  assert.equal(eraseTrackRange(track, 1, 2, 1), 2);
  assert.deepEqual([...track.keys()], [0, 127]);
  assert.equal(eraseTrackRange(track, 127, 128, 1), 2);
  assert.equal(track.size, 0);
  recordPoint(track, 0, { x: 0.1, y: 0.2 });
  eraseTrackRange(track, 0, 0, 1);
  recordPoint(track, 0, { x: 0.4, y: 0.5 });
  assert.deepEqual(track.get(0), { x: 0.4, y: 0.5 });
});

test("loop shifting moves visible events cyclically and preserves hidden longer-loop data", () => {
  const track = new Map([
    [0, { x: 0.1, y: 0.2 }],
    [31, { x: 0.2, y: 0.3 }],
    [127, { x: 0.3, y: 0.4 }],
    [200, { x: 0.9, y: 0.8 }],
  ]);
  assert.equal(shiftTrackLoop(track, -32, 1), 3);
  assert.deepEqual([...track.keys()].sort((a, b) => a - b), [95, 96, 127, 200]);
  assert.deepEqual(track.get(96), { x: 0.1, y: 0.2 });
  assert.deepEqual(track.get(127), { x: 0.2, y: 0.3 });
  assert.deepEqual(track.get(95), { x: 0.3, y: 0.4 });
  assert.deepEqual(track.get(200), { x: 0.9, y: 0.8 });
});

test("recorded points are normalized to the performance surface", () => {
  assert.deepEqual(normalizedPoint(75, 150, { left: 25, top: 50, width: 100, height: 200 }), {
    x: 0.5,
    y: 0.5,
  });
  assert.deepEqual(normalizedPoint(-20, 999, { left: 0, top: 0, width: 100, height: 100 }), {
    x: 0,
    y: 1,
  });
});

test("rhythm visuals stay dark before the beat, switch on at it, and then decay", () => {
  const beforeBeat = rhythmicEnvelopeAt(470, 0, 120);
  const onBeat = rhythmicEnvelopeAt(500, 0, 120);
  const afterBeat = rhythmicEnvelopeAt(530, 0, 120);
  const lateDecay = rhythmicEnvelopeAt(850, 0, 120);
  const beforeNextBeat = rhythmicEnvelopeAt(950, 0, 120);
  assert.equal(beforeBeat, 0);
  assert.ok(afterBeat > 0);
  assert.ok(lateDecay > 0);
  assert.equal(beforeNextBeat, 0);
  assert.ok(onBeat > afterBeat);
  assert.equal(onBeat, 1);
  assert.equal(beatPulseAt(500, 0, 120), 1.24);
  assert.equal(beatPulseAt(0, 0, 120), beatPulseAt(500, 0, 120));
});

test("playback collects recorded points from every track at the same step", () => {
  const tracks = new Map([
    ["melody", new Map([[8, { x: 0.2, y: 0.3 }]])],
    ["bass", new Map([[8, { x: 0.7, y: 0.6 }]])],
    ["drums", new Map()],
  ]);
  const points = trackPointsAtStep(tracks, 8);
  assert.deepEqual([...points.keys()], ["melody", "bass"]);
});
