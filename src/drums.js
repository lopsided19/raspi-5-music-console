export const DRUM_STEPS_PER_BAR = 16;
export const DRUM_PATTERN_COUNT = 5;
export const LOOP_STEPS_PER_DRUM_STEP = 8;

const KICK = 36;
const SNARE = 38;
const CLOSED_HAT = 42;
const OPEN_HAT = 46;

function hits(note, steps, velocity) {
  return steps.map((step) => ({ step, note, velocity }));
}

const HOUSE_PATTERNS = [
  [
    ...hits(KICK, [0, 4, 8, 12], 0.88),
  ],
  [
    ...hits(KICK, [0, 4, 8, 12], 0.9),
    ...hits(CLOSED_HAT, [2, 6, 10, 14], 0.5),
  ],
  [
    ...hits(KICK, [0, 4, 8, 12], 0.92),
    ...hits(SNARE, [4, 12], 0.74),
    ...hits(CLOSED_HAT, [2, 6, 10, 14], 0.54),
  ],
  [
    ...hits(KICK, [0, 4, 8, 12], 0.94),
    ...hits(SNARE, [4, 12], 0.78),
    ...hits(CLOSED_HAT, [0, 2, 4, 6, 8, 10, 12, 14], 0.48),
    ...hits(OPEN_HAT, [6, 14], 0.58),
  ],
  [
    ...hits(KICK, [0, 3, 4, 7, 8, 10, 12, 14], 0.96),
    ...hits(SNARE, [4, 12], 0.82),
    ...hits(CLOSED_HAT, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 0.44),
    ...hits(OPEN_HAT, [6, 14], 0.62),
  ],
].map((events) => events.map(Object.freeze));

export function drumPatternIndexAtX(x) {
  return Math.min(DRUM_PATTERN_COUNT - 1, Math.max(0, Math.floor(x * DRUM_PATTERN_COUNT)));
}

export function drumStepAtLoopStep(loopStep) {
  const wrappedStep = ((loopStep % 128) + 128) % 128;
  return Math.floor(wrappedStep / LOOP_STEPS_PER_DRUM_STEP);
}

export function drumEventsAt(patternIndex, drumStep) {
  const pattern = HOUSE_PATTERNS[Math.min(DRUM_PATTERN_COUNT - 1, Math.max(0, patternIndex))];
  const wrappedStep = ((drumStep % DRUM_STEPS_PER_BAR) + DRUM_STEPS_PER_BAR) % DRUM_STEPS_PER_BAR;
  return pattern.filter(({ step }) => step === wrappedStep);
}

export function isDrumTriggerLoopStep(loopStep) {
  return ((loopStep % LOOP_STEPS_PER_DRUM_STEP) + LOOP_STEPS_PER_DRUM_STEP) % LOOP_STEPS_PER_DRUM_STEP === 0;
}
