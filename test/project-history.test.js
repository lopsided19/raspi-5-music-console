import test from "node:test";
import assert from "node:assert/strict";
import { ProjectHistory } from "../src/project-history.js";

function state(tempo, savedAt = `${tempo}`) {
  return { version: 1, tempo, savedAt, tracks: {} };
}

test("history records semantic states and ignores timestamp-only changes", () => {
  const history = new ProjectHistory({ limit: 3 });
  assert.equal(history.record(state(120), "初始"), true);
  assert.equal(history.record(state(120, "later"), "重复"), false);
  assert.equal(history.record(state(121), "Tempo"), true);
  assert.equal(history.canUndo(), true);
  assert.equal(history.undo().state.tempo, 120);
  assert.equal(history.redo().state.tempo, 121);
});

test("new edits after undo discard redo and history obeys its capacity", () => {
  const history = new ProjectHistory({ limit: 3 });
  history.record(state(120), "初始");
  history.record(state(121), "一");
  history.record(state(122), "二");
  history.undo();
  history.record(state(130), "分支");
  assert.equal(history.canRedo(), false);
  history.record(state(140), "三");
  assert.deepEqual(history.entries.map(({ state: entry }) => entry.tempo), [121, 130, 140]);
});

test("history exports and restores its current pointer", () => {
  const history = new ProjectHistory();
  history.record(state(120), "初始");
  history.record(state(130), "调整");
  history.undo();
  const restored = ProjectHistory.restore(history.export());
  assert.equal(restored.current().state.tempo, 120);
  assert.equal(restored.canRedo(), true);
});

test("workspace mode changes are semantic history steps", () => {
  const history = new ProjectHistory();
  history.record({ ...state(120), workspaceMode: "loop" }, "Loop Mode");
  assert.equal(history.record({ ...state(120), workspaceMode: "song" }, "Song Mode"), true);
  assert.equal(history.undo().state.workspaceMode, "loop");
  assert.equal(history.redo().state.workspaceMode, "song");
});
