const ARCHIVE_VERSION = 1;

function validLoopBars(value, fallback = 1) {
  return Number.isInteger(value) && value >= 1 && value <= 16 ? value : fallback;
}

export function createProjectArchive({ tempo, loopBars, trackLoopBars, scaleKey, currentInstrumentId, mutedTrackIds, soloTrackIds, tracks, song, workspaceMode, savedAt }) {
  const loopBarsByTrack = Object.fromEntries(
    [...tracks.keys()].map((instrumentId) => [
      instrumentId,
      validLoopBars(trackLoopBars?.get?.(instrumentId), validLoopBars(loopBars)),
    ])
  );
  return {
    version: ARCHIVE_VERSION,
    savedAt: savedAt ?? new Date().toISOString(),
    tempo,
    loopBars: loopBarsByTrack[currentInstrumentId] ?? validLoopBars(loopBars),
    trackLoopBars: loopBarsByTrack,
    scaleKey,
    currentInstrumentId,
    workspaceMode: workspaceMode === "song" ? "song" : "loop",
    mutedTrackIds: [...(mutedTrackIds ?? [])],
    soloTrackIds: [...(soloTrackIds ?? [])],
    tracks: Object.fromEntries(
      [...tracks].map(([instrumentId, track]) => [instrumentId, [...track.entries()]])
    ),
    ...(song ? { song: JSON.parse(JSON.stringify(song)) } : {}),
  };
}

export function parseProjectArchive(rawArchive, instrumentIds) {
  const archive = typeof rawArchive === "string" ? JSON.parse(rawArchive) : rawArchive;
  if (!archive || archive.version !== ARCHIVE_VERSION) throw new Error("不支持的存档版本");
  if (!Number.isFinite(archive.tempo)) throw new Error("存档参数无效");

  const tracks = new Map(instrumentIds.map((instrumentId) => [instrumentId, new Map()]));
  for (const instrumentId of instrumentIds) {
    const entries = archive.tracks?.[instrumentId];
    if (!Array.isArray(entries)) continue;

    const track = tracks.get(instrumentId);
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [step, point] = entry;
      if (!Number.isInteger(step) || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue;
      track.set(step, { x: Math.min(1, Math.max(0, point.x)), y: Math.min(1, Math.max(0, point.y)) });
    }
  }

  const mutedTrackIds = new Set(
    Array.isArray(archive.mutedTrackIds)
      ? archive.mutedTrackIds.filter((instrumentId) => instrumentIds.includes(instrumentId))
      : []
  );
  const soloTrackIds = new Set(
    Array.isArray(archive.soloTrackIds)
      ? archive.soloTrackIds.filter((instrumentId) => instrumentIds.includes(instrumentId))
      : []
  );
  const legacyLoopBars = validLoopBars(archive.loopBars);
  const trackLoopBars = new Map(
    instrumentIds.map((instrumentId) => [
      instrumentId,
      validLoopBars(archive.trackLoopBars?.[instrumentId], legacyLoopBars),
    ])
  );
  const workspaceMode = archive.workspaceMode === "song" ? "song" : "loop";
  return { ...archive, workspaceMode, mutedTrackIds, soloTrackIds, trackLoopBars, tracks };
}
