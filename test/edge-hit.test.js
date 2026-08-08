import test from "node:test";
import assert from "node:assert/strict";
import { edgeHitAtX, interiorRangeAtX } from "../src/edge-hit.js";

const bounds = {
  start: 100,
  end: 200,
  startHitStart: 88,
  startHitEnd: 124,
  endHitStart: 176,
  endHitEnd: 212,
};

test("edge hit areas extend beyond both ends while leaving the center untouched", () => {
  assert.equal(edgeHitAtX(bounds, 92), "start");
  assert.equal(edgeHitAtX(bounds, 112), "start");
  assert.equal(edgeHitAtX(bounds, 150), null);
  assert.equal(edgeHitAtX(bounds, 188), "end");
  assert.equal(edgeHitAtX(bounds, 208), "end");
  assert.equal(edgeHitAtX(bounds, 80), null);
});

test("overlapping internal edge areas choose the physically nearest edge", () => {
  const narrowBounds = {
    start: 100,
    end: 120,
    startHitStart: 88,
    startHitEnd: 116,
    endHitStart: 104,
    endHitEnd: 132,
  };
  assert.equal(edgeHitAtX(narrowBounds, 106), "start");
  assert.equal(edgeHitAtX(narrowBounds, 114), "end");
});

test("an adjoining block interior takes priority over another block's external hit area", () => {
  const ranges = [
    { id: "first", start: 0, end: 100 },
    { id: "second", start: 100, end: 200 },
  ];
  assert.equal(interiorRangeAtX(ranges, 104).id, "second");
  assert.equal(interiorRangeAtX(ranges, 96).id, "first");
});
