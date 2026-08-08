import test from "node:test";
import assert from "node:assert/strict";
import { trackPathData } from "../src/track-visualization.js";

test("track paths map loop time horizontally and performance X vertically", () => {
  const track = new Map([
    [0, { x: 0, y: 0.5 }],
    [1, { x: 1, y: 0.2 }],
    [64, { x: 0.5, y: 0.9 }],
  ]);
  assert.equal(trackPathData(track, 1), "M 0 99 L 0.781 1 M 50 50 L 50.5 50");
});

test("track paths omit events hidden beyond the current track loop length", () => {
  const track = new Map([[200, { x: 0.5, y: 0.5 }]]);
  assert.equal(trackPathData(track, 1), "");
  assert.equal(trackPathData(track, 2), "M 78.125 50 L 78.625 50");
});
