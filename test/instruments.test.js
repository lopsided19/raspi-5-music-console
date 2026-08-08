import test from "node:test";
import assert from "node:assert/strict";
import { instrumentMidi, instrumentPreset, instrumentTouchLimit } from "../src/instruments.js";

test("bass uses a dedicated preset two octaves below the scale note", () => {
  assert.equal(instrumentMidi("bass", 60), 36);
  assert.equal(instrumentPreset("bass"), "bass");
});

test("the chord layer uses its four-voice synth preset", () => {
  assert.equal(instrumentPreset("chord"), "chord");
});

test("every instrument layer exposes a single active control point", () => {
  assert.equal(instrumentTouchLimit("bass"), 1);
  assert.equal(instrumentTouchLimit("melody"), 1);
  assert.equal(instrumentTouchLimit("chord"), 1);
  assert.equal(instrumentTouchLimit("drums"), 1);
});
