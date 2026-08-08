import { loopStepCount } from "./loop.js";

export const SONG_SECTIONS = [
  { id: "intro", label: "Intro" },
  { id: "verse", label: "Verse" },
  { id: "pre-chorus", label: "Pre-Cho" },
  { id: "chorus", label: "Chorus" },
  { id: "bridge", label: "Bridge" },
  { id: "outro", label: "Outro" },
];

export const SECTION_BASE_LENGTHS = [4, 8, 16, 32];
export const SECTION_EXTRA_LENGTHS = [1, 2, 4, 8, 16];
export const DEFAULT_SECTION_BARS = 16;
export const DEFAULT_ARRANGER_SPLIT_RATIO = 0.62;
export const MAX_LOOP_BARS = 16;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function validLoopBars(value) {
  return clamp(Number.isInteger(value) ? value : 1, 1, MAX_LOOP_BARS);
}

function normalizedSourceOffsetBars(value, loopBars) {
  const offset = Number.isFinite(value) ? Math.round(value) : 0;
  return ((offset % loopBars) + loopBars) % loopBars;
}

function validLoopNumber(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function validArrangerSplitRatio(value) {
  return Number.isFinite(value) ? clamp(value, 0.2, 0.8) : DEFAULT_ARRANGER_SPLIT_RATIO;
}

function normalizedPoint(point) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return null;
  return { x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) };
}

function pointsFromTrack(track) {
  return Object.fromEntries([...track].flatMap(([step, point]) => {
    const normalized = normalizedPoint(point);
    return Number.isInteger(step) && step >= 0 && normalized ? [[step, normalized]] : [];
  }));
}

function normalizedPoints(rawPoints) {
  if (!rawPoints || typeof rawPoints !== "object") return {};
  return Object.fromEntries(Object.entries(rawPoints).flatMap(([rawStep, point]) => {
    const step = Number(rawStep);
    const normalized = normalizedPoint(point);
    return Number.isInteger(step) && step >= 0 && normalized ? [[step, normalized]] : [];
  }));
}

function loopIdFor(trackId) {
  return `${trackId}-loop-1`;
}

function clipIdFor(sectionId, trackId) {
  return `${sectionId}-${trackId}-clip-1`;
}

function baseSection(sectionDefinition, trackIds, loopBarsByTrack) {
  return {
    id: sectionDefinition.id,
    label: sectionDefinition.label,
    baseBars: DEFAULT_SECTION_BARS,
    extraBars: [],
    loopStartBar: 0,
    loopEndBar: DEFAULT_SECTION_BARS,
    tracks: Object.fromEntries(trackIds.map((trackId) => {
      const clipId = clipIdFor(sectionDefinition.id, trackId);
      return [trackId, {
        selectedClipId: clipId,
        selectedLoopId: loopIdFor(trackId),
        clips: [{
          id: clipId,
          loopId: loopIdFor(trackId),
          startBar: 0,
          lengthBars: loopBarsByTrack[trackId],
          sourceOffsetBars: 0,
        }],
      }];
    })),
  };
}

export function createSongProject(trackIds, tracks, trackLoopBars) {
  const loopBarsByTrack = Object.fromEntries(trackIds.map((trackId) => [
    trackId,
    validLoopBars(trackLoopBars.get(trackId)),
  ]));
  return {
    version: 1,
    currentSectionId: SONG_SECTIONS[0].id,
    arrangerSplitRatio: DEFAULT_ARRANGER_SPLIT_RATIO,
    nextId: 2,
    nextLoopNumberByTrack: Object.fromEntries(trackIds.map((trackId) => [trackId, 2])),
    loopsByTrack: Object.fromEntries(trackIds.map((trackId) => [trackId, [{
      id: loopIdFor(trackId),
      number: 1,
      bars: loopBarsByTrack[trackId],
      points: pointsFromTrack(tracks.get(trackId) ?? new Map()),
    }]])),
    sections: Object.fromEntries(SONG_SECTIONS.map((section) => [
      section.id,
      baseSection(section, trackIds, loopBarsByTrack),
    ])),
  };
}

export function sectionBars(section) {
  const base = SECTION_BASE_LENGTHS.includes(section?.baseBars) ? section.baseBars : DEFAULT_SECTION_BARS;
  const extras = Array.isArray(section?.extraBars)
    ? [...new Set(section.extraBars.filter((bars) => SECTION_EXTRA_LENGTHS.includes(bars)))]
    : [];
  return base + extras.reduce((total, bars) => total + bars, 0);
}

export function sectionLoopRange(section) {
  const totalBars = sectionBars(section);
  const startBar = clamp(Number.isFinite(section?.loopStartBar) ? Math.round(section.loopStartBar) : 0, 0, totalBars - 1);
  const endBar = clamp(
    Number.isFinite(section?.loopEndBar) ? Math.round(section.loopEndBar) : totalBars,
    startBar + 1,
    totalBars
  );
  return { startBar, endBar, lengthBars: endBar - startBar };
}

export function setSongSectionLoopRange(song, sectionId, startBar, endBar) {
  const section = song.sections[sectionId];
  if (!section) return false;
  const totalBars = sectionBars(section);
  const nextStartBar = clamp(Math.round(startBar), 0, totalBars - 1);
  const nextEndBar = clamp(Math.round(endBar), nextStartBar + 1, totalBars);
  const current = sectionLoopRange(section);
  if (current.startBar === nextStartBar && current.endBar === nextEndBar) return false;
  section.loopStartBar = nextStartBar;
  section.loopEndBar = nextEndBar;
  return true;
}

export function songPlaybackRangeStateAfterChange(section, edge, transportStep, currentSectionStep) {
  const range = sectionLoopRange(section);
  const rangeStartStep = loopStepCount(range.startBar);
  const rangeEndStep = loopStepCount(range.endBar);
  const boundaryPassedPlayhead = edge === "end"
    ? rangeEndStep <= currentSectionStep
    : rangeStartStep > currentSectionStep;
  if (boundaryPassedPlayhead) {
    const nextBarStep = (Math.floor(currentSectionStep / loopStepCount(1)) + 1) * loopStepCount(1);
    const jumpAtTransportStep = transportStep + nextBarStep - currentSectionStep;
    return {
      sectionId: section.id,
      anchorTransportStep: jumpAtTransportStep,
      anchorSectionStep: rangeStartStep,
      pending: {
        transportStep,
        sectionStep: currentSectionStep,
        jumpAtTransportStep,
      },
    };
  }

  const anchorSectionStep = currentSectionStep >= rangeStartStep && currentSectionStep < rangeEndStep
    ? currentSectionStep
    : rangeStartStep;
  return {
    sectionId: section.id,
    anchorTransportStep: transportStep,
    anchorSectionStep,
    pending: null,
  };
}

export function songSectionTransitionAtNextBar(song, targetSectionId, transportStep, currentSectionStep) {
  if (!song?.sections?.[targetSectionId]
    || targetSectionId === song.currentSectionId
    || !Number.isFinite(transportStep)
    || !Number.isFinite(currentSectionStep)) return null;
  const stepsPerBar = loopStepCount(1);
  const nextSectionBarStep = (Math.floor(currentSectionStep / stepsPerBar) + 1) * stepsPerBar;
  return {
    fromSectionId: song.currentSectionId,
    targetSectionId,
    switchAtTransportStep: Math.round(transportStep + nextSectionBarStep - currentSectionStep),
  };
}

export function songSectionLoopStartPlaybackState(section, transportStep) {
  if (!section || !Number.isFinite(transportStep)) return null;
  return {
    sectionId: section.id,
    anchorTransportStep: transportStep,
    anchorSectionStep: loopStepCount(sectionLoopRange(section).startBar),
    pending: null,
  };
}

export function songSectionStepAtTransportStep(section, transportStep, playbackRangeState = null) {
  const state = playbackRangeState?.sectionId === section.id ? playbackRangeState : null;
  if (state?.pending && transportStep < state.pending.jumpAtTransportStep) {
    return state.pending.sectionStep + transportStep - state.pending.transportStep;
  }
  const range = sectionLoopRange(section);
  const rangeSteps = loopStepCount(range.lengthBars);
  const startStep = loopStepCount(range.startBar);
  const offset = state
    ? state.anchorSectionStep - startStep + transportStep - state.anchorTransportStep
    : transportStep;
  return startStep + ((offset % rangeSteps) + rangeSteps) % rangeSteps;
}

export function currentSongSection(song) {
  return song.sections[song.currentSectionId] ?? song.sections[SONG_SECTIONS[0].id];
}

export function songLoopById(song, trackId, loopId) {
  return song.loopsByTrack[trackId]?.find((loop) => loop.id === loopId) ?? null;
}

export function selectedSongClip(song, sectionId, trackId) {
  const arrangement = song.sections[sectionId]?.tracks?.[trackId];
  if (!arrangement) return null;
  return arrangement.clips.find((clip) => clip.id === arrangement.selectedClipId) ?? null;
}

export function selectedSongLoop(song, sectionId, trackId) {
  const arrangement = song.sections[sectionId]?.tracks?.[trackId];
  const clip = selectedSongClip(song, sectionId, trackId);
  return songLoopById(song, trackId, arrangement?.selectedLoopId)
    ?? (clip ? songLoopById(song, trackId, clip.loopId) : null)
    ?? song.loopsByTrack[trackId]?.[0]
    ?? null;
}

function clipsOverlap(first, second) {
  return first.startBar < second.startBar + second.lengthBars
    && second.startBar < first.startBar + first.lengthBars;
}

function normalizeArrangement(song, section, trackId) {
  const arrangement = section.tracks[trackId];
  const totalBars = sectionBars(section);
  const selectedLoopId = arrangement.selectedLoopId
    ?? arrangement.clips.find((clip) => clip.id === arrangement.selectedClipId)?.loopId;
  const normalizedClips = [];

  for (const rawClip of [...arrangement.clips].sort((a, b) => a.startBar - b.startBar)) {
    const loop = songLoopById(song, trackId, rawClip.loopId);
    if (!loop) continue;
    let startBar = clamp(Math.round(rawClip.startBar), 0, Math.max(0, totalBars - 1));
    const previous = normalizedClips.at(-1);
    if (previous && startBar < previous.startBar + previous.lengthBars) {
      startBar = previous.startBar + previous.lengthBars;
    }
    if (startBar >= totalBars) continue;
    const nextLength = clamp(Math.round(rawClip.lengthBars), 1, totalBars - startBar);
    normalizedClips.push({
      id: String(rawClip.id),
      loopId: loop.id,
      startBar,
      lengthBars: nextLength,
      sourceOffsetBars: normalizedSourceOffsetBars(rawClip.sourceOffsetBars, loop.bars),
    });
  }

  arrangement.clips = normalizedClips;
  const preserveNoClipSelection = arrangement.selectedClipId === null;
  const selected = preserveNoClipSelection
    ? null
    : normalizedClips.find((clip) => clip.id === arrangement.selectedClipId)
      ?? normalizedClips.find((clip) => clip.loopId === selectedLoopId)
      ?? normalizedClips[0]
      ?? null;
  arrangement.selectedClipId = selected?.id ?? null;
  arrangement.selectedLoopId = selected?.loopId
    ?? (songLoopById(song, trackId, selectedLoopId) ? selectedLoopId : song.loopsByTrack[trackId][0]?.id);
}

export function restoreSongProject(rawSong, trackIds, tracks, trackLoopBars) {
  if (!rawSong || rawSong.version !== 1 || !rawSong.loopsByTrack || !rawSong.sections) {
    return createSongProject(trackIds, tracks, trackLoopBars);
  }

  const fallback = createSongProject(trackIds, tracks, trackLoopBars);
  const song = {
    version: 1,
    currentSectionId: SONG_SECTIONS.some(({ id }) => id === rawSong.currentSectionId)
      ? rawSong.currentSectionId
      : SONG_SECTIONS[0].id,
    arrangerSplitRatio: validArrangerSplitRatio(rawSong.arrangerSplitRatio),
    nextId: Number.isInteger(rawSong.nextId) && rawSong.nextId > 1 ? rawSong.nextId : 2,
    nextLoopNumberByTrack: {},
    loopsByTrack: {},
    sections: {},
  };

  for (const trackId of trackIds) {
    const usedNumbers = new Set();
    let fallbackNumber = 1;
    const restoredLoops = Array.isArray(rawSong.loopsByTrack[trackId])
      ? rawSong.loopsByTrack[trackId].flatMap((loop) => {
        if (typeof loop?.id !== "string") return [];
        let number = validLoopNumber(loop.number);
        if (number === null || usedNumbers.has(number)) {
          while (usedNumbers.has(fallbackNumber)) fallbackNumber += 1;
          number = fallbackNumber;
        }
        usedNumbers.add(number);
        fallbackNumber = Math.max(fallbackNumber, number + 1);
        return [{ id: loop.id, number, bars: validLoopBars(loop.bars), points: normalizedPoints(loop.points) }];
      })
      : [];
    song.loopsByTrack[trackId] = restoredLoops.length > 0
      ? restoredLoops
      : fallback.loopsByTrack[trackId];
    const nextNumber = Math.max(...song.loopsByTrack[trackId].map((loop) => loop.number)) + 1;
    song.nextLoopNumberByTrack[trackId] = Math.max(
      nextNumber,
      validLoopNumber(rawSong.nextLoopNumberByTrack?.[trackId]) ?? nextNumber
    );
  }

  for (const definition of SONG_SECTIONS) {
    const rawSection = rawSong.sections[definition.id];
    const section = {
      id: definition.id,
      label: definition.label,
      baseBars: SECTION_BASE_LENGTHS.includes(rawSection?.baseBars)
        ? rawSection.baseBars
        : DEFAULT_SECTION_BARS,
      extraBars: Array.isArray(rawSection?.extraBars)
        ? [...new Set(rawSection.extraBars.filter((bars) => SECTION_EXTRA_LENGTHS.includes(bars)))]
        : [],
      loopStartBar: Number(rawSection?.loopStartBar),
      loopEndBar: Number(rawSection?.loopEndBar),
      tracks: {},
    };
    const restoredRange = sectionLoopRange(section);
    section.loopStartBar = restoredRange.startBar;
    section.loopEndBar = restoredRange.endBar;

    for (const trackId of trackIds) {
      const rawArrangement = rawSection?.tracks?.[trackId];
      const clips = Array.isArray(rawArrangement?.clips)
        ? rawArrangement.clips.flatMap((clip) => (
          typeof clip?.id === "string" && typeof clip?.loopId === "string"
            ? [{
              id: clip.id,
              loopId: clip.loopId,
              startBar: Number(clip.startBar),
              lengthBars: Number(clip.lengthBars),
              sourceOffsetBars: Number(clip.sourceOffsetBars),
            }]
            : []
        ))
        : [];
      section.tracks[trackId] = rawArrangement && Array.isArray(rawArrangement.clips)
        ? {
          selectedClipId: rawArrangement.selectedClipId,
          selectedLoopId: rawArrangement.selectedLoopId,
          clips,
        }
        : fallback.sections[definition.id].tracks[trackId];
    }
    song.sections[definition.id] = section;
    for (const trackId of trackIds) normalizeArrangement(song, section, trackId);
  }

  return song;
}

export function selectSongClip(song, sectionId, trackId, clipId) {
  const arrangement = song.sections[sectionId]?.tracks?.[trackId];
  const clip = arrangement?.clips.find((candidate) => candidate.id === clipId);
  if (!clip) return false;
  if (arrangement.selectedClipId === clipId && arrangement.selectedLoopId === clip.loopId) return false;
  arrangement.selectedClipId = clipId;
  arrangement.selectedLoopId = clip.loopId;
  return true;
}

export function deselectSongClip(song, sectionId, trackId) {
  const arrangement = song.sections[sectionId]?.tracks?.[trackId];
  if (!arrangement || arrangement.selectedClipId === null) return false;
  arrangement.selectedClipId = null;
  return true;
}

export function beginSongLoopLengthEdit(song, sectionId, trackId, clipId) {
  const arrangement = song.sections[sectionId]?.tracks?.[trackId];
  const clip = arrangement?.clips.find((candidate) => candidate.id === clipId);
  const loop = clip ? songLoopById(song, trackId, clip.loopId) : null;
  if (!arrangement || !clip || !loop) return null;
  const placements = Object.entries(song.sections).flatMap(([candidateSectionId, section]) => (
    section.tracks[trackId]?.clips
      .filter((candidate) => candidate.loopId === loop.id)
      .map((candidate) => ({
        sectionId: candidateSectionId,
        clipId: candidate.id,
        sourceOffsetBars: candidate.sourceOffsetBars,
      })) ?? []
  ));
  return {
    sectionId,
    trackId,
    clipId,
    loopId: loop.id,
    originalLoopBars: loop.bars,
    originalClipLengthBars: clip.lengthBars,
    originalSourceOffsetBars: clip.sourceOffsetBars,
    placements,
  };
}

export function previewSongLoopLengthEdit(song, edit, desiredLoopBars) {
  const section = song.sections[edit?.sectionId];
  const arrangement = section?.tracks?.[edit?.trackId];
  const clip = arrangement?.clips.find((candidate) => candidate.id === edit?.clipId);
  const loop = edit ? songLoopById(song, edit.trackId, edit.loopId) : null;
  if (!section || !arrangement || !clip || !loop) return null;

  const loopBars = validLoopBars(Math.round(desiredLoopBars));
  loop.bars = loopBars;
  for (const placement of edit.placements) {
    const candidate = song.sections[placement.sectionId]?.tracks?.[edit.trackId]?.clips
      .find((item) => item.id === placement.clipId);
    if (candidate) candidate.sourceOffsetBars = normalizedSourceOffsetBars(placement.sourceOffsetBars, loopBars);
  }

  const originalOffset = normalizedSourceOffsetBars(edit.originalSourceOffsetBars, edit.originalLoopBars);
  const nextOffset = normalizedSourceOffsetBars(edit.originalSourceOffsetBars, loopBars);
  const originalFirstCycleBars = edit.originalLoopBars - originalOffset;
  const nextFirstCycleBars = loopBars - nextOffset;
  const followsSingleCycleEnd = edit.originalClipLengthBars === originalFirstCycleBars;
  const desiredClipLengthBars = followsSingleCycleEnd || nextFirstCycleBars > edit.originalClipLengthBars
    ? nextFirstCycleBars
    : edit.originalClipLengthBars;
  const nextClip = arrangement.clips
    .filter((candidate) => candidate.id !== clip.id && candidate.startBar > clip.startBar)
    .sort((first, second) => first.startBar - second.startBar)[0];
  const maximumClipLengthBars = (nextClip?.startBar ?? sectionBars(section)) - clip.startBar;
  const blocked = desiredClipLengthBars > maximumClipLengthBars;
  clip.lengthBars = blocked ? edit.originalClipLengthBars : desiredClipLengthBars;

  return {
    loopBars,
    clipLengthBars: clip.lengthBars,
    desiredClipLengthBars,
    firstCycleBars: nextFirstCycleBars,
    handleBar: clip.startBar + nextFirstCycleBars,
    blocked,
    ghostStartBar: blocked ? clip.startBar + edit.originalClipLengthBars : null,
    ghostEndBar: blocked ? clip.startBar + desiredClipLengthBars : null,
  };
}

export function cancelSongLoopLengthEdit(song, edit) {
  const arrangement = song.sections[edit?.sectionId]?.tracks?.[edit?.trackId];
  const clip = arrangement?.clips.find((candidate) => candidate.id === edit?.clipId);
  const loop = edit ? songLoopById(song, edit.trackId, edit.loopId) : null;
  if (!clip || !loop) return false;
  loop.bars = edit.originalLoopBars;
  clip.lengthBars = edit.originalClipLengthBars;
  for (const placement of edit.placements) {
    const candidate = song.sections[placement.sectionId]?.tracks?.[edit.trackId]?.clips
      .find((item) => item.id === placement.clipId);
    if (candidate) candidate.sourceOffsetBars = placement.sourceOffsetBars;
  }
  return true;
}

export function songClipAtBar(song, sectionId, trackId, bar) {
  const arrangement = song.sections[sectionId]?.tracks?.[trackId];
  return arrangement?.clips.find((clip) => bar >= clip.startBar && bar < clip.startBar + clip.lengthBars) ?? null;
}

export function placeSongLoopAt(song, sectionId, trackId, loopId, startBar) {
  const section = song.sections[sectionId];
  const arrangement = section?.tracks?.[trackId];
  const loop = songLoopById(song, trackId, loopId);
  const bar = Math.floor(startBar);
  if (!arrangement || !loop || bar < 0 || bar >= sectionBars(section) || songClipAtBar(song, sectionId, trackId, bar)) {
    return null;
  }

  const nextClip = arrangement.clips
    .filter((candidate) => candidate.startBar > bar)
    .sort((a, b) => a.startBar - b.startBar)[0];
  const availableBars = (nextClip?.startBar ?? sectionBars(section)) - bar;
  if (availableBars < 1) return null;
  const id = song.nextId++;
  const clip = {
    id: `${sectionId}-${trackId}-clip-${id}`,
    loopId: loop.id,
    startBar: bar,
    lengthBars: Math.min(loop.bars, availableBars),
    sourceOffsetBars: 0,
  };
  arrangement.clips.push(clip);
  arrangement.clips.sort((a, b) => a.startBar - b.startBar);
  arrangement.selectedClipId = clip.id;
  arrangement.selectedLoopId = loop.id;
  return clip;
}

export function createSongLoopAt(song, sectionId, trackId, startBar, loopBars = 1) {
  const section = song.sections[sectionId];
  const arrangement = section?.tracks?.[trackId];
  const bar = Math.floor(startBar);
  if (!arrangement || bar < 0 || bar >= sectionBars(section) || songClipAtBar(song, sectionId, trackId, bar)) {
    return null;
  }

  const id = song.nextId++;
  const number = song.nextLoopNumberByTrack[trackId] ?? 1;
  song.nextLoopNumberByTrack[trackId] = number + 1;
  const loop = {
    id: `${trackId}-loop-${id}`,
    number,
    bars: validLoopBars(loopBars),
    points: {},
  };
  song.loopsByTrack[trackId].push(loop);
  const clip = placeSongLoopAt(song, sectionId, trackId, loop.id, bar);
  if (clip) return clip;
  song.loopsByTrack[trackId].pop();
  return null;
}

export function deleteSongClip(song, sectionId, trackId, clipId) {
  const arrangement = song.sections[sectionId]?.tracks?.[trackId];
  const index = arrangement?.clips.findIndex((clip) => clip.id === clipId) ?? -1;
  if (index < 0) return null;
  const [removed] = arrangement.clips.splice(index, 1);
  if (arrangement.selectedClipId === clipId) {
    const replacement = arrangement.clips.find((clip) => clip.loopId === removed.loopId)
      ?? arrangement.clips[0]
      ?? null;
    arrangement.selectedClipId = replacement?.id ?? null;
    if (replacement) arrangement.selectedLoopId = replacement.loopId;
    else arrangement.selectedLoopId = removed.loopId;
  }
  return removed;
}

export function moveSongClip(song, sectionId, trackId, clipId, desiredStartBar) {
  const section = song.sections[sectionId];
  const arrangement = section?.tracks?.[trackId];
  const clip = arrangement?.clips.find((candidate) => candidate.id === clipId);
  if (!clip) return false;
  const startBar = clamp(Math.round(desiredStartBar), 0, sectionBars(section) - clip.lengthBars);
  const candidate = { ...clip, startBar };
  if (arrangement.clips.some((other) => other.id !== clip.id && clipsOverlap(candidate, other))) return false;
  if (startBar === clip.startBar) return false;
  clip.startBar = startBar;
  arrangement.clips.sort((a, b) => a.startBar - b.startBar);
  return true;
}

export function resizeSongClip(song, sectionId, trackId, clipId, desiredLengthBars) {
  const section = song.sections[sectionId];
  const arrangement = section?.tracks?.[trackId];
  const clip = arrangement?.clips.find((candidate) => candidate.id === clipId);
  if (!clip || !songLoopById(song, trackId, clip.loopId)) return false;

  const nextClip = arrangement.clips
    .filter((candidate) => candidate.id !== clip.id && candidate.startBar > clip.startBar)
    .sort((a, b) => a.startBar - b.startBar)[0];
  const maximum = (nextClip?.startBar ?? sectionBars(section)) - clip.startBar;
  const lengthBars = clamp(Math.round(desiredLengthBars), 1, maximum);
  if (lengthBars === clip.lengthBars) return false;
  clip.lengthBars = lengthBars;
  return true;
}

export function resizeSongClipStart(song, sectionId, trackId, clipId, desiredStartBar) {
  const section = song.sections[sectionId];
  const arrangement = section?.tracks?.[trackId];
  const clip = arrangement?.clips.find((candidate) => candidate.id === clipId);
  const loop = clip ? songLoopById(song, trackId, clip.loopId) : null;
  if (!clip || !loop) return false;

  const previousClip = arrangement.clips
    .filter((candidate) => candidate.id !== clip.id && candidate.startBar < clip.startBar)
    .sort((a, b) => b.startBar - a.startBar)[0];
  const minimum = previousClip ? previousClip.startBar + previousClip.lengthBars : 0;
  const endBar = clip.startBar + clip.lengthBars;
  const startBar = clamp(Math.round(desiredStartBar), minimum, endBar - 1);
  if (startBar === clip.startBar) return false;

  const deltaBars = startBar - clip.startBar;
  clip.startBar = startBar;
  clip.lengthBars = endBar - startBar;
  clip.sourceOffsetBars = normalizedSourceOffsetBars(clip.sourceOffsetBars + deltaBars, loop.bars);
  arrangement.clips.sort((a, b) => a.startBar - b.startBar);
  return true;
}

export function nextAdjacentSongClip(song, sectionId, trackId, clipId) {
  const arrangement = song.sections[sectionId]?.tracks?.[trackId];
  const clip = arrangement?.clips.find((candidate) => candidate.id === clipId);
  if (!clip) return null;
  const endBar = clip.startBar + clip.lengthBars;
  return arrangement.clips.find((candidate) => candidate.id !== clip.id && candidate.startBar === endBar) ?? null;
}

function renderedSongClipPoints(loop, clip) {
  const sourceSteps = loopStepCount(loop.bars);
  const clipSteps = loopStepCount(clip.lengthBars);
  const offsetSteps = loopStepCount(normalizedSourceOffsetBars(clip.sourceOffsetBars, loop.bars));
  const rendered = {};
  for (const [rawStep, point] of Object.entries(loop.points)) {
    const sourceStep = Number(rawStep);
    if (!Number.isInteger(sourceStep) || sourceStep < 0 || sourceStep >= sourceSteps) continue;
    const firstRelativeStep = ((sourceStep - offsetSteps) % sourceSteps + sourceSteps) % sourceSteps;
    for (let relativeStep = firstRelativeStep; relativeStep < clipSteps; relativeStep += sourceSteps) {
      rendered[relativeStep] = { x: point.x, y: point.y };
    }
  }
  return rendered;
}

export function mergeSongClipWithNext(song, sectionId, trackId, clipId, maximumBars = MAX_LOOP_BARS) {
  const arrangement = song.sections[sectionId]?.tracks?.[trackId];
  const clip = arrangement?.clips.find((candidate) => candidate.id === clipId);
  const nextClip = nextAdjacentSongClip(song, sectionId, trackId, clipId);
  const loop = clip ? songLoopById(song, trackId, clip.loopId) : null;
  const nextLoop = nextClip ? songLoopById(song, trackId, nextClip.loopId) : null;
  if (!arrangement || !clip || !nextClip || !loop || !nextLoop) return null;

  const mergedBars = clip.lengthBars + nextClip.lengthBars;
  if (mergedBars > maximumBars) return null;
  const currentPoints = renderedSongClipPoints(loop, clip);
  const appendedPoints = renderedSongClipPoints(nextLoop, nextClip);
  const appendAtStep = loopStepCount(clip.lengthBars);
  loop.points = {
    ...currentPoints,
    ...Object.fromEntries(Object.entries(appendedPoints).map(([step, point]) => [Number(step) + appendAtStep, point])),
  };
  loop.bars = mergedBars;
  clip.lengthBars = mergedBars;
  clip.sourceOffsetBars = 0;
  deleteSongClip(song, sectionId, trackId, nextClip.id);
  arrangement.selectedClipId = clip.id;
  arrangement.selectedLoopId = loop.id;
  return { clip, loop, removedClip: nextClip };
}

export function splitSongClip(song, sectionId, trackId, clipId, splitBar) {
  const arrangement = song.sections[sectionId]?.tracks?.[trackId];
  const clip = arrangement?.clips.find((candidate) => candidate.id === clipId);
  const loop = clip ? songLoopById(song, trackId, clip.loopId) : null;
  const bar = Math.round(splitBar);
  if (!arrangement || !clip || !loop || bar <= clip.startBar || bar >= clip.startBar + clip.lengthBars) {
    return null;
  }

  const originalEndBar = clip.startBar + clip.lengthBars;
  const leftLengthBars = bar - clip.startBar;
  const id = song.nextId++;
  const rightClip = {
    id: `${sectionId}-${trackId}-clip-${id}`,
    loopId: clip.loopId,
    startBar: bar,
    lengthBars: originalEndBar - bar,
    sourceOffsetBars: normalizedSourceOffsetBars(clip.sourceOffsetBars + leftLengthBars, loop.bars),
  };
  clip.lengthBars = leftLengthBars;
  arrangement.clips.push(rightClip);
  arrangement.clips.sort((a, b) => a.startBar - b.startBar);
  arrangement.selectedClipId = clip.id;
  arrangement.selectedLoopId = clip.loopId;
  return { leftClip: clip, rightClip };
}

export function expandSongClipForRecording(
  song,
  sectionId,
  trackId,
  clipId,
  sectionStep,
  maximumBars = MAX_LOOP_BARS
) {
  const section = song.sections[sectionId];
  const arrangement = section?.tracks?.[trackId];
  const clip = arrangement?.clips.find((candidate) => candidate.id === clipId);
  const loop = clip ? songLoopById(song, trackId, clip.loopId) : null;
  if (!section || !arrangement || !clip || !loop) return false;

  const stepsPerBar = loopStepCount(1);
  const relativeStep = sectionStep - clip.startBar * stepsPerBar;
  if (relativeStep < 0) return false;
  const desiredBars = Math.ceil((relativeStep + 1) / stepsPerBar);
  const nextClip = arrangement.clips
    .filter((candidate) => candidate.id !== clip.id && candidate.startBar > clip.startBar)
    .sort((a, b) => a.startBar - b.startBar)[0];
  const availableBars = (nextClip?.startBar ?? sectionBars(section)) - clip.startBar;
  const expandedBars = Math.min(maximumBars, availableBars, desiredBars);
  let changed = false;
  if (expandedBars > clip.lengthBars) {
    clip.lengthBars = expandedBars;
    changed = true;
  }
  if (expandedBars > loop.bars) {
    loop.bars = expandedBars;
    changed = true;
  }
  return changed;
}

export function setSongSectionLength(song, sectionId, baseBars, extraBars) {
  const section = song.sections[sectionId];
  if (!section || !SECTION_BASE_LENGTHS.includes(baseBars)) return false;
  const previousBars = sectionBars(section);
  const previousRange = sectionLoopRange(section);
  const coveredEntireSection = previousRange.startBar === 0 && previousRange.endBar === previousBars;
  const extras = [...new Set(extraBars.filter((bars) => SECTION_EXTRA_LENGTHS.includes(bars)))].sort((a, b) => a - b);
  const changed = section.baseBars !== baseBars
    || JSON.stringify([...section.extraBars].sort((a, b) => a - b)) !== JSON.stringify(extras);
  if (!changed) return false;
  section.baseBars = baseBars;
  section.extraBars = extras;
  if (coveredEntireSection) {
    section.loopStartBar = 0;
    section.loopEndBar = sectionBars(section);
  } else {
    const nextRange = sectionLoopRange(section);
    section.loopStartBar = nextRange.startBar;
    section.loopEndBar = nextRange.endBar;
  }
  for (const trackId of Object.keys(section.tracks)) normalizeArrangement(song, section, trackId);
  return true;
}

export function syncPerformanceTrackToSong(song, sectionId, trackId, track, loopBars) {
  const loop = selectedSongLoop(song, sectionId, trackId);
  if (!loop) return null;
  loop.bars = validLoopBars(loopBars);
  loop.points = pointsFromTrack(track);
  return loop;
}

export function syncPerformanceLoopsToSong(song, sectionId, tracks, trackLoopBars) {
  for (const [trackId, track] of tracks) {
    syncPerformanceTrackToSong(song, sectionId, trackId, track, trackLoopBars.get(trackId));
  }

  for (const section of Object.values(song.sections)) {
    for (const trackId of Object.keys(section.tracks)) {
      normalizeArrangement(song, section, trackId);
    }
  }
}

export function selectedPerformanceLoops(song, sectionId, trackIds) {
  const tracks = new Map();
  const trackLoopBars = new Map();
  for (const trackId of trackIds) {
    const loop = selectedSongLoop(song, sectionId, trackId);
    tracks.set(trackId, new Map(Object.entries(loop.points).map(([step, point]) => [Number(step), point])));
    trackLoopBars.set(trackId, loop.bars);
  }
  return { tracks, trackLoopBars };
}

export function songRecordingTargetAtAbsoluteStep(
  song,
  sectionId,
  trackId,
  absoluteStep,
  { createIfMissing = false, loopBars = 1 } = {}
) {
  const section = song.sections[sectionId];
  const arrangement = section?.tracks?.[trackId];
  if (!arrangement) return null;
  const totalSteps = loopStepCount(sectionBars(section));
  const sectionStep = ((absoluteStep % totalSteps) + totalSteps) % totalSteps;
  const stepsPerBar = loopStepCount(1);
  let clip = arrangement.clips.find((candidate) => {
    const start = candidate.startBar * stepsPerBar;
    return sectionStep >= start && sectionStep < start + candidate.lengthBars * stepsPerBar;
  });
  let created = false;
  if (!clip && createIfMissing) {
    clip = createSongLoopAt(song, sectionId, trackId, Math.floor(sectionStep / stepsPerBar), loopBars);
    created = Boolean(clip);
  }
  if (!clip) return null;
  const loop = songLoopById(song, trackId, clip.loopId);
  if (!loop) return null;
  const sourceSteps = loopStepCount(loop.bars);
  const sourceOffsetStep = loopStepCount(normalizedSourceOffsetBars(clip.sourceOffsetBars, loop.bars));
  const sourceStep = ((sourceOffsetStep + sectionStep - clip.startBar * stepsPerBar) % sourceSteps + sourceSteps) % sourceSteps;
  return { clip, loop, sourceStep, sectionStep, created };
}

export function songPointAtAbsoluteStep(song, sectionId, trackId, absoluteStep) {
  const target = songRecordingTargetAtAbsoluteStep(song, sectionId, trackId, absoluteStep);
  return target?.loop.points[target.sourceStep] ?? null;
}

function pathCoordinate(value) {
  return Number(value.toFixed(3));
}

export function songClipPathData(loop, clipLengthBars, sourceOffsetBars = 0) {
  const sourceSteps = loopStepCount(loop.bars);
  const clipSteps = loopStepCount(clipLengthBars);
  const offsetSteps = loopStepCount(normalizedSourceOffsetBars(sourceOffsetBars, loop.bars));
  const sourceEntries = Object.entries(loop.points)
    .map(([step, point]) => [Number(step), point])
    .filter(([step, point]) => Number.isInteger(step) && step >= 0 && step < sourceSteps && Number.isFinite(point?.x))
    .sort(([stepA], [stepB]) => stepA - stepB);
  const entries = [];
  for (const [step, point] of sourceEntries) {
    const firstClipStep = ((step - offsetSteps) % sourceSteps + sourceSteps) % sourceSteps;
    for (let clipStep = firstClipStep; clipStep < clipSteps; clipStep += sourceSteps) {
      entries.push([clipStep, point]);
    }
  }
  entries.sort(([stepA], [stepB]) => stepA - stepB);

  const runs = [];
  for (const entry of entries) {
    const run = runs.at(-1);
    if (!run || entry[0] !== run.at(-1)[0] + 1) runs.push([entry]);
    else run.push(entry);
  }
  return runs.map((run) => run.map(([step, point], index) => {
    const x = pathCoordinate(step / clipSteps * 100);
    const y = pathCoordinate(1 + (1 - clamp(point.x, 0, 1)) * 98);
    if (run.length === 1) return `M ${x} ${y} L ${pathCoordinate(Math.min(100, x + 0.5))} ${y}`;
    return `${index === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ")).join(" ");
}
