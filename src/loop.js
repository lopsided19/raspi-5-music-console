export const BEATS_PER_BAR = 4;
export const STEPS_PER_BEAT = 32;

export function stepDurationMs(tempo) {
  return 60_000 / tempo / STEPS_PER_BEAT;
}

export function loopStepCount(bars) {
  return bars * BEATS_PER_BAR * STEPS_PER_BEAT;
}

export function recordingPhraseGapMs(bars, tempo) {
  return loopStepCount(bars) * stepDurationMs(tempo) / 2;
}

export function loopPosition(absoluteStep, bars) {
  const stepCount = loopStepCount(bars);
  const step = ((absoluteStep % stepCount) + stepCount) % stepCount;
  return {
    step,
    bar: Math.floor(step / (BEATS_PER_BAR * STEPS_PER_BEAT)) + 1,
    beat: Math.floor(step / STEPS_PER_BEAT) % BEATS_PER_BAR + 1,
    subdivision: step % STEPS_PER_BEAT,
  };
}

export function loopProgressAt(absoluteStep, bars) {
  const stepCount = loopStepCount(bars);
  return ((absoluteStep % stepCount) + stepCount) % stepCount / stepCount;
}

export function recordingTransportStart(now, beatStartedAt, tempo, graceBeatFraction = 0.5) {
  const beatDuration = 60_000 / tempo;
  const elapsedBeats = (now - beatStartedAt) / beatDuration;
  const currentBeatStartedAt = beatStartedAt + Math.floor(elapsedBeats) * beatDuration;
  const beatPhase = (now - currentBeatStartedAt) / beatDuration;
  return beatPhase < graceBeatFraction ? currentBeatStartedAt : currentBeatStartedAt + beatDuration;
}

export function clampUnit(value) {
  return Math.min(1, Math.max(0, value));
}

export function normalizedPoint(clientX, clientY, bounds) {
  return {
    x: clampUnit((clientX - bounds.left) / bounds.width),
    y: clampUnit((clientY - bounds.top) / bounds.height),
  };
}

export function recordPoint(track, step, point) {
  track.set(step, { x: clampUnit(point.x), y: clampUnit(point.y) });
}

export function eraseTrackRange(track, firstAbsoluteStep, lastAbsoluteStep, bars) {
  let erased = 0;
  for (let absoluteStep = firstAbsoluteStep; absoluteStep <= lastAbsoluteStep; absoluteStep += 1) {
    if (track.delete(loopPosition(absoluteStep, bars).step)) erased += 1;
  }
  return erased;
}

export function shiftTrackLoop(track, stepOffset, bars) {
  const totalSteps = loopStepCount(bars);
  const offset = Math.round(stepOffset);
  if (offset % totalSteps === 0) return 0;

  const visibleEntries = [...track].filter(([step]) => (
    Number.isInteger(step) && step >= 0 && step < totalSteps
  ));
  for (const [step] of visibleEntries) track.delete(step);
  for (const [step, point] of visibleEntries) {
    const shiftedStep = ((step + offset) % totalSteps + totalSteps) % totalSteps;
    track.set(shiftedStep, point);
  }
  return visibleEntries.length;
}

// Shared rhythm-visual contract: completely dark before the beat, maximum
// immediately on the beat, followed only by a short decay.
export function rhythmicEnvelopeAt(
  now,
  beatStartedAt,
  tempo,
  targetBeat = 0,
  beatsPerCycle = 1,
  peakHoldBeats = 0.04,
  decayBeats = 0.8
) {
  const beatDuration = 60_000 / tempo;
  const elapsedBeats = (now - beatStartedAt) / beatDuration;
  const cyclePosition = ((elapsedBeats % beatsPerCycle) + beatsPerCycle) % beatsPerCycle;
  const beatsAfterTarget = (cyclePosition - targetBeat + beatsPerCycle) % beatsPerCycle;

  if (beatsAfterTarget <= decayBeats) {
    if (beatsAfterTarget <= peakHoldBeats) return 1;
    const decayProgress = (beatsAfterTarget - peakHoldBeats) / (decayBeats - peakHoldBeats);
    return Math.pow(1 - decayProgress, 2);
  }
  return 0;
}

export function beatPulseAt(now, beatStartedAt, tempo) {
  return 1 + 0.24 * rhythmicEnvelopeAt(now, beatStartedAt, tempo);
}

export function trackPointsAtStep(tracks, step) {
  return new Map(
    [...tracks].flatMap(([instrumentId, track]) => {
      const point = track.get(step);
      return point ? [[instrumentId, point]] : [];
    })
  );
}

export function trackPointsAtAbsoluteStep(tracks, trackLoopBars, absoluteStep) {
  return new Map(
    [...tracks].flatMap(([instrumentId, track]) => {
      const bars = trackLoopBars.get(instrumentId) ?? 1;
      const point = track.get(loopPosition(absoluteStep, bars).step);
      return point ? [[instrumentId, point]] : [];
    })
  );
}
