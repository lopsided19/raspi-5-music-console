const PITCH_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const STACKED_SCALE_DEGREES = [0, 2, 4, 6];

const CHORD_SUFFIXES = new Map([
  ["0,4,7", ""],
  ["0,3,7", "m"],
  ["0,3,6", "dim"],
  ["0,4,8", "aug"],
  ["0,2,7", "sus2"],
  ["0,5,7", "sus4"],
  ["0,4,7,11", "maj7"],
  ["0,4,7,10", "7"],
  ["0,3,7,10", "m7"],
  ["0,3,7,11", "m(maj7)"],
  ["0,3,6,10", "m7♭5"],
  ["0,3,6,9", "dim7"],
  ["0,4,8,11", "maj7♯5"],
  ["0,4,8,10", "7♯5"],
  ["0,4,6,10", "7♭5"],
  ["0,5,7,10", "7sus4"],
  ["0,2,7,10", "7sus2"],
  ["0,4,7,9", "6"],
  ["0,3,7,9", "m6"],
]);

const POP_CHORD_TRANSITIONS = {
  I: ["vi", "IV", "V", "ii"],
  ii: ["V", "IV", "#ii°7"],
  iii: ["vi", "IV"],
  IV: ["I", "V", "vi", "iv", "#IV°7"],
  V: ["I", "vi", "#V°7"],
  vi: ["IV", "V", "ii", "I"],
  Isus4: ["I"],
  Isus2: ["I"],
  iv: ["I"],
  Vsus4: ["V"],
  "V/IV": ["IV"],
  "V/V": ["V"],
  "V/vi": ["vi"],
  bVI: ["bVII"],
  bVII: ["I"],
  "#ii°7": ["iii"],
  "#IV°7": ["V"],
  "#V°7": ["vi"],
};

const POP_BASS_ROUTES = Object.freeze({
  "I/E": Object.freeze({
    availableAfter: Object.freeze(["ii", "IV"]),
    targetsByDirection: Object.freeze({ "-1": "IV", "1": "IV" }),
    targetDirections: Object.freeze({ "-1": 1, "1": 1 }),
  }),
  "iii/G": Object.freeze({
    availableAfter: Object.freeze(["vi"]),
    targetsByDirection: Object.freeze({ "-1": "IV" }),
  }),
  "V/B": Object.freeze({
    availableAfter: Object.freeze(["I", "vi"]),
    targetsByDirection: Object.freeze({ "-1": "vi", "1": "I" }),
  }),
});

export const POP_STRONG_DIRECTIONAL_IDS = Object.freeze([
  "V/IV",
  "V/V",
  "V/vi",
  "bVI",
  "bVII",
  "#ii°7",
  "#IV°7",
  "#V°7",
]);

function popChordRegion({
  id,
  functionId = id,
  roman,
  symbol,
  hint,
  tier,
  x,
  y,
  width,
  height,
  rootOffset,
  bassOffset = null,
  intervals,
}) {
  return Object.freeze({
    id,
    functionId,
    roman,
    symbol,
    hint,
    tier,
    x,
    y,
    width,
    height,
    rootOffset,
    bassOffset,
    intervals: Object.freeze(intervals),
  });
}

const POP_CORE_CHORD_IDS = Object.freeze(["I", "ii", "iii", "IV", "V", "vi"]);
const POP_CORE_Y = 0.27;
const POP_CORE_HEIGHT = 0.46;
const POP_SECONDARY_HEIGHT = 0.46 / 5;
const POP_CONNECTOR_HEIGHT = POP_SECONDARY_HEIGHT * 1.6;
const POP_INVERSION_HEIGHT = POP_CORE_HEIGHT / 3;
const POP_INVERSION_Y = POP_CORE_Y + POP_CORE_HEIGHT - POP_INVERSION_HEIGHT;

// Every visible region has deterministic coordinates. Unoccupied colour-row
// cells fall back to the core chord in the same column, so recordings can keep
// storing only normalized touch coordinates without introducing dead zones.
export const POP_CHORD_REGIONS = Object.freeze([
  // Each column has one root. Moving vertically changes its chord colour
  // without changing the harmonic landmark or the recorded x coordinate.
  popChordRegion({ id: "Imaj7", functionId: "I", roman: "I", symbol: "Cmaj7", hint: "七和弦", tier: "seventh", x: 0 / 6, y: 0.73, width: 1 / 6, height: 0.27, rootOffset: 0, intervals: [0, 4, 7, 11] }),
  popChordRegion({ id: "ii7", functionId: "ii", roman: "ii", symbol: "Dm7", hint: "七和弦", tier: "seventh", x: 1 / 6, y: 0.73, width: 1 / 6, height: 0.27, rootOffset: 2, intervals: [0, 3, 7, 10] }),
  popChordRegion({ id: "iii7", functionId: "iii", roman: "iii", symbol: "Em7", hint: "七和弦", tier: "seventh", x: 2 / 6, y: 0.73, width: 1 / 6, height: 0.27, rootOffset: 4, intervals: [0, 3, 7, 10] }),
  popChordRegion({ id: "IVmaj7", functionId: "IV", roman: "IV", symbol: "Fmaj7", hint: "七和弦", tier: "seventh", x: 3 / 6, y: 0.73, width: 1 / 6, height: 0.27, rootOffset: 5, intervals: [0, 4, 7, 11] }),
  popChordRegion({ id: "V7", functionId: "V", roman: "V", symbol: "G7", hint: "七和弦", tier: "seventh", x: 4 / 6, y: 0.73, width: 1 / 6, height: 0.27, rootOffset: 7, intervals: [0, 4, 7, 10] }),
  popChordRegion({ id: "vi7", functionId: "vi", roman: "vi", symbol: "Am7", hint: "七和弦", tier: "seventh", x: 5 / 6, y: 0.73, width: 1 / 6, height: 0.27, rootOffset: 9, intervals: [0, 3, 7, 10] }),

  // Applied dominants share the same root as I, ii and iii, so they live as
  // shallow overlays at the top of those three core buttons. They are listed
  // before the overlapping core regions to keep coordinate lookup deterministic.
  popChordRegion({ id: "V/IV", roman: "V/IV", symbol: "C7", hint: "→ IV", tier: "secondary", x: 0 / 6, y: 0.27, width: 1 / 6, height: POP_SECONDARY_HEIGHT, rootOffset: 0, intervals: [0, 4, 7, 10] }),
  popChordRegion({ id: "V/V", roman: "V/V", symbol: "D7", hint: "→ V", tier: "secondary", x: 1 / 6, y: 0.27, width: 1 / 6, height: POP_SECONDARY_HEIGHT, rootOffset: 2, intervals: [0, 4, 7, 10] }),
  popChordRegion({ id: "V/vi", roman: "V/vi", symbol: "E7", hint: "→ vi", tier: "secondary", x: 2 / 6, y: 0.27, width: 1 / 6, height: POP_SECONDARY_HEIGHT, rootOffset: 4, intervals: [0, 4, 7, 10] }),

  // Chromatic passing diminished sevenths sit across the lower boundary of
  // the diatonic chords they connect. Width and height use the same normalized
  // width as the shallow applied-dominant strip. They extend downward across
  // roughly the top fifth of the seventh-chord row to make the bridge tangible.
  popChordRegion({ id: "#ii°7", roman: "♯ii°", symbol: "D♯dim7", hint: "→ iii", tier: "connector", x: 2 / 6 - POP_SECONDARY_HEIGHT / 2, y: 0.73 - POP_SECONDARY_HEIGHT, width: POP_SECONDARY_HEIGHT, height: POP_CONNECTOR_HEIGHT, rootOffset: 3, intervals: [0, 3, 6, 9] }),
  popChordRegion({ id: "#IV°7", roman: "♯IV°", symbol: "F♯dim7", hint: "→ V", tier: "connector", x: 4 / 6 - POP_SECONDARY_HEIGHT / 2, y: 0.73 - POP_SECONDARY_HEIGHT, width: POP_SECONDARY_HEIGHT, height: POP_CONNECTOR_HEIGHT, rootOffset: 6, intervals: [0, 3, 6, 9] }),
  popChordRegion({ id: "#V°7", roman: "♯V°", symbol: "G♯dim7", hint: "→ vi", tier: "connector", x: 5 / 6 - POP_SECONDARY_HEIGHT / 2, y: 0.73 - POP_SECONDARY_HEIGHT, width: POP_SECONDARY_HEIGHT, height: POP_CONNECTOR_HEIGHT, rootOffset: 8, intervals: [0, 3, 6, 9] }),

  // A slash-bass choice is not a second global control. It appears only when
  // the previous core chord makes a familiar stepwise bass route available,
  // and occupies the lower third of the destination chord. The uncovered top
  // two thirds always keep playing the original root-position chord.
  popChordRegion({ id: "I/E", functionId: "I", roman: "/E", symbol: "C/E", hint: "低音线", tier: "inversion", x: 0 / 6, y: POP_INVERSION_Y, width: 1 / 6, height: POP_INVERSION_HEIGHT, rootOffset: 0, bassOffset: 4, intervals: [0, 4, 7] }),
  popChordRegion({ id: "iii/G", functionId: "iii", roman: "/G", symbol: "Em/G", hint: "低音线", tier: "inversion", x: 2 / 6, y: POP_INVERSION_Y, width: 1 / 6, height: POP_INVERSION_HEIGHT, rootOffset: 4, bassOffset: 7, intervals: [0, 3, 7] }),
  popChordRegion({ id: "V/B", functionId: "V", roman: "/B", symbol: "G/B", hint: "低音线", tier: "inversion", x: 4 / 6, y: POP_INVERSION_Y, width: 1 / 6, height: POP_INVERSION_HEIGHT, rootOffset: 7, bassOffset: 11, intervals: [0, 4, 7] }),

  popChordRegion({ id: "I", roman: "I", symbol: "C", hint: "主和弦", tier: "core", x: 0 / 6, y: POP_CORE_Y, width: 1 / 6, height: POP_CORE_HEIGHT, rootOffset: 0, intervals: [0, 4, 7] }),
  popChordRegion({ id: "ii", roman: "ii", symbol: "Dm", hint: "去 V", tier: "core", x: 1 / 6, y: POP_CORE_Y, width: 1 / 6, height: POP_CORE_HEIGHT, rootOffset: 2, intervals: [0, 3, 7] }),
  popChordRegion({ id: "iii", roman: "iii", symbol: "Em", hint: "连接 vi", tier: "core", x: 2 / 6, y: POP_CORE_Y, width: 1 / 6, height: POP_CORE_HEIGHT, rootOffset: 4, intervals: [0, 3, 7] }),
  popChordRegion({ id: "IV", roman: "IV", symbol: "F", hint: "铺垫", tier: "core", x: 3 / 6, y: POP_CORE_Y, width: 1 / 6, height: POP_CORE_HEIGHT, rootOffset: 5, intervals: [0, 4, 7] }),
  popChordRegion({ id: "V", roman: "V", symbol: "G", hint: "期待回家", tier: "core", x: 4 / 6, y: POP_CORE_Y, width: 1 / 6, height: POP_CORE_HEIGHT, rootOffset: 7, intervals: [0, 4, 7] }),
  popChordRegion({ id: "vi", roman: "vi", symbol: "Am", hint: "相对小调", tier: "core", x: 5 / 6, y: POP_CORE_Y, width: 1 / 6, height: POP_CORE_HEIGHT, rootOffset: 9, intervals: [0, 3, 7] }),

  // The colour row contains only variations with a clear listening exercise
  // or a genuinely different role in the key. Tensions such as add9 belong in
  // a later voicing layer rather than competing with functional colours here.
  // ii and iii deliberately have no separate colour button and safely fall
  // back to their core triads.
  popChordRegion({ id: "Isus4", roman: "I", symbol: "Csus4", hint: "→ I", tier: "color", x: 0 / 6, y: 0, width: 1 / 6, height: 0.27 / 2, rootOffset: 0, intervals: [0, 5, 7] }),
  popChordRegion({ id: "Isus2", roman: "I", symbol: "Csus2", hint: "→ I", tier: "color", x: 0 / 6, y: 0.27 / 2, width: 1 / 6, height: 0.27 / 2, rootOffset: 0, intervals: [0, 2, 7] }),
  popChordRegion({ id: "iv", roman: "iv", symbol: "Fm", hint: "→ I", tier: "color", x: 3 / 6, y: 0, width: 1 / 6, height: 0.27, rootOffset: 5, intervals: [0, 3, 7] }),
  popChordRegion({ id: "bVI", roman: "♭VI", symbol: "A♭", hint: "→ ♭VII", tier: "color", x: 4 / 6, y: 0, width: 1 / 6, height: 0.27 / 3, rootOffset: 8, intervals: [0, 4, 7] }),
  popChordRegion({ id: "Vsus4", roman: "V", symbol: "Gsus4", hint: "sus4 → V", tier: "color", x: 4 / 6, y: 0.27 / 3, width: 1 / 6, height: 0.27 * 2 / 3, rootOffset: 7, intervals: [0, 5, 7] }),
  popChordRegion({ id: "bVII", roman: "♭VII", symbol: "B♭", hint: "→ I", tier: "color", x: 5 / 6, y: 0, width: 1 / 6, height: 0.27, rootOffset: 10, intervals: [0, 4, 7] }),
]);

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function availablePopInversionIds(previousStateOrId) {
  const previousChordId = typeof previousStateOrId === "string"
    ? previousStateOrId
    : previousStateOrId?.chordId;
  return Object.entries(POP_BASS_ROUTES)
    .filter(([inversionId, route]) =>
      inversionId === previousChordId || route.availableAfter.includes(previousChordId)
    )
    .map(([inversionId]) => inversionId);
}

export function popChordAtPoint(point, previousStateOrId = null) {
  const x = Math.min(1 - Number.EPSILON, Math.max(0, Number(point?.x) || 0));
  const y = Math.min(1 - Number.EPSILON, Math.max(0, Number(point?.y) || 0));
  const containsPoint = (candidate) =>
    x >= candidate.x && x < candidate.x + candidate.width
      && y >= candidate.y && y < candidate.y + candidate.height;
  // Connector regions visually sit above both adjacent core buttons and the
  // seventh row, so their coordinate hit priority must match that stacking.
  const visibleInversions = new Set(availablePopInversionIds(previousStateOrId));
  const region = POP_CHORD_REGIONS.find((candidate) =>
    candidate.tier === "connector" && containsPoint(candidate)
  ) ?? POP_CHORD_REGIONS.find((candidate) =>
    candidate.tier === "inversion" && visibleInversions.has(candidate.id) && containsPoint(candidate)
  ) ?? POP_CHORD_REGIONS.find((candidate) => candidate.tier !== "inversion" && containsPoint(candidate));
  if (region) return region;

  const column = Math.min(POP_CORE_CHORD_IDS.length - 1, Math.floor(x * POP_CORE_CHORD_IDS.length));
  return POP_CHORD_REGIONS.find(({ id }) => id === POP_CORE_CHORD_IDS[column]);
}

export function popChordIndexAtPoint(point, previousStateOrId = null) {
  return POP_CHORD_REGIONS.indexOf(popChordAtPoint(point, previousStateOrId));
}

export const POP_TONIC_RESOLUTION_VARIANT = "tonic-resolution";

// I keeps its familiar low open voicing by default. Only an arrival from V or
// bVII selects this second, fixed arrangement: the top B of V can rise to C,
// while every voice of bVII moves to a nearby chord tone.
const POP_TONIC_RESOLUTION_OFFSETS = Object.freeze([12, 16, 19, 24]);

function buildPopInversionVoicing(chord, bassMidi, baseRootMidi) {
  let offsets;
  if (chord.id === "I/E") offsets = [0, 8, 12, 15];
  if (chord.id === "iii/G") offsets = [0, 9, 12, 16];
  if (chord.id === "V/B") {
    // The descending canon route needs E–D–C in its soprano, while the
    // ascending Am–G/B–C route keeps B on top so it can resolve to C.
    offsets = bassMidi < baseRootMidi + chord.bassOffset
      ? [0, 8, 12, 15]
      : [0, 3, 8, 12];
  }
  return offsets?.map((offset) => bassMidi + offset);
}

export function buildPopChordVoicing(chordOrId, baseRootMidi = 48, variant = "default", bassMidi = null) {
  const chord = popChordFrom(chordOrId);
  if (!chord) throw new RangeError(`Unknown pop chord: ${chordOrId}`);

  const root = baseRootMidi + chord.rootOffset;
  if (chord.id === "I" && variant === POP_TONIC_RESOLUTION_VARIANT) {
    const voicing = POP_TONIC_RESOLUTION_OFFSETS.map((offset) => root + offset);
    if (Number.isFinite(bassMidi)) voicing[0] = bassMidi;
    return voicing;
  }

  const selectedBassMidi = Number.isFinite(bassMidi)
    ? bassMidi
    : chord.tier === "inversion"
      ? baseRootMidi + chord.bassOffset
      : null;
  if (chord.tier === "inversion") {
    return buildPopInversionVoicing(chord, selectedBassMidi, baseRootMidi);
  }

  const [, third, fifth, ...extensions] = chord.intervals;
  if (Number.isFinite(selectedBassMidi) && chord.tier === "core" && chord.intervals.length === 3) {
    return [
      selectedBassMidi,
      selectedBassMidi + fifth,
      selectedBassMidi + 12,
      selectedBassMidi + third + 12,
    ];
  }
  const innerColour = extensions.length
    ? extensions.map((interval) => root + interval)
    : [root + 12];
  const voicing = [root, root + fifth, ...innerColour, root + third + 12];
  if (Number.isFinite(selectedBassMidi)) voicing[0] = selectedBassMidi;
  return voicing;
}

function popChordFrom(chordOrId) {
  return typeof chordOrId === "string"
    ? POP_CHORD_REGIONS.find(({ id }) => id === chordOrId)
    : chordOrId;
}

export function nextPopChordVoicingState(previousState, chordOrId) {
  const chord = popChordFrom(chordOrId);
  if (!chord) throw new RangeError(`Unknown pop chord: ${chordOrId}`);

  const previousChord = popChordFrom(previousState?.chordId);
  if (previousChord?.id === chord.id && Number.isFinite(previousState?.bassMidi)) {
    return previousState;
  }

  const previousFunctionId = previousChord?.functionId ?? previousChord?.id;
  const keepsResolvingTonic = previousState?.variant === POP_TONIC_RESOLUTION_VARIANT
    && previousChord?.id === "I";
  const arrivesFromResolvingChord = previousFunctionId === "V" || previousFunctionId === "bVII";
  const variant = chord.id === "I" && (keepsResolvingTonic || arrivesFromResolvingChord)
    ? POP_TONIC_RESOLUTION_VARIANT
    : "default";

  const previousBassMidi = Number.isFinite(previousState?.bassMidi)
    ? previousState.bassMidi
    : previousChord
      ? 48 + previousChord.rootOffset
      : null;
  const route = POP_BASS_ROUTES[chord.id];
  let bassMidi = 48 + chord.rootOffset;
  let bassDirection = 0;
  let usesRouteBass = false;

  if (route) {
    bassMidi = previousBassMidi === null
      ? 48 + chord.bassOffset
      : nearestMidiWithPitchClass(chord.bassOffset, previousBassMidi);
    bassDirection = Math.sign(bassMidi - (previousBassMidi ?? bassMidi));
    usesRouteBass = true;
  } else {
    const targetId = recommendedPopBassTargetIds(previousState)[0];
    if (targetId === chord.id && previousState?.bassDirection) {
      const previousRoute = POP_BASS_ROUTES[previousState.chordId];
      bassDirection = previousRoute?.targetDirections?.[String(previousState.bassDirection)]
        ?? previousState.bassDirection;
      bassMidi = nextMidiInDirection(chord.rootOffset, previousState.bassMidi, bassDirection);
      usesRouteBass = true;
    } else if (
      chord.id === "V"
      && previousChord?.id === "IV"
      && previousState?.usesRouteBass
      && previousState.bassMidi < 48 + previousChord.rootOffset
    ) {
      // The final IV–V of the canon stays in the same low register instead of
      // jumping from F2 to the ordinary G3 voicing.
      bassDirection = 1;
      bassMidi = nextMidiInDirection(chord.rootOffset, previousState.bassMidi, bassDirection);
      usesRouteBass = true;
    }
  }

  return Object.freeze({ chordId: chord.id, variant, bassMidi, bassDirection, usesRouteBass });
}

function nearestMidiWithPitchClass(pitchClass, aroundMidi) {
  const lower = aroundMidi - positiveModulo(aroundMidi - pitchClass, 12);
  const upper = lower + 12;
  return aroundMidi - lower <= upper - aroundMidi ? lower : upper;
}

function nextMidiInDirection(pitchClass, fromMidi, direction) {
  let midi = nearestMidiWithPitchClass(pitchClass, fromMidi);
  if (direction < 0 && midi >= fromMidi) midi -= 12;
  if (direction > 0 && midi <= fromMidi) midi += 12;
  return midi;
}

export function recommendedPopBassTargetIds(stateOrId) {
  const chordId = typeof stateOrId === "string" ? stateOrId : stateOrId?.chordId;
  const route = POP_BASS_ROUTES[chordId];
  if (!route) return [];
  const direction = typeof stateOrId === "string" ? 0 : Math.sign(stateOrId?.bassDirection ?? 0);
  const target = route.targetsByDirection[String(direction)];
  return target ? [target] : [];
}

export function recommendedPopChordIds(chordOrId) {
  const chord = popChordFrom(chordOrId);
  return [...(POP_CHORD_TRANSITIONS[chord?.functionId ?? chord?.id] ?? [])];
}

function scaleMidiAt(intervals, absoluteDegree, baseRootMidi) {
  const octave = Math.floor(absoluteDegree / intervals.length);
  const degree = positiveModulo(absoluteDegree, intervals.length);
  return baseRootMidi + octave * 12 + intervals[degree];
}

export function buildClosedScaleChord(intervals, positionIndex, baseRootMidi = 48) {
  const positionOctave = Math.floor(positionIndex / intervals.length);
  const degree = positionIndex % intervals.length;
  const octaveRootMidi = baseRootMidi + positionOctave * 12;
  return STACKED_SCALE_DEGREES.map((degreeOffset) =>
    scaleMidiAt(intervals, degree + degreeOffset, octaveRootMidi)
  );
}

export function buildChordVoicing(intervals, positionIndex, baseRootMidi = 48) {
  const [root, third, fifth, seventh] = buildClosedScaleChord(intervals, positionIndex, baseRootMidi);
  return [root, fifth, seventh, third + 12];
}

export function midiToScientificLabel(midi) {
  const pitchClass = positiveModulo(midi, 12);
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCH_NAMES[pitchClass]}${octave}`;
}

export function chordDescription(intervals, positionIndex, baseRootMidi = 48) {
  const closed = buildClosedScaleChord(intervals, positionIndex, baseRootMidi);
  const voicing = buildChordVoicing(intervals, positionIndex, baseRootMidi);
  const root = closed[0];
  const pitchClasses = [...new Set(closed.map((midi) => positiveModulo(midi - root, 12)))].sort((a, b) => a - b);
  const signature = pitchClasses.join(",");
  const rootName = PITCH_NAMES[positiveModulo(root, 12)];
  const suffix = CHORD_SUFFIXES.get(signature);
  const symbol = suffix === undefined ? `${rootName} [${signature}]` : `${rootName}${suffix}`;
  const rawIntervals = closed.map((midi) => midi - root);

  return {
    symbol,
    rootMidi: root,
    closed,
    voicing,
    rawIntervals,
    closedLabels: closed.map(midiToScientificLabel),
    voicingLabels: voicing.map(midiToScientificLabel),
  };
}
