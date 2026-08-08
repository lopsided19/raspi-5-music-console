import { loopStepCount } from "./loop.js";

function formatCoordinate(value) {
  return Number(value.toFixed(3));
}

export function trackPathData(track, bars) {
  const totalSteps = loopStepCount(bars);
  const entries = [...track]
    .filter(([step, point]) => (
      Number.isInteger(step)
      && step >= 0
      && step < totalSteps
      && Number.isFinite(point?.x)
    ))
    .sort(([stepA], [stepB]) => stepA - stepB);

  const runs = [];
  for (const entry of entries) {
    const run = runs.at(-1);
    if (!run || entry[0] !== run.at(-1)[0] + 1) runs.push([entry]);
    else run.push(entry);
  }

  return runs.map((run) => {
    const coordinates = run.map(([step, point]) => ({
      x: formatCoordinate(step / totalSteps * 100),
      y: formatCoordinate(1 + (1 - Math.min(1, Math.max(0, point.x))) * 98),
    }));
    if (coordinates.length === 1) {
      const [{ x, y }] = coordinates;
      const endX = formatCoordinate(Math.min(100, x + 0.5));
      return `M ${x} ${y} L ${endX} ${y}`;
    }
    return coordinates.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  }).join(" ");
}
