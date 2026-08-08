export const MIN_TEMPO = 40;
export const MAX_TEMPO = 240;

export function clampTempo(value) {
  return Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(Number(value))));
}

export function tapTempoFromTimestamps(timestamps) {
  if (timestamps.length < 2) return null;
  const recent = timestamps.slice(-4);
  const elapsed = recent.at(-1) - recent[0];
  if (elapsed <= 0) return null;
  return clampTempo(60_000 / (elapsed / (recent.length - 1)));
}

export function isTapIntervalInRange(intervalMs, tempo) {
  const beatDuration = 60_000 / clampTempo(tempo);
  return intervalMs >= beatDuration * 0.5 && intervalMs <= beatDuration * 2;
}
