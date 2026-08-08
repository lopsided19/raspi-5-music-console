export function toggleTrackMute(mutedTrackIds, trackId) {
  if (mutedTrackIds.has(trackId)) mutedTrackIds.delete(trackId);
  else mutedTrackIds.add(trackId);
  return mutedTrackIds;
}

export function toggleTrackSolo(soloTrackIds, trackId) {
  if (soloTrackIds.has(trackId)) soloTrackIds.delete(trackId);
  else soloTrackIds.add(trackId);
  return soloTrackIds;
}

export function isTrackAudible(mutedTrackIds, soloTrackIds, trackId) {
  if (soloTrackIds.size > 0) return soloTrackIds.has(trackId);
  return !mutedTrackIds.has(trackId);
}

export function trackGesturePreview(dx, dy) {
  const verticalDistance = Math.abs(dy);
  const isVerticalGesture = verticalDistance >= 4 && verticalDistance > Math.abs(dx) * 1.15;
  if (!isVerticalGesture) return null;

  return {
    action: dy < 0 ? "solo" : "mute",
    progress: Math.min(1, (verticalDistance - 4) / 18),
    confirmed: verticalDistance >= 22,
  };
}

export function trackGestureLabel(action, isActive) {
  if (action === "solo") return isActive ? "Unsolo" : "Solo";
  if (action === "mute") return isActive ? "Unmute" : "Mute";
  return "";
}

export function trackGestureAction(dx, dy) {
  const distance = Math.hypot(dx, dy);
  const preview = trackGesturePreview(dx, dy);
  if (preview?.confirmed) return preview.action;
  return distance < 10 ? "select" : null;
}
