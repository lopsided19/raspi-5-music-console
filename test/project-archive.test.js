import test from "node:test";
import assert from "node:assert/strict";
import { createProjectArchive, parseProjectArchive } from "../src/project-archive.js";

test("a project archive preserves settings and all instrument tracks", () => {
  const tracks = new Map([
    ["melody", new Map([[4, { x: 0.25, y: 0.75 }]])],
    ["bass", new Map([[9, { x: 0.5, y: 0.4 }]])],
  ]);
  const archive = createProjectArchive({
    tempo: 132,
    trackLoopBars: new Map([["melody", 1], ["bass", 3]]),
    scaleKey: "dorian",
    currentInstrumentId: "bass",
    workspaceMode: "song",
    mutedTrackIds: new Set(["melody"]),
    soloTrackIds: new Set(["bass"]),
    tracks,
    savedAt: "2026-08-06T10:00:00.000Z",
  });
  const restored = parseProjectArchive(JSON.stringify(archive), ["melody", "bass"]);

  assert.equal(restored.tempo, 132);
  assert.equal(restored.scaleKey, "dorian");
  assert.equal(restored.workspaceMode, "song");
  assert.deepEqual([...restored.trackLoopBars], [["melody", 1], ["bass", 3]]);
  assert.deepEqual([...restored.mutedTrackIds], ["melody"]);
  assert.deepEqual([...restored.soloTrackIds], ["bass"]);
  assert.deepEqual(restored.tracks.get("melody").get(4), { x: 0.25, y: 0.75 });
  assert.deepEqual(restored.tracks.get("bass").get(9), { x: 0.5, y: 0.4 });
});

test("invalid track entries are ignored when an archive is restored", () => {
  const restored = parseProjectArchive({
    version: 1,
    tempo: 120,
    loopBars: 4,
    tracks: { melody: [["wrong", { x: 2, y: 2 }], [3, { x: -1, y: 4 }]] },
  }, ["melody"]);

  assert.equal(restored.tracks.get("melody").size, 1);
  assert.deepEqual(restored.tracks.get("melody").get(3), { x: 0, y: 1 });
  assert.deepEqual([...restored.mutedTrackIds], []);
  assert.deepEqual([...restored.soloTrackIds], []);
  assert.deepEqual([...restored.trackLoopBars], [["melody", 4]]);
  assert.equal(restored.workspaceMode, "loop");
});

test("invalid workspace modes fall back to Loop Mode", () => {
  const restored = parseProjectArchive({
    version: 1,
    tempo: 120,
    workspaceMode: "arranger",
    tracks: {},
  }, ["melody"]);

  assert.equal(restored.workspaceMode, "loop");
});

test("legacy global loop length archives apply that length to every track", () => {
  const restored = parseProjectArchive({
    version: 1,
    tempo: 120,
    loopBars: 2,
    tracks: {},
  }, ["melody", "bass"]);

  assert.deepEqual([...restored.trackLoopBars], [["melody", 2], ["bass", 2]]);
});

test("archives preserve loop lengths through sixteen bars", () => {
  const restored = parseProjectArchive({
    version: 1,
    tempo: 120,
    trackLoopBars: { melody: 16 },
    tracks: {},
  }, ["melody"]);

  assert.deepEqual([...restored.trackLoopBars], [["melody", 16]]);
});

test("song arrangement data is copied into archives instead of retained by reference", () => {
  const song = { version: 1, currentSectionId: "intro", sections: { intro: { baseBars: 16 } } };
  const archive = createProjectArchive({
    tempo: 120,
    trackLoopBars: new Map([["melody", 1]]),
    scaleKey: "major",
    currentInstrumentId: "melody",
    tracks: new Map([["melody", new Map()]]),
    song,
  });
  song.sections.intro.baseBars = 32;
  assert.equal(archive.song.sections.intro.baseBars, 16);
});
