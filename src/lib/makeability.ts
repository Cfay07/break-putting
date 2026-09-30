import { breakDirsOf, breakBucket, slopeOf, type BreakDir, type Round } from './types';

/**
 * How often this player holes a putt of a given shape. Distance and break, learned from their own
 * putts rather than a published table, because no published table carries break at all.
 *
 * Fitted in two stages on purpose. Distance uses every putt, which is the bulk of anyone's data.
 * Break uses only the putts that were actually tagged, as an offset on top of the distance curve,
 * because a putt with no tag is not a straight putt, it is an unknown one. Folding untagged putts
 * into the reference level would quietly drag every break number toward nothing.
 */

/** Ridge weight on the break terms. Thin buckets pull toward no effect instead of swinging. */
const RIDGE = 15;

/**
 * Fewer tagged putts than this and the break half stays switched off entirely. Set high on
 * purpose: at a hundred-odd tags spread over five terms the estimates are still mostly noise,
 * and a confident wrong number does more damage to trust than an empty panel.
 */
export const MIN_TAGGED = 150;

/** A single shape needs its own sample before its row means anything, whatever the total says. */
export const MIN_TERM = 30;

const TERMS = ['lr', 'rl', 'double', 'uphill', 'downhill'] as const;
type Term = (typeof TERMS)[number];

export interface MakeModel {
  /** Intercept and slope on ln(distance). Always present once there is any putt at all. */
  distance: [number, number];
  /** Log-odds shift per break term, straight and flat being the reference. */
  breakShift: Record<Term, number>;
  n: number;
  tagged: number;
  taggedBy: Record<Term, number>;
  ready: boolean;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const ln = (d: number) => Math.log(Math.max(d, 1));

/** Gaussian elimination with partial pivoting. k is never more than six here. */
function solve(a: number[][], b: number[]): number[] | null {
  const k = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < k; c++) {
    let pivot = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
    if (Math.abs(m[pivot][c]) < 1e-10) return null;
    [m[c], m[pivot]] = [m[pivot], m[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let j = c; j <= k; j++) m[r][j] -= f * m[c][j];
    }
  }
  return m.map((row, i) => row[k] / row[i]);
}

/**
 * Penalised logistic regression by iteratively reweighted least squares. `offset` carries a
 * prediction the fit is not allowed to re-estimate, which is how the break stage sits on top of
 * the distance stage. `penalty` is per coefficient so an intercept can stay unpenalised.
 */
function irls(
  x: number[][],
  y: number[],
  penalty: number[],
  offset: number[],
): number[] | null {
  const k = penalty.length;
  let beta = new Array(k).fill(0);

  for (let step = 0; step < 25; step++) {
    const xtwx = Array.from({ length: k }, () => new Array(k).fill(0));
    const xtwz = new Array(k).fill(0);

    for (let i = 0; i < y.length; i++) {
      const eta = offset[i] + x[i].reduce((s, v, j) => s + v * beta[j], 0);
      const p = sigmoid(eta);
      const w = Math.max(p * (1 - p), 1e-6);
      const z = eta - offset[i] + (y[i] - p) / w;
      for (let r = 0; r < k; r++) {
        xtwz[r] += x[i][r] * w * z;
        for (let c = 0; c < k; c++) xtwx[r][c] += x[i][r] * w * x[i][c];
      }
    }
    for (let r = 0; r < k; r++) xtwx[r][r] += penalty[r];

    const next = solve(xtwx, xtwz);
    if (!next) return null;
    const move = Math.max(...next.map((v, j) => Math.abs(v - beta[j])));
    beta = next;
    if (move < 1e-7) break;
  }
  return beta;
}

function termsOf(dirs: BreakDir[]): Term[] {
  const out: Term[] = [];
  const bucket = breakBucket(dirs);
  if (bucket === 'lr') out.push('lr');
  if (bucket === 'rl') out.push('rl');
  if (bucket === 'double') out.push('double');
  const slope = slopeOf(dirs);
  if (slope) out.push(slope);
  return out;
}

export function fitMakeModel(rounds: Round[]): MakeModel {
  const all: { d: number; made: boolean; dirs: BreakDir[] }[] = [];
  for (const r of rounds) {
    for (const h of r.holes) {
      for (const p of h.putts) all.push({ d: p.d, made: p.made, dirs: breakDirsOf(p) });
    }
  }

  const zero = Object.fromEntries(TERMS.map((t) => [t, 0])) as Record<Term, number>;
  const empty: MakeModel = {
    distance: [0, 0],
    breakShift: { ...zero },
    n: all.length,
    tagged: 0,
    taggedBy: { ...zero },
    ready: false,
  };
  if (all.length < 20) return empty;

  // Stage one: distance, on every putt there is.
  const distance = irls(
    all.map((p) => [1, ln(p.d)]),
    all.map((p) => (p.made ? 1 : 0)),
    [0, 0],
    all.map(() => 0),
  );
  if (!distance) return empty;
  const model: MakeModel = { ...empty, distance: [distance[0], distance[1]] };

  // Stage two: break, on the tagged putts only, as a shift on top of stage one.
  const tagged = all.filter((p) => p.dirs.length);
  const taggedBy = { ...zero };
  for (const p of tagged) for (const t of termsOf(p.dirs)) taggedBy[t] += 1;
  model.tagged = tagged.length;
  model.taggedBy = taggedBy;
  if (tagged.length < MIN_TAGGED) return model;

  const shift = irls(
    tagged.map((p) => {
      const ts = termsOf(p.dirs);
      return TERMS.map((t) => (ts.includes(t) ? 1 : 0));
    }),
    tagged.map((p) => (p.made ? 1 : 0)),
    TERMS.map(() => RIDGE),
    tagged.map((p) => distance[0] + distance[1] * ln(p.d)),
  );
  if (!shift) return model;

  model.breakShift = Object.fromEntries(TERMS.map((t, i) => [t, shift[i]])) as Record<Term, number>;
  model.ready = true;
  return model;
}

/** Chance this player holes it, 0 to 1. Break only counts once there is enough of it tagged. */
export function makeability(model: MakeModel, d: number, dirs: BreakDir[] = []): number | null {
  if (!model.n || (model.distance[0] === 0 && model.distance[1] === 0)) return null;
  let eta = model.distance[0] + model.distance[1] * ln(d);
  if (model.ready) for (const t of termsOf(dirs)) eta += model.breakShift[t];
  return sigmoid(eta);
}

/** What the break alone is worth, in percentage points, against a straight flat putt of the same length. */
export function breakCost(model: MakeModel, d: number, dirs: BreakDir[]): number | null {
  if (!model.ready) return null;
  const plain = makeability(model, d, []);
  const real = makeability(model, d, dirs);
  if (plain === null || real === null) return null;
  return (real - plain) * 100;
}
