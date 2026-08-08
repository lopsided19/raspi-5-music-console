export const SCALES = {
  // Seven medieval/church modes.
  major: {
    label: "Ionian (Major)",
    shortLabel: "Major",
    group: "中古调式",
    intervals: [0, 2, 4, 5, 7, 9, 11],
  },
  dorian: {
    label: "Dorian",
    group: "中古调式",
    intervals: [0, 2, 3, 5, 7, 9, 10],
  },
  phrygian: {
    label: "Phrygian",
    group: "中古调式",
    intervals: [0, 1, 3, 5, 7, 8, 10],
  },
  lydian: {
    label: "Lydian",
    group: "中古调式",
    intervals: [0, 2, 4, 6, 7, 9, 11],
  },
  mixolydian: {
    label: "Mixolydian",
    group: "中古调式",
    intervals: [0, 2, 4, 5, 7, 9, 10],
  },
  naturalMinor: {
    label: "Aeolian (Natural Minor)",
    shortLabel: "Minor",
    group: "中古调式",
    intervals: [0, 2, 3, 5, 7, 8, 10],
  },
  locrian: {
    label: "Locrian",
    group: "中古调式",
    intervals: [0, 1, 3, 5, 6, 8, 10],
  },

  // Frequently used jazz and modern scales.
  melodicMinor: {
    label: "Melodic Minor",
    shortLabel: "Mel Minor",
    group: "爵士与现代",
    intervals: [0, 2, 3, 5, 7, 9, 11],
  },
  harmonicMinor: {
    label: "Harmonic Minor",
    shortLabel: "Harm Minor",
    group: "爵士与现代",
    intervals: [0, 2, 3, 5, 7, 8, 11],
  },
  harmonicMajor: {
    label: "Harmonic Major",
    shortLabel: "Harm Major",
    group: "爵士与现代",
    intervals: [0, 2, 4, 5, 7, 8, 11],
  },
  dorianFlat2: {
    label: "Dorian ♭2",
    group: "爵士与现代",
    intervals: [0, 1, 3, 5, 7, 9, 10],
  },
  lydianAugmented: {
    label: "Lydian Augmented",
    shortLabel: "Lydian Aug",
    group: "爵士与现代",
    intervals: [0, 2, 4, 6, 8, 9, 11],
  },
  lydianDominant: {
    label: "Lydian Dominant",
    shortLabel: "Lydian Dom",
    group: "爵士与现代",
    intervals: [0, 2, 4, 6, 7, 9, 10],
  },
  mixolydianFlat6: {
    label: "Mixolydian ♭6",
    shortLabel: "Mixo ♭6",
    group: "爵士与现代",
    intervals: [0, 2, 4, 5, 7, 8, 10],
  },
  locrianNatural2: {
    label: "Locrian ♮2",
    group: "爵士与现代",
    intervals: [0, 2, 3, 5, 6, 8, 10],
  },
  altered: {
    label: "Altered Scale",
    shortLabel: "Altered",
    group: "爵士与现代",
    intervals: [0, 1, 3, 4, 6, 8, 10],
  },
  wholeTone: {
    label: "Whole Tone",
    group: "爵士与现代",
    intervals: [0, 2, 4, 6, 8, 10],
  },
  diminishedHalfWhole: {
    label: "Half–Whole Diminished",
    shortLabel: "H–W Dim",
    group: "爵士与现代",
    intervals: [0, 1, 3, 4, 6, 7, 9, 10],
  },
  diminishedWholeHalf: {
    label: "Whole–Half Diminished",
    shortLabel: "W–H Dim",
    group: "爵士与现代",
    intervals: [0, 2, 3, 5, 6, 8, 9, 11],
  },
  bebopDominant: {
    label: "Dominant Bebop",
    shortLabel: "Dom Bebop",
    group: "爵士与现代",
    intervals: [0, 2, 4, 5, 7, 9, 10, 11],
  },
  bebopMajor: {
    label: "Major Bebop",
    shortLabel: "Maj Bebop",
    group: "爵士与现代",
    intervals: [0, 2, 4, 5, 7, 8, 9, 11],
  },
  chromatic: {
    label: "Chromatic",
    group: "爵士与现代",
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  augmented: {
    label: "Augmented Scale",
    shortLabel: "Augmented",
    group: "爵士与现代",
    intervals: [0, 3, 4, 7, 8, 11],
  },

  // Pentatonic and blues families.
  majorPentatonic: {
    label: "Major Pentatonic",
    shortLabel: "Maj Penta",
    group: "五声与蓝调",
    intervals: [0, 2, 4, 7, 9],
  },
  minorPentatonic: {
    label: "Minor Pentatonic",
    shortLabel: "Min Penta",
    group: "五声与蓝调",
    intervals: [0, 3, 5, 7, 10],
  },
  blues: {
    label: "Blues Scale",
    shortLabel: "Blues",
    group: "五声与蓝调",
    intervals: [0, 3, 5, 6, 7, 10],
  },

  // Twelve-tone equal-temperament approximations of traditional modes.
  chineseGong: {
    label: "Gong Mode",
    shortLabel: "宫",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 2, 4, 7, 9],
  },
  chineseShang: {
    label: "Shang Mode",
    shortLabel: "商",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 2, 5, 7, 10],
  },
  chineseJue: {
    label: "Jue Mode",
    shortLabel: "角",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 3, 5, 8, 10],
  },
  chineseZhi: {
    label: "Zhi Mode",
    shortLabel: "徵",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 2, 5, 7, 9],
  },
  chineseYu: {
    label: "Yu Mode",
    shortLabel: "羽",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 3, 5, 7, 10],
  },
  hirajoshi: {
    label: "Hirajoshi",
    shortLabel: "平調子",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 2, 3, 7, 8],
  },
  inSen: {
    label: "In Sen",
    shortLabel: "陰旋",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 1, 5, 7, 10],
  },
  iwato: {
    label: "Iwato",
    shortLabel: "岩戸",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 1, 5, 6, 10],
  },
  yo: {
    label: "Yo",
    shortLabel: "陽旋",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 2, 5, 7, 9],
  },
  hijaz: {
    label: "Hijaz",
    shortLabel: "حجاز",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 1, 4, 5, 7, 8, 10],
  },
  doubleHarmonic: {
    label: "Double Harmonic Major",
    shortLabel: "Βυζαντινή",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 1, 4, 5, 7, 8, 11],
  },
  persian: {
    label: "Persian",
    shortLabel: "گام ایرانی",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 1, 4, 5, 6, 8, 11],
  },
  hungarianMinor: {
    label: "Hungarian Minor",
    shortLabel: "Magyar moll",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 2, 3, 6, 7, 8, 11],
  },
  romanianMinor: {
    label: "Romanian Minor",
    shortLabel: "Minor românesc",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 2, 3, 6, 7, 9, 10],
  },
  bhairav: {
    label: "Bhairav",
    shortLabel: "भैरव",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 1, 4, 5, 7, 8, 11],
  },
  todi: {
    label: "Todi",
    shortLabel: "तोड़ी",
    group: "民族调式（十二平均律近似）",
    intervals: [0, 1, 3, 6, 7, 8, 11],
  },
};

const NOTE_NAMES = ["Do", "Do♯", "Re", "Re♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"];

const CHARACTERISTIC_INTERVALS = {
  major: [11],
  dorian: [9],
  phrygian: [1],
  lydian: [6],
  mixolydian: [10],
  naturalMinor: [8],
  locrian: [1],
  melodicMinor: [11],
  harmonicMinor: [8, 11],
  harmonicMajor: [8],
  dorianFlat2: [1, 9],
  lydianAugmented: [6, 8],
  lydianDominant: [6, 10],
  mixolydianFlat6: [8, 10],
  locrianNatural2: [2],
  altered: [1, 3, 6, 8],
  wholeTone: [2, 6, 8],
  diminishedHalfWhole: [1, 3, 6, 9],
  diminishedWholeHalf: [2, 5, 8, 11],
  bebopDominant: [11],
  bebopMajor: [8],
  augmented: [3, 11],
  majorPentatonic: [9],
  minorPentatonic: [10],
  blues: [6],
  chineseGong: [9],
  chineseShang: [2, 10],
  chineseJue: [5, 10],
  chineseZhi: [2, 9],
  chineseYu: [3, 10],
  hirajoshi: [2, 8],
  inSen: [1, 10],
  iwato: [1, 6],
  yo: [2, 9],
  hijaz: [1, 8, 10],
  doubleHarmonic: [1, 8, 11],
  persian: [1, 6, 11],
  hungarianMinor: [6, 11],
  romanianMinor: [6, 9],
  bhairav: [1, 8, 11],
  todi: [1, 6, 11],
};

function inferStableIntervals(intervals) {
  const third = intervals.includes(4) ? 4 : intervals.includes(3) ? 3 : null;
  const fifth = intervals.includes(7) ? 7 : intervals.includes(6) ? 6 : intervals.includes(8) ? 8 : null;
  return [third, fifth].filter((interval) => interval !== null);
}

export function getScaleToneRole(scaleKey, interval) {
  if (interval === 0) return "tonic";

  const scale = SCALES[scaleKey];
  if (!scale) return "other";
  if (inferStableIntervals(scale.intervals).includes(interval)) return "stable";
  if (CHARACTERISTIC_INTERVALS[scaleKey]?.includes(interval)) return "characteristic";
  return "other";
}

export function buildScaleNotes(intervals, rootMidi = 60) {
  return [
    ...intervals.map((interval) => rootMidi + interval),
    ...intervals.map((interval) => rootMidi + 12 + interval),
    rootMidi + 24,
  ];
}

export function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function midiToLabel(midi) {
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pitchClass]} ${octave}`;
}

export function positionToNoteIndex(clientX, left, width, noteCount) {
  if (width <= 0 || noteCount <= 0) return 0;
  const ratio = Math.min(Math.max((clientX - left) / width, 0), 1 - Number.EPSILON);
  return Math.floor(ratio * noteCount);
}
