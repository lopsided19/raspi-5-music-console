export function registerPointerPress(order, pointerId) {
  const existingIndex = order.indexOf(pointerId);
  if (existingIndex >= 0) order.splice(existingIndex, 1);
  order.push(pointerId);
  return pointerId;
}

export function unregisterPointer(order, pointerId) {
  const index = order.indexOf(pointerId);
  if (index >= 0) order.splice(index, 1);
  return order.at(-1) ?? null;
}

export function activePointerPoint(order, positions) {
  const pointerId = order.at(-1);
  return pointerId === undefined ? null : positions.get(pointerId) ?? null;
}
