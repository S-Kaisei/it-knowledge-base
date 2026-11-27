/**
 * Effective (average) memory access time with a single cache level.
 *
 * Two textbook models are provided because sources differ:
 * - IPA model (used in the Japanese IT exams): the cache and the main memory are looked up in parallel,
 *   so a miss costs only the memory time.  T = h·Tc + (1 − h)·Tm
 * - Miss-penalty model (common in English textbooks): every access pays the hit time, and a miss adds
 *   the miss penalty on top.  T = Thit + (1 − h)·Tpenalty
 */

function assertHitRate(hitRate: number): void {
  if (!Number.isFinite(hitRate) || hitRate < 0 || hitRate > 1) {
    throw new RangeError(`hitRate must be a number in [0, 1] (got ${hitRate})`);
  }
}

function assertTime(name: string, ns: number): void {
  if (!Number.isFinite(ns) || ns < 0) {
    throw new RangeError(`${name} must be a non-negative finite number (got ${ns})`);
  }
}

/** IPA model: h·Tc + (1 − h)·Tm (ns). */
export function effectiveAccessTime(hitRate: number, cacheNs: number, memoryNs: number): number {
  assertHitRate(hitRate);
  assertTime('cacheNs', cacheNs);
  assertTime('memoryNs', memoryNs);
  return hitRate * cacheNs + (1 - hitRate) * memoryNs;
}

/** Miss-penalty model: hit time + (1 − h)·miss penalty (ns). */
export function missPenaltyModelTime(hitRate: number, hitNs: number, missPenaltyNs: number): number {
  assertHitRate(hitRate);
  assertTime('hitNs', hitNs);
  assertTime('missPenaltyNs', missPenaltyNs);
  return hitNs + (1 - hitRate) * missPenaltyNs;
}

/** How many times faster than accessing main memory every time (memoryNs / eatNs). */
export function speedup(memoryNs: number, eatNs: number): number {
  assertTime('memoryNs', memoryNs);
  assertTime('eatNs', eatNs);
  if (eatNs === 0) throw new RangeError('eatNs must be greater than 0');
  return memoryNs / eatNs;
}

/** Clamp a value into [min, max] and snap it to the step grid starting at min (for slider defaults). */
export function clampToStep(value: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(value)) return min;
  const clamped = Math.min(max, Math.max(min, value));
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Math.min(max, Number(snapped.toFixed(10)));
}

/** "0.90×10 + 0.10×100" — the IPA formula with the numbers filled in. */
export function formatCalculation(hitRate: number, cacheNs: number, memoryNs: number): string {
  assertHitRate(hitRate);
  const miss = 1 - hitRate;
  return `${hitRate.toFixed(2)}×${cacheNs} + ${miss.toFixed(2)}×${memoryNs}`;
}
