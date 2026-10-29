import type { Round } from './types';

/**
 * Expected putts from a distance.
 *
 * Past the end of the table this used to return the last value for everything, so a 61 footer and
 * a 90 footer scored identically and anything ranking putts by difficulty tied them. The tail is
 * close to straight in ln(distance), so it carries on along its own slope instead. That is an
 * extrapolation and it is kept to a modest reach: beyond roughly a hundred feet you are off a
 * green and the number stops meaning anything either way.
 */
export function expectedPutts(baseline: [number, number][], d: number): number {
  if (d <= baseline[0][0]) return baseline[0][1];
  const last = baseline[baseline.length - 1];
  if (d >= last[0]) {
    // Least squares over the tail rather than the final pair: the last two points alone give a
    // slope steep enough to call a long lag a two-and-a-half putt.
    const tail = baseline.slice(-5);
    if (tail.length < 2) return last[1];
    const xs = tail.map((t) => Math.log(t[0]));
    const ys = tail.map((t) => t[1]);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let den = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    if (!den) return last[1];
    // A hundred feet is the end of the reach. Past that you are not on the green.
    const reach = Math.min(d, 100);
    return last[1] + (num / den) * (Math.log(reach) - Math.log(last[0]));
  }
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
