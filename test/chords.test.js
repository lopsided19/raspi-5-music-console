import test from "node:test";
import assert from "node:assert/strict";
import {
  POP_CHORD_REGIONS,
  POP_STRONG_DIRECTIONAL_IDS,
  POP_TONIC_RESOLUTION_VARIANT,
  availablePopInversionIds,
  buildChordVoicing,
  buildPopChordVoicing,
  chordDescription,
  nextPopChordVoicingState,
  popChordAtPoint,
  recommendedPopBassTargetIds,
  recommendedPopChordIds,
} from "../src/chords.js";

const MAJOR = [0, 2, 4, 5, 7, 9, 11];

test("major-scale positions produce diatonic seventh chords in rooted open voicing", () => {
  assert.deepEqual(buildChordVoicing(MAJOR, 0), [48, 55, 59, 64]);
  assert.equal(chordDescription(MAJOR, 0).symbol, "Cmaj7");
  assert.equal(chordDescription(MAJOR, 1).symbol, "Dm7");
  assert.equal(chordDescription(MAJOR, 6).symbol, "Bm7♭5");
});

test("the second touch octave transposes the entire chord by twelve semitones", () => {
  const firstOctave = buildChordVoicing(MAJOR, 2);
  const secondOctave = buildChordVoicing(MAJOR, 9);
  assert.deepEqual(secondOctave, firstOctave.map((midi) => midi + 12));
});

test("pentatonic scales still create four-note, scale-only voicings", () => {
  const majorPentatonic = [0, 2, 4, 7, 9];
  const description = chordDescription(majorPentatonic, 0);
  assert.deepEqual(description.closedLabels, ["C3", "E3", "A3", "D4"]);
  assert.deepEqual(description.voicingLabels, ["C3", "A3", "D4", "E4"]);
});

test("the pop surface maps every representative coordinate to a deterministic chord", () => {
  assert.equal(popChordAtPoint({ x: 0.05, y: 0.05 }).id, "Isus4");
  assert.equal(popChordAtPoint({ x: 0.05, y: 0.2 }).id, "Isus2");
  assert.equal(popChordAtPoint({ x: 0.2, y: 0.1 }).id, "ii");
  assert.equal(popChordAtPoint({ x: 0.38, y: 0.1 }).id, "iii");
  assert.equal(popChordAtPoint({ x: 0.55, y: 0.05 }).id, "iv");
  assert.equal(popChordAtPoint({ x: 0.55, y: 0.2 }).id, "iv");
  assert.equal(popChordAtPoint({ x: 0.72, y: 0.03 }).id, "bVI");
  assert.equal(popChordAtPoint({ x: 0.72, y: 0.2 }).id, "Vsus4");
  assert.equal(popChordAtPoint({ x: 0.9, y: 0.1 }).id, "bVII");
  assert.equal(popChordAtPoint({ x: 0.05, y: 0.3 }).id, "V/IV");
  assert.equal(popChordAtPoint({ x: 0.2, y: 0.3 }).id, "V/V");
  assert.equal(popChordAtPoint({ x: 0.38, y: 0.3 }).id, "V/vi");
  assert.equal(popChordAtPoint({ x: 0.05, y: 0.5 }).id, "I");
  assert.equal(popChordAtPoint({ x: 0.2, y: 0.5 }).id, "ii");
  assert.equal(popChordAtPoint({ x: 0.38, y: 0.5 }).id, "iii");
  assert.equal(popChordAtPoint({ x: 0.55, y: 0.5 }).id, "IV");
  assert.equal(popChordAtPoint({ x: 0.72, y: 0.5 }).id, "V");
  assert.equal(popChordAtPoint({ x: 0.9, y: 0.5 }).id, "vi");
  assert.equal(popChordAtPoint({ x: 2 / 6, y: 0.68 }).id, "#ii°7");
  assert.equal(popChordAtPoint({ x: 4 / 6, y: 0.68 }).id, "#IV°7");
  assert.equal(popChordAtPoint({ x: 5 / 6, y: 0.68 }).id, "#V°7");
  assert.equal(popChordAtPoint({ x: 2 / 6, y: 0.76 }).id, "#ii°7");
  assert.equal(popChordAtPoint({ x: 0.05, y: 0.9 }).id, "Imaj7");
  assert.equal(popChordAtPoint({ x: 1, y: 1 }).id, "vi7");
});

test("pop triads and seventh chords use rooted open voicings", () => {
  assert.deepEqual(buildPopChordVoicing("I"), [48, 55, 60, 64]);
  assert.deepEqual(buildPopChordVoicing("vi"), [57, 64, 69, 72]);
  assert.deepEqual(buildPopChordVoicing("V"), [55, 62, 67, 71]);
  assert.deepEqual(buildPopChordVoicing("V7"), [55, 62, 65, 71]);
  assert.deepEqual(buildPopChordVoicing("Isus4"), [48, 55, 60, 65]);
  assert.deepEqual(buildPopChordVoicing("Isus2"), [48, 55, 60, 62]);
  assert.deepEqual(buildPopChordVoicing("Vsus4"), [55, 62, 67, 72]);
  assert.deepEqual(buildPopChordVoicing("iv"), [53, 60, 65, 68]);
  assert.deepEqual(buildPopChordVoicing("V/IV"), [48, 55, 58, 64]);
  assert.deepEqual(buildPopChordVoicing("V/V"), [50, 57, 60, 66]);
  assert.deepEqual(buildPopChordVoicing("V/vi"), [52, 59, 62, 68]);
  assert.deepEqual(buildPopChordVoicing("bVI"), [56, 63, 68, 72]);
  assert.deepEqual(buildPopChordVoicing("bVII"), [58, 65, 70, 74]);
  assert.deepEqual(buildPopChordVoicing("#ii°7"), [51, 57, 60, 66]);
  assert.deepEqual(buildPopChordVoicing("I/E"), [52, 60, 64, 67]);
  assert.deepEqual(buildPopChordVoicing("iii/G"), [55, 64, 67, 71]);
  assert.deepEqual(buildPopChordVoicing("V/B"), [59, 62, 67, 71]);
  assert.ok(POP_CHORD_REGIONS.every((chord) => buildPopChordVoicing(chord).length === 4));
});

test("slash-bass choices occupy the lower third and only intercept touches in context", () => {
  const inversions = POP_CHORD_REGIONS.filter(({ tier }) => tier === "inversion");
  assert.deepEqual(inversions.map(({ id }) => id), ["I/E", "iii/G", "V/B"]);
  assert.ok(inversions.every(({ y, height }) =>
    height === 0.46 / 3 && y === 0.27 + 0.46 * 2 / 3
  ));

  assert.equal(popChordAtPoint({ x: 0.75, y: 0.62 }).id, "V");
  assert.equal(popChordAtPoint({ x: 0.75, y: 0.5 }, "I").id, "V");
  assert.equal(popChordAtPoint({ x: 0.75, y: 0.62 }, "I").id, "V/B");
  assert.equal(popChordAtPoint({ x: 5 / 12, y: 0.62 }, "vi").id, "iii/G");
  assert.equal(popChordAtPoint({ x: 1 / 12, y: 0.62 }, "IV").id, "I/E");

  assert.deepEqual(availablePopInversionIds("I"), ["V/B"]);
  assert.deepEqual(availablePopInversionIds("vi"), ["iii/G", "V/B"]);
  assert.deepEqual(availablePopInversionIds("IV"), ["I/E"]);
  assert.deepEqual(availablePopInversionIds("ii"), ["I/E"]);
  assert.deepEqual(availablePopInversionIds("V"), []);
});

test("contextual inversions create deterministic descending and ascending bass routes", () => {
  let state = null;
  const bassLine = [];
  const topLine = [];
  const play = (chordId) => {
    state = nextPopChordVoicingState(state, chordId);
    const voicing = buildPopChordVoicing(
      chordId,
      48,
      state.variant,
      state.usesRouteBass ? state.bassMidi : null
    );
    bassLine.push(voicing[0]);
    topLine.push(voicing.at(-1));
    return state;
  };

  play("I");
  assert.deepEqual(recommendedPopBassTargetIds(play("V/B")), ["vi"]);
  play("vi");
  assert.deepEqual(recommendedPopBassTargetIds(play("iii/G")), ["IV"]);
  play("IV");
  assert.deepEqual(recommendedPopBassTargetIds(play("I/E")), ["IV"]);
  play("IV");
  play("V");
  assert.deepEqual(bassLine, [48, 47, 45, 43, 41, 40, 41, 43]);
  assert.deepEqual(topLine, [64, 62, 60, 59, 57, 55, 57, 59]);
  assert.equal(state.usesRouteBass, true);
  assert.equal(nextPopChordVoicingState(state, "V"), state);

  state = null;
  state = nextPopChordVoicingState(state, "ii");
  state = nextPopChordVoicingState(state, "I/E");
  assert.equal(state.bassMidi, 52);
  assert.deepEqual(recommendedPopBassTargetIds(state), ["IV"]);
  state = nextPopChordVoicingState(state, "IV");
  assert.equal(state.bassMidi, 53);

  state = nextPopChordVoicingState(null, "vi");
  state = nextPopChordVoicingState(state, "V/B");
  assert.equal(state.bassMidi, 59);
  assert.deepEqual(recommendedPopBassTargetIds(state), ["I"]);
  state = nextPopChordVoicingState(state, "I");
  assert.equal(state.bassMidi, 60);
  assert.equal(state.variant, POP_TONIC_RESOLUTION_VARIANT);

  state = nextPopChordVoicingState(null, "IV");
  state = nextPopChordVoicingState(state, "V");
  assert.equal(state.bassMidi, 55);
  assert.equal(state.usesRouteBass, false);
  assert.deepEqual(buildPopChordVoicing("V"), [55, 62, 67, 71]);
});

test("I uses one fixed resolving voicing after V or bVII and keeps it across repeated I presses", () => {
  let state = null;
  const play = (chordId) => {
    state = nextPopChordVoicingState(state, chordId);
    return buildPopChordVoicing(chordId, 48, state.variant);
  };

  assert.deepEqual(play("I"), [48, 55, 60, 64]);
  assert.deepEqual(play("V"), [55, 62, 67, 71]);
  assert.deepEqual(play("I"), [60, 64, 67, 72]);
  assert.equal(state.variant, POP_TONIC_RESOLUTION_VARIANT);
  assert.deepEqual(play("I"), [60, 64, 67, 72]);

  assert.deepEqual(play("ii"), [50, 57, 62, 65]);
  assert.deepEqual(play("I"), [48, 55, 60, 64]);
  assert.equal(state.variant, "default");

  assert.deepEqual(play("bVII"), [58, 65, 70, 74]);
  assert.deepEqual(play("I"), [60, 64, 67, 72]);

  assert.deepEqual(play("IV"), [53, 60, 65, 69]);
  assert.deepEqual(play("V7"), [55, 62, 65, 71]);
  assert.deepEqual(play("I"), [60, 64, 67, 72]);
});

test("the resolving I preserves V's leading-tone slot and moves bVII smoothly", () => {
  const resolvingI = buildPopChordVoicing("I", 48, POP_TONIC_RESOLUTION_VARIANT);
  const v = buildPopChordVoicing("V");
  const bVII = buildPopChordVoicing("bVII");

  assert.equal(v[3], 71);
  assert.equal(resolvingI[3], 72);
  assert.ok(bVII.every((midi, index) => Math.abs(resolvingI[index] - midi) <= 3));
});

test("the beginner palette keeps vii out while limiting directed chromatic paths", () => {
  assert.equal(POP_CHORD_REGIONS.length, 27);
  assert.equal(POP_CHORD_REGIONS.some(({ id }) => id.includes("vii")), false);
  assert.equal(POP_CHORD_REGIONS.some(({ id }) => id === "I7"), false);
  assert.deepEqual(
    POP_CHORD_REGIONS.filter(({ tier }) => tier === "secondary").map(({ id }) => id),
    ["V/IV", "V/V", "V/vi"]
  );
  assert.deepEqual(recommendedPopChordIds("V/IV"), ["IV"]);
  assert.deepEqual(recommendedPopChordIds("V/V"), ["V"]);
  assert.deepEqual(recommendedPopChordIds("V/vi"), ["vi"]);
  assert.deepEqual(recommendedPopChordIds("Vsus4"), ["V"]);
  assert.deepEqual(recommendedPopChordIds("iv"), ["I"]);
  assert.deepEqual(recommendedPopChordIds("bVI"), ["bVII"]);
  assert.deepEqual(recommendedPopChordIds("bVII"), ["I"]);
  assert.deepEqual(recommendedPopChordIds("#ii°7"), ["iii"]);
  assert.deepEqual(
    POP_STRONG_DIRECTIONAL_IDS,
    ["V/IV", "V/V", "V/vi", "bVI", "bVII", "#ii°7", "#IV°7", "#V°7"]
  );
  assert.ok(recommendedPopChordIds("IVmaj7").includes("I"));
});

test("sus colour chords stay inside C major while borrowed chords are explicit", () => {
  const cMajorPitchClasses = new Set([0, 2, 4, 5, 7, 9, 11]);
  const borrowedIds = new Set(["iv", "bVI", "bVII"]);
  const colours = POP_CHORD_REGIONS.filter(({ tier, id }) => tier === "color" && !borrowedIds.has(id));

  for (const chord of colours) {
    assert.ok(chord.intervals.every((interval) =>
      cMajorPitchClasses.has((chord.rootOffset + interval) % 12)
    ), chord.id);
  }
});

test("each root occupies one equal-width column across triad and seventh rows", () => {
  const columns = [
    ["I", "Imaj7"],
    ["ii", "ii7"],
    ["iii", "iii7"],
    ["IV", "IVmaj7"],
    ["V", "V7"],
    ["vi", "vi7"],
  ];

  for (const [columnIndex, ids] of columns.entries()) {
    const regions = ids.map((id) => POP_CHORD_REGIONS.find((region) => region.id === id));
    assert.ok(regions.every(Boolean));
    assert.ok(regions.every(({ x }) => x === columnIndex / 6));
    assert.ok(regions.every(({ width }) => width === 1 / 6));
    assert.deepEqual(regions.map(({ y }) => y), [0.27, 0.73]);
  }
});

test("only evidence-backed colour cells are occupied", () => {
  assert.deepEqual(
    POP_CHORD_REGIONS.filter(({ tier }) => tier === "color").map(({ id }) => id),
    ["Isus4", "Isus2", "iv", "bVI", "Vsus4", "bVII"]
  );
});

test("applied dominants overlay the top fifth of their same-root core buttons", () => {
  const applied = ["V/IV", "V/V", "V/vi"].map((id) =>
    POP_CHORD_REGIONS.find((region) => region.id === id)
  );

  assert.ok(applied.every(Boolean));
  assert.deepEqual(applied.map(({ x }) => x), [0 / 6, 1 / 6, 2 / 6]);
  assert.ok(applied.every(({ y }) => y === 0.27));
  assert.ok(applied.every(({ height }) => height === 0.46 / 5));
  assert.ok(applied.every(({ width }) => width === 1 / 6));
});

test("passing diminished chords bridge adjacent core buttons at the lower edge", () => {
  const connectors = POP_CHORD_REGIONS.filter(({ tier }) => tier === "connector");
  const appliedHeight = POP_CHORD_REGIONS.find(({ id }) => id === "V/IV").height;

  assert.deepEqual(connectors.map(({ id }) => id), ["#ii°7", "#IV°7", "#V°7"]);
  assert.deepEqual(connectors.map(({ x }) => x + appliedHeight / 2), [2 / 6, 4 / 6, 5 / 6]);
  assert.ok(connectors.every(({ width, height, y }) =>
    width === appliedHeight
      && height === appliedHeight * 1.6
      && y === 0.73 - appliedHeight
      && y + height > 0.73
  ));
});
