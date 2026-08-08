import test from "node:test";
import assert from "node:assert/strict";
import {
  beginSongLoopLengthEdit,
  cancelSongLoopLengthEdit,
  createSongLoopAt,
  createSongProject,
  deleteSongClip,
  deselectSongClip,
  expandSongClipForRecording,
  mergeSongClipWithNext,
  moveSongClip,
  nextAdjacentSongClip,
  placeSongLoopAt,
  previewSongLoopLengthEdit,
  resizeSongClip,
  resizeSongClipStart,
  restoreSongProject,
  sectionBars,
  sectionLoopRange,
  selectSongClip,
  selectedPerformanceLoops,
  selectedSongLoop,
  setSongSectionLength,
  setSongSectionLoopRange,
  songClipPathData,
  songPlaybackRangeStateAfterChange,
  songPointAtAbsoluteStep,
  songRecordingTargetAtAbsoluteStep,
  songSectionLoopStartPlaybackState,
  songSectionStepAtTransportStep,
  songSectionTransitionAtNextBar,
  splitSongClip,
  syncPerformanceLoopsToSong,
  syncPerformanceTrackToSong,
} from "../src/song.js";

function sourceProject() {
  const tracks = new Map([
    ["melody", new Map([[0, { x: 0.25, y: 0.75 }]])],
    ["bass", new Map([[31, { x: 0.6, y: 0.4 }]])],
  ]);
  const bars = new Map([["melody", 2], ["bass", 1]]);
  return { song: createSongProject(["melody", "bass"], tracks, bars), tracks, bars };
}

function songLoopNumber(song, trackId, loopId) {
  return song.loopsByTrack[trackId].find((loop) => loop.id === loopId)?.number;
}

test("a new song contains six fixed 16-bar sections with every source loop at bar zero", () => {
  const { song } = sourceProject();
  assert.deepEqual(Object.keys(song.sections), ["intro", "verse", "pre-chorus", "chorus", "bridge", "outro"]);
  assert.equal(sectionBars(song.sections.intro), 16);
  assert.equal(song.sections.intro.tracks.melody.clips[0].lengthBars, 2);
  assert.equal(song.sections.chorus.tracks.bass.selectedClipId, "chorus-bass-clip-1");
  assert.equal(song.arrangerSplitRatio, 0.62);
});

test("the arranger split ratio survives restoration and legacy songs receive the default", () => {
  const { song, tracks, bars } = sourceProject();
  song.arrangerSplitRatio = 0.7;
  assert.equal(restoreSongProject(song, ["melody", "bass"], tracks, bars).arrangerSplitRatio, 0.7);

  delete song.arrangerSplitRatio;
  assert.equal(restoreSongProject(song, ["melody", "bass"], tracks, bars).arrangerSplitRatio, 0.62);

  song.arrangerSplitRatio = 2;
  assert.equal(restoreSongProject(song, ["melody", "bass"], tracks, bars).arrangerSplitRatio, 0.8);
});

test("section length combines one base length with independently selected additions", () => {
  const { song } = sourceProject();
  assert.equal(setSongSectionLength(song, "verse", 8, [1, 4, 16]), true);
  assert.equal(sectionBars(song.sections.verse), 29);
  assert.equal(setSongSectionLength(song, "verse", 8, [16, 4, 1]), false);
});

test("each section defaults to a full-length loop range and full ranges follow section resizing", () => {
  const { song } = sourceProject();
  assert.deepEqual(sectionLoopRange(song.sections.intro), { startBar: 0, endBar: 16, lengthBars: 16 });
  assert.equal(setSongSectionLength(song, "intro", 32, []), true);
  assert.deepEqual(sectionLoopRange(song.sections.intro), { startBar: 0, endBar: 32, lengthBars: 32 });
});

test("custom section loop ranges persist through resizing and map transport steps cyclically", () => {
  const { song } = sourceProject();
  assert.equal(setSongSectionLoopRange(song, "verse", 4, 12), true);
  assert.deepEqual(sectionLoopRange(song.sections.verse), { startBar: 4, endBar: 12, lengthBars: 8 });
  assert.equal(songSectionStepAtTransportStep(song.sections.verse, 0), 4 * 128);
  assert.equal(songSectionStepAtTransportStep(song.sections.verse, 8 * 128), 4 * 128);
  assert.equal(songSectionStepAtTransportStep(song.sections.verse, -1), 12 * 128 - 1);

  assert.equal(setSongSectionLength(song, "verse", 8, []), true);
  assert.deepEqual(sectionLoopRange(song.sections.verse), { startBar: 4, endBar: 8, lengthBars: 4 });
});

test("moving the loop end behind playback waits for the current bar before jumping to the start", () => {
  const { song } = sourceProject();
  const section = song.sections.intro;
  const transportStep = 700;
  const currentSectionStep = 6 * 128 + 40;
  setSongSectionLoopRange(song, "intro", 0, 4);
  const state = songPlaybackRangeStateAfterChange(
    section,
    "end",
    transportStep,
    currentSectionStep
  );
  const jumpAt = transportStep + 88;
  assert.equal(state.pending.jumpAtTransportStep, jumpAt);
  assert.equal(songSectionStepAtTransportStep(section, jumpAt - 1, state), 7 * 128 - 1);
  assert.equal(songSectionStepAtTransportStep(section, jumpAt, state), 0);
  assert.equal(songSectionStepAtTransportStep(section, jumpAt + 128, state), 128);
});

test("moving the loop start ahead of playback also finishes the current bar before jumping", () => {
  const { song } = sourceProject();
  const section = song.sections.intro;
  const transportStep = 300;
  const currentSectionStep = 2 * 128 + 64;
  setSongSectionLoopRange(song, "intro", 4, 12);
  const state = songPlaybackRangeStateAfterChange(
    section,
    "start",
    transportStep,
    currentSectionStep
  );
  const jumpAt = transportStep + 64;
  assert.equal(songSectionStepAtTransportStep(section, jumpAt - 1, state), 3 * 128 - 1);
  assert.equal(songSectionStepAtTransportStep(section, jumpAt, state), 4 * 128);
  assert.equal(songSectionStepAtTransportStep(section, jumpAt + 8 * 128, state), 4 * 128);
});

test("range edits that do not pass the playhead preserve continuous playback", () => {
  const { song } = sourceProject();
  const section = song.sections.intro;
  const transportStep = 500;
  const currentSectionStep = 2 * 128 + 40;
  setSongSectionLoopRange(song, "intro", 0, 8);
  const state = songPlaybackRangeStateAfterChange(
    section,
    "end",
    transportStep,
    currentSectionStep
  );
  assert.equal(state.pending, null);
  assert.equal(songSectionStepAtTransportStep(section, transportStep, state), currentSectionStep);
  assert.equal(songSectionStepAtTransportStep(section, transportStep + 1, state), currentSectionStep + 1);
});

test("section changes queue at the end of the current bar", () => {
  const { song } = sourceProject();
  const transition = songSectionTransitionAtNextBar(song, "verse", 40.25, 2 * 128 + 40.25);
  assert.deepEqual(transition, {
    fromSectionId: "intro",
    targetSectionId: "verse",
    switchAtTransportStep: 128,
  });
  assert.equal(songSectionTransitionAtNextBar(song, "intro", 40, 40), null);
  assert.equal(songSectionTransitionAtNextBar(song, "missing", 40, 40), null);
});

test("a transitioned section starts exactly at its loop control start", () => {
  const { song } = sourceProject();
  setSongSectionLoopRange(song, "verse", 4, 12);
  const playbackState = songSectionLoopStartPlaybackState(song.sections.verse, 128);
  assert.equal(songSectionStepAtTransportStep(song.sections.verse, 127, playbackState), 12 * 128 - 1);
  assert.equal(songSectionStepAtTransportStep(song.sections.verse, 128, playbackState), 4 * 128);
  assert.equal(songSectionStepAtTransportStep(song.sections.verse, 129, playbackState), 4 * 128 + 1);
});

test("legacy sections restore with a full loop range while saved custom ranges survive", () => {
  const { song, tracks, bars } = sourceProject();
  setSongSectionLoopRange(song, "intro", 2, 10);
  delete song.sections.verse.loopStartBar;
  delete song.sections.verse.loopEndBar;
  const restored = restoreSongProject(song, ["melody", "bass"], tracks, bars);
  assert.deepEqual(sectionLoopRange(restored.sections.intro), { startBar: 2, endBar: 10, lengthBars: 8 });
  assert.deepEqual(sectionLoopRange(restored.sections.verse), { startBar: 0, endBar: 16, lengthBars: 16 });
});

test("a newly recorded source starts empty, numbered, one bar long, and selected", () => {
  const { song } = sourceProject();
  const clip = createSongLoopAt(song, "intro", "melody", 5);
  assert.equal(clip.startBar, 5);
  assert.equal(song.sections.intro.tracks.melody.selectedClipId, clip.id);
  assert.equal(song.loopsByTrack.melody.at(-1).bars, 1);
  assert.equal(song.loopsByTrack.melody.at(-1).number, 2);
  assert.deepEqual(song.loopsByTrack.melody.at(-1).points, {});
  assert.equal(createSongLoopAt(song, "intro", "melody", 5), null);
});

test("clips move without overlap and extend in whole bars by cycling their source", () => {
  const { song } = sourceProject();
  const first = song.sections.intro.tracks.melody.clips[0];
  const second = createSongLoopAt(song, "intro", "melody", 8);
  assert.equal(moveSongClip(song, "intro", "melody", first.id, 4), true);
  assert.equal(moveSongClip(song, "intro", "melody", first.id, 7), false);
  assert.equal(resizeSongClip(song, "intro", "melody", first.id, 4), true);
  assert.equal(first.lengthBars, 4);
  assert.equal(resizeSongClip(song, "intro", "melody", first.id, 7), false);
  assert.equal(resizeSongClip(song, "intro", "melody", first.id, 1), true);
  assert.equal(first.lengthBars, 1);
  assert.equal(selectSongClip(song, "intro", "melody", second.id), false);
});

test("a placement can be deselected without forgetting its performance loop", () => {
  const { song, tracks, bars } = sourceProject();
  const arrangement = song.sections.intro.tracks.melody;
  const selectedLoopId = arrangement.selectedLoopId;
  assert.equal(deselectSongClip(song, "intro", "melody"), true);
  assert.equal(arrangement.selectedClipId, null);
  assert.equal(selectedSongLoop(song, "intro", "melody").id, selectedLoopId);
  const restored = restoreSongProject(song, ["melody", "bass"], tracks, bars);
  assert.equal(restored.sections.intro.tracks.melody.selectedClipId, null);
  assert.equal(selectedSongLoop(restored, "intro", "melody").id, selectedLoopId);
});

test("editing a single-cycle loop length resizes its placement when blank space is available", () => {
  const { song } = sourceProject();
  const clip = song.sections.intro.tracks.melody.clips[0];
  const edit = beginSongLoopLengthEdit(song, "intro", "melody", clip.id);
  const expanded = previewSongLoopLengthEdit(song, edit, 6);
  assert.equal(expanded.blocked, false);
  assert.equal(expanded.handleBar, 6);
  assert.equal(clip.lengthBars, 6);
  assert.equal(song.loopsByTrack.melody[0].bars, 6);

  const shortened = previewSongLoopLengthEdit(song, edit, 1);
  assert.equal(shortened.blocked, false);
  assert.equal(clip.lengthBars, 1);
  assert.equal(cancelSongLoopLengthEdit(song, edit), true);
  assert.equal(clip.lengthBars, 2);
  assert.equal(song.loopsByTrack.melody[0].bars, 2);
});

test("editing a repeated loop moves cycle boundaries without changing the placement end", () => {
  const { song } = sourceProject();
  const clip = song.sections.intro.tracks.melody.clips[0];
  resizeSongClip(song, "intro", "melody", clip.id, 8);
  const edit = beginSongLoopLengthEdit(song, "intro", "melody", clip.id);
  const preview = previewSongLoopLengthEdit(song, edit, 3);
  assert.equal(preview.firstCycleBars, 3);
  assert.equal(preview.clipLengthBars, 8);
  assert.equal(clip.lengthBars, 8);
});

test("a blocked loop-length extension is previewed without extending arrangement playback", () => {
  const { song } = sourceProject();
  const clip = song.sections.intro.tracks.melody.clips[0];
  createSongLoopAt(song, "intro", "melody", 5);
  selectSongClip(song, "intro", "melody", clip.id);
  const edit = beginSongLoopLengthEdit(song, "intro", "melody", clip.id);
  const preview = previewSongLoopLengthEdit(song, edit, 8);
  assert.equal(preview.blocked, true);
  assert.equal(preview.ghostStartBar, 2);
  assert.equal(preview.ghostEndBar, 8);
  assert.equal(clip.lengthBars, 2);
  assert.equal(song.loopsByTrack.melody[0].bars, 8);
});

test("dragging a clip start trims playback without changing its fixed end", () => {
  const { song } = sourceProject();
  const clip = song.sections.intro.tracks.melody.clips[0];
  assert.equal(resizeSongClip(song, "intro", "melody", clip.id, 4), true);
  assert.equal(resizeSongClipStart(song, "intro", "melody", clip.id, 1), true);
  assert.deepEqual(
    { startBar: clip.startBar, lengthBars: clip.lengthBars, sourceOffsetBars: clip.sourceOffsetBars },
    { startBar: 1, lengthBars: 3, sourceOffsetBars: 1 }
  );
  assert.equal(resizeSongClipStart(song, "intro", "melody", clip.id, 0), true);
  assert.deepEqual(
    { startBar: clip.startBar, lengthBars: clip.lengthBars, sourceOffsetBars: clip.sourceOffsetBars },
    { startBar: 0, lengthBars: 4, sourceOffsetBars: 0 }
  );
});

test("splitting creates two placements of the same numbered loop with complementary offsets", () => {
  const { song } = sourceProject();
  const clip = song.sections.intro.tracks.melody.clips[0];
  assert.equal(resizeSongClip(song, "intro", "melody", clip.id, 4), true);
  const split = splitSongClip(song, "intro", "melody", clip.id, 3);
  assert.equal(split.leftClip.lengthBars, 3);
  assert.equal(split.rightClip.startBar, 3);
  assert.equal(split.rightClip.lengthBars, 1);
  assert.equal(split.rightClip.loopId, split.leftClip.loopId);
  assert.equal(split.rightClip.sourceOffsetBars, 1);
  assert.equal(song.loopsByTrack.melody.length, 1);
});

test("merging bakes only the two placements' audible contents and preserves the removed source", () => {
  const { song } = sourceProject();
  const first = song.sections.intro.tracks.melody.clips[0];
  assert.equal(resizeSongClip(song, "intro", "melody", first.id, 1), true);
  const second = createSongLoopAt(song, "intro", "melody", 1, 2);
  const secondSource = song.loopsByTrack.melody.find((loop) => loop.id === second.loopId);
  secondSource.points = {
    0: { x: 0.8, y: 0.2 },
    128: { x: 0.9, y: 0.1 },
  };
  assert.equal(resizeSongClip(song, "intro", "melody", second.id, 1), true);

  assert.equal(nextAdjacentSongClip(song, "intro", "melody", first.id).id, second.id);
  const merged = mergeSongClipWithNext(song, "intro", "melody", first.id);
  assert.equal(merged.loop.bars, 2);
  assert.deepEqual(merged.loop.points, {
    0: { x: 0.25, y: 0.75 },
    128: { x: 0.8, y: 0.2 },
  });
  assert.equal(song.sections.intro.tracks.melody.clips.some((clip) => clip.id === second.id), false);
  assert.ok(song.loopsByTrack.melody.some((loop) => loop.id === secondSource.id));
});

test("recording expansion grows an empty loop continuously but stops at sixteen bars", () => {
  const { song } = sourceProject();
  const clip = createSongLoopAt(song, "intro", "melody", 0, 1);
  assert.equal(clip, null);
  const original = song.sections.intro.tracks.melody.clips[0];
  const loop = song.loopsByTrack.melody[0];
  loop.points = {};
  loop.bars = 1;
  original.lengthBars = 1;
  assert.equal(expandSongClipForRecording(song, "intro", "melody", original.id, 5 * 128), true);
  assert.equal(original.lengthBars, 6);
  assert.equal(loop.bars, 6);
  assert.equal(expandSongClipForRecording(song, "intro", "melody", original.id, 20 * 128), true);
  assert.equal(original.lengthBars, 16);
  assert.equal(loop.bars, 16);
});

test("expanded recording keeps targeting one source instead of creating a loop at each boundary", () => {
  const { song } = sourceProject();
  const clip = song.sections.intro.tracks.melody.clips[0];
  const loop = song.loopsByTrack.melody[0];
  loop.points = {};
  loop.bars = 1;
  clip.lengthBars = 1;

  assert.equal(expandSongClipForRecording(song, "intro", "melody", clip.id, 4 * 128), true);
  const target = songRecordingTargetAtAbsoluteStep(song, "intro", "melody", 4 * 128, {
    createIfMissing: true,
    loopBars: 1,
  });
  assert.equal(target.loop.id, loop.id);
  assert.equal(target.clip.id, clip.id);
  assert.equal(song.loopsByTrack.melody.length, 1);
  assert.equal(clip.lengthBars, 5);
});

test("source loops receive track-local numbers and can be placed without duplicating their material", () => {
  const { song } = sourceProject();
  const melodyTwo = createSongLoopAt(song, "intro", "melody", 5);
  const melodyThree = createSongLoopAt(song, "intro", "melody", 7);
  const bassTwo = createSongLoopAt(song, "intro", "bass", 5);

  assert.equal(songLoopNumber(song, "melody", melodyTwo.loopId), 2);
  assert.equal(songLoopNumber(song, "melody", melodyThree.loopId), 3);
  assert.equal(songLoopNumber(song, "bass", bassTwo.loopId), 2);

  const reused = placeSongLoopAt(song, "intro", "melody", melodyTwo.loopId, 6);
  assert.equal(reused.loopId, melodyTwo.loopId);
  assert.equal(reused.lengthBars, 1);
  assert.equal(song.loopsByTrack.melody.length, 3);
});

test("deleting a placement preserves its numbered source loop, including after restoration", () => {
  const { song, tracks, bars } = sourceProject();
  const original = song.sections.intro.tracks.melody.clips[0];
  const sourceId = original.loopId;
  assert.ok(deleteSongClip(song, "intro", "melody", original.id));
  assert.equal(song.sections.intro.tracks.melody.clips.length, 0);
  assert.equal(selectedSongLoop(song, "intro", "melody").id, sourceId);
  assert.ok(song.loopsByTrack.melody.some((loop) => loop.id === sourceId));

  const restored = restoreSongProject(song, ["melody", "bass"], tracks, bars);
  assert.equal(restored.sections.intro.tracks.melody.clips.length, 0);
  assert.equal(selectedSongLoop(restored, "intro", "melody").id, sourceId);
});

test("legacy Song data receives stable per-track loop numbers when restored", () => {
  const { song, tracks, bars } = sourceProject();
  const clip = createSongLoopAt(song, "intro", "melody", 5);
  delete song.nextLoopNumberByTrack;
  for (const loops of Object.values(song.loopsByTrack)) {
    for (const loop of loops) delete loop.number;
  }

  const restored = restoreSongProject(song, ["melody", "bass"], tracks, bars);
  assert.deepEqual(restored.loopsByTrack.melody.map((loop) => loop.number), [1, 2]);
  assert.equal(restored.nextLoopNumberByTrack.melody, 3);
  assert.equal(restored.sections.intro.tracks.melody.clips.at(-1).loopId, clip.loopId);
});

test("restoration preserves clip source offsets and gives legacy placements a zero offset", () => {
  const { song, tracks, bars } = sourceProject();
  const introClip = song.sections.intro.tracks.melody.clips[0];
  assert.equal(resizeSongClipStart(song, "intro", "melody", introClip.id, 1), true);
  delete song.sections.verse.tracks.melody.clips[0].sourceOffsetBars;

  const restored = restoreSongProject(song, ["melody", "bass"], tracks, bars);
  assert.equal(restored.sections.intro.tracks.melody.clips[0].sourceOffsetBars, 1);
  assert.equal(restored.sections.verse.tracks.melody.clips[0].sourceOffsetBars, 0);
});

test("recording targets the loop under the playhead and creates a fixed clip only in blank space", () => {
  const { song } = sourceProject();
  const existing = songRecordingTargetAtAbsoluteStep(song, "intro", "melody", 140, {
    createIfMissing: true,
    loopBars: 4,
  });
  assert.equal(existing.clip.id, "intro-melody-clip-1");
  assert.equal(existing.sourceStep, 140);
  assert.equal(existing.created, false);

  const created = songRecordingTargetAtAbsoluteStep(song, "intro", "melody", 4 * 128 + 20, {
    createIfMissing: true,
    loopBars: 4,
  });
  assert.equal(created.created, true);
  assert.equal(created.clip.startBar, 4);
  assert.equal(created.clip.lengthBars, 4);
  assert.equal(created.loop.bars, 4);
  assert.equal(created.loop.number, 2);
  assert.equal(created.sourceStep, 20);

  created.loop.points[created.sourceStep] = { x: 0.7, y: 0.3 };
  const samePosition = songRecordingTargetAtAbsoluteStep(song, "intro", "melody", 4 * 128 + 20);
  assert.equal(samePosition.loop.id, created.loop.id);
  assert.deepEqual(songPointAtAbsoluteStep(song, "intro", "melody", 4 * 128 + 20), { x: 0.7, y: 0.3 });
});

test("synchronizing source contents never expands a deliberately shortened placement", () => {
  const { song, tracks, bars } = sourceProject();
  const clip = song.sections.intro.tracks.melody.clips[0];
  assert.equal(resizeSongClip(song, "intro", "melody", clip.id, 1), true);
  syncPerformanceLoopsToSong(song, "intro", tracks, bars);
  assert.equal(clip.lengthBars, 1);
});

test("the selected loop becomes the editable performance loop when returning", () => {
  const { song } = sourceProject();
  const clip = createSongLoopAt(song, "verse", "melody", 4);
  const selected = selectedPerformanceLoops(song, "verse", ["melody", "bass"]);
  assert.equal(selected.trackLoopBars.get("melody"), 1);
  assert.equal(selected.tracks.get("melody").size, 0);

  selected.tracks.get("melody").set(7, { x: 0.9, y: 0.2 });
  selected.trackLoopBars.set("melody", 3);
  syncPerformanceLoopsToSong(song, "verse", selected.tracks, selected.trackLoopBars);
  assert.equal(song.loopsByTrack.melody.find((loop) => loop.id === clip.loopId).bars, 3);
});

test("live Song Mode recording updates only the selected source loop", () => {
  const { song } = sourceProject();
  const newClip = createSongLoopAt(song, "intro", "melody", 6);
  const liveTrack = new Map([[12, { x: 0.8, y: 0.2 }]]);

  const loop = syncPerformanceTrackToSong(song, "intro", "melody", liveTrack, 1);

  assert.equal(loop.id, newClip.loopId);
  assert.deepEqual(loop.points, { 12: { x: 0.8, y: 0.2 } });
  assert.deepEqual(song.loopsByTrack.melody[0].points, { 0: { x: 0.25, y: 0.75 } });
});

test("arrangement playback is silent outside clips and cycles only inside an extended clip", () => {
  const { song } = sourceProject();
  const clip = song.sections.intro.tracks.melody.clips[0];
  resizeSongClip(song, "intro", "melody", clip.id, 3);
  assert.deepEqual(songPointAtAbsoluteStep(song, "intro", "melody", 0), { x: 0.25, y: 0.75 });
  assert.deepEqual(songPointAtAbsoluteStep(song, "intro", "melody", 256), { x: 0.25, y: 0.75 });
  assert.equal(songPointAtAbsoluteStep(song, "intro", "melody", 384), null);
});

test("trimmed clips begin playback from their stored source offset", () => {
  const { song } = sourceProject();
  const clip = song.sections.intro.tracks.melody.clips[0];
  const loop = song.loopsByTrack.melody[0];
  loop.points[128] = { x: 0.8, y: 0.2 };
  assert.equal(resizeSongClipStart(song, "intro", "melody", clip.id, 1), true);
  assert.deepEqual(songPointAtAbsoluteStep(song, "intro", "melody", 128), { x: 0.8, y: 0.2 });
});

test("clip thumbnail paths repeat source data across the extended region", () => {
  const loop = { bars: 1, points: { 0: { x: 0.25, y: 0.7 } } };
  const path = songClipPathData(loop, 2);
  assert.match(path, /M 0 74\.5/);
  assert.match(path, /M 50 74\.5/);
});

test("clip thumbnail paths honor a trimmed source offset", () => {
  const loop = { bars: 2, points: { 128: { x: 0.75, y: 0.2 } } };
  const path = songClipPathData(loop, 1, 1);
  assert.match(path, /M 0 25\.5/);
});
