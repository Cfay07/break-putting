import type { Round } from './types';

/** First putts needed before the half-way distance is worth quoting. */
export const MIN_FIRST_PUTTS = 100;

export interface Level {
  /** One-putt half the time from here. */
  d50: number;
  firstPutts: number;
}

/** The first putt on every holed-out hole. */
function firstPutts(rounds: Round[]): { x: number; made: number }[] {
  return rounds
    .filter((r) => r.finished && !r.practice)
    .flatMap((r) => r.holes)
    .filter((h) => h.putts.length > 0 && h.putts[h.putts.length - 1].made && h.putts[0].d >= 1)
    .map((h) => ({ x: Math.log(h.putts[0].d), made: h.putts[0].made ? 1 : 0 }));
}

/** How far out you still one-putt half the time, fitted from every first putt you holed out on. */
export function levelOf(rounds: Round[]): Level | null {
  const ps = firstPutts(rounds);
  if (ps.length < MIN_FIRST_PUTTS) return null;

  // Make chance as a logistic in log distance, fitted by Newton's method.
  let a = 0;
  let b = 0;
  for (let i = 0; i < 50; i++) {
    let g0 = 0;
    let g1 = 0;
    let h00 = 0;
    let h01 = 0;
    let h11 = 0;
    for (const p of ps) {
      const q = 1 / (1 + Math.exp(-(a + b * p.x)));
      const w = q * (1 - q);
      g0 += p.made - q;
      g1 += (p.made - q) * p.x;
      h00 += w;
      h01 += w * p.x;
      h11 += w * p.x * p.x;
    }
    const det = h00 * h11 - h01 * h01;
    if (!det) return null;
    a += (h11 * g0 - h01 * g1) / det;
    b += (h00 * g1 - h01 * g0) / det;
  }
  if (b >= 0) return null;
  return { d50: Math.exp(-a / b), firstPutts: ps.length };
}
