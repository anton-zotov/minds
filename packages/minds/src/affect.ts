import type { AffectDimension } from './types.js';
export function decay(dimensions: Record<string, AffectDimension>, elapsedMs: number): Record<string, AffectDimension> {
  return Object.fromEntries(Object.entries(dimensions).map(([name, dimension]) => [name, {
    ...dimension, value: dimension.baseline + (dimension.value - dimension.baseline) * 2 ** (-elapsedMs / dimension.halfLifeMs),
  }]));
}
export function applyDeltas(dimensions: Record<string, AffectDimension>, deltas: Record<string, number>): void {
  for (const [name, delta] of Object.entries(deltas)) {
    const dimension = dimensions[name]!;
    dimension.value = Math.min(1, Math.max(0, dimension.value + delta));
  }
}
