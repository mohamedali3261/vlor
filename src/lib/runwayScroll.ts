/** Bound a runway wheel gesture, yielding to normal page scroll at either end. */
export function runwayWheel(current: number, last: number, delta: number): { target: number; consume: boolean } {
  const max = Math.max(0, last);
  const position = Math.min(max, Math.max(0, current));
  if (!Number.isFinite(delta) || delta === 0 || (delta > 0 && position >= max) || (delta < 0 && position <= 0)) {
    return { target: position, consume: false };
  }
  return {
    target: Math.min(max, Math.max(0, position + Math.min(120, Math.max(-120, delta)) / 420)),
    consume: true,
  };
}
