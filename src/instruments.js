export function instrumentMidi(instrumentId, scaleMidi) {
  return instrumentId === "bass" ? scaleMidi - 24 : scaleMidi;
}

export function instrumentPreset(instrumentId) {
  if (instrumentId === "bass") return "bass";
  if (instrumentId === "chord") return "chord";
  return "default";
}

export function instrumentTouchLimit(instrumentId) {
  return 1;
}
