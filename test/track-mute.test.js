import test from "node:test";
import assert from "node:assert/strict";
import {
  isTrackAudible,
  toggleTrackMute,
  toggleTrackSolo,
  trackGestureAction,
  trackGestureLabel,
  trackGesturePreview,
} from "../src/track-mute.js";

test("downward mute gestures toggle only the target track", () => {
  const muted = new Set();
  toggleTrackMute(muted, "bass");
  assert.deepEqual([...muted], ["bass"]);
  toggleTrackMute(muted, "bass");
  assert.deepEqual([...muted], []);
});

test("upward gestures toggle independent solo states and allow multiple solo tracks", () => {
  const soloed = new Set();
  toggleTrackSolo(soloed, "chord");
  toggleTrackSolo(soloed, "drums");
  assert.deepEqual([...soloed], ["chord", "drums"]);
  toggleTrackSolo(soloed, "chord");
  assert.deepEqual([...soloed], ["drums"]);
});

test("solo limits output to soloed tracks and takes priority over their mute state", () => {
  const muted = new Set(["drums"]);
  const soloed = new Set(["chord", "drums"]);
  assert.equal(isTrackAudible(muted, soloed, "melody"), false);
  assert.equal(isTrackAudible(muted, soloed, "chord"), true);
  assert.equal(isTrackAudible(muted, soloed, "drums"), true);
  soloed.clear();
  assert.equal(isTrackAudible(muted, soloed, "melody"), true);
  assert.equal(isTrackAudible(muted, soloed, "drums"), false);
});

test("track gesture previews expose direction, progress, and release confirmation", () => {
  assert.equal(trackGesturePreview(0, 3), null);
  assert.deepEqual(trackGesturePreview(0, -4), { action: "solo", progress: 0, confirmed: false });
  assert.deepEqual(trackGesturePreview(0, 13), { action: "mute", progress: 0.5, confirmed: false });
  assert.deepEqual(trackGesturePreview(2, -30), { action: "solo", progress: 1, confirmed: true });
  assert.equal(trackGesturePreview(20, 10), null);
});

test("track gesture labels describe whether release enables or disables the state", () => {
  assert.equal(trackGestureLabel("solo", false), "Solo");
  assert.equal(trackGestureLabel("solo", true), "Unsolo");
  assert.equal(trackGestureLabel("mute", false), "Mute");
  assert.equal(trackGestureLabel("mute", true), "Unmute");
});

test("vertical track gestures distinguish solo, mute, taps, and sideways movement", () => {
  assert.equal(trackGestureAction(2, -30), "solo");
  assert.equal(trackGestureAction(-3, 30), "mute");
  assert.equal(trackGestureAction(2, 3), "select");
  assert.equal(trackGestureAction(30, 4), null);
});
