import test from "node:test";
import assert from "node:assert/strict";
import { activePointerPoint, registerPointerPress, unregisterPointer } from "../src/touch-control.js";

test("the latest pressed pointer is the only active control point", () => {
  const order = [];
  const positions = new Map();
  positions.set(1, { x: 0.1, y: 0.2 });
  registerPointerPress(order, 1);
  positions.set(2, { x: 0.8, y: 0.7 });
  registerPointerPress(order, 2);
  assert.deepEqual(activePointerPoint(order, positions), { x: 0.8, y: 0.7 });

  positions.set(1, { x: 0.3, y: 0.4 });
  assert.deepEqual(activePointerPoint(order, positions), { x: 0.8, y: 0.7 });
});

test("releasing the active pointer snaps back to the latest pointer still held", () => {
  const order = [1, 2, 3];
  assert.equal(unregisterPointer(order, 2), 3);
  assert.equal(unregisterPointer(order, 3), 1);
  assert.equal(unregisterPointer(order, 1), null);
});
