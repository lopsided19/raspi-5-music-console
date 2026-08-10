export const TUTORIAL_CHORD_SEQUENCE = Object.freeze(["I", "V", "vi", "IV"]);

export function nextChordProgress(currentProgress, chordId, sequence = TUTORIAL_CHORD_SEQUENCE) {
  const progress = Math.max(0, Math.min(sequence.length, Number(currentProgress) || 0));
  if (chordId === sequence[progress]) return Math.min(sequence.length, progress + 1);
  return chordId === sequence[0] ? 1 : 0;
}

export function chordSequenceComplete(progress, sequence = TUTORIAL_CHORD_SEQUENCE) {
  return Number(progress) >= sequence.length;
}
