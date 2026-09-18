import type { Round } from './types';

export function expectedPutts(baseline: [number, number][], d: number): number {
  if (d <= baseline[0][0]) return baseline[0][1];
  const last = baseline[baseline.length - 1];
  if (d >= last[0]) return last[1];
  for (let i = 1; i < baseline.length; i++) {
    const [x1, y1] = baseline[i - 1];
    const [x2, y2] = baseline[i];
    if (d <= x2) return y1 + ((d - x1) / (x2 - x1)) * (y2 - y1);
  }
  return last[1];
}

/** Strokes gained on one putt: what it was worth from here, minus the stroke, minus what is left. */
export function puttSG(
  baseline: [number, number][],
  d: number,
  made: boolean,
  leave: number | null,
): number | null {
  if (made) return expectedPutts(baseline, d) - 1;
  if (leave === null) return null;
  return expectedPutts(baseline, d) - 1 - expectedPutts(baseline, leave);
}

export function holeSG(baseline: [number, number][], putts: number[], count: number): number {
  if (!putts.length) return 0;
  return expectedPutts(baseline, putts[0]) - count;
}

export function roundSG(round: Round, baseline: [number, number][]): number {
  return round.holes.reduce((sum, h) => {
    if (!h.putts.length) return sum;
    return sum + holeSG(baseline, h.putts.map((p) => p.d), h.putts.length);
  }, 0);
}
