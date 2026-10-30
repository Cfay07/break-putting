import { leanOf, type LeanRead } from './practice';
import { puttSG } from './sg';
import type { BreakDir, DrillDef, Lean, MissDir, PracticeSet, Putt, Round, Surface, Zone } from './types';
import { breakBucket, breakDirsOf, isLagZone, slopeOf } from './types';

/* ---------- drills made for one finding ---------- */

const FIX = /^fix:([a-z]+(?:-[a-z]+)?):(\d+)$/;

type Kind =
  | 'gate' | 'past' | 'die' | 'apex-lr' | 'apex-rl' | 'aim-lr' | 'aim-rl' | 'firm-lr' | 'firm-rl'
  | 'downhill' | 'uphill' | 'double'
  | 'lag' | 'lag-lr' | 'lag-rl' | 'lag-up' | 'lag-down' | 'lag-past' | 'lag-dead';

/** From here out a putt is judged on where it finishes, so every fix becomes a lag drill. */
export const LAG_FROM = 16;

const ten = (d: number, extra: Partial<DrillDef['stations'][number]> = {}) => [{ d, balls: 10, ...extra }];
const BOTH: Surface[] = ['indoor', 'green'];
const GREEN: Surface[] = ['green'];
const WAY = { lr: 'left to right', rl: 'right to left' } as const;
const EDGE = { lr: 'left', rl: 'right' } as const;

/**
 * A drill built for one finding, at the distance the finding came from. Its id names the
 * kind and the distance, so the same fix rolled twice keeps one history.
 */
export function fixDrill(id: string): DrillDef | undefined {
  const m = id.match(FIX);
  if (!m) return undefined;
  const kind = m[1] as Kind;
  const d = Number(m[2]);
  const base = { id, scoring: 'count' as const, putting: true, source: 'app' as const };
  const dir = kind.endsWith('-lr') ? 'lr' : 'rl';
  const zone = Math.max(2, Math.round(d / 10));
  const lag = (name: string, how: string): DrillDef => ({
    ...base,
    name,
    stations: ten(d, { mode: 'zone', zoneFt: zone }),
    surfaces: BOTH,
    how: `${how} A ball counts if it drops or finishes within ${zone} feet, a tenth of the putt.`,
  });
  switch (kind) {
    case 'lag':
      return lag(`Lag from ${d}`, `Ten balls from ${d} feet, a new line each time if you have room.`);
    case 'lag-lr':
    case 'lag-rl':
      return lag(`${dir === 'lr' ? 'Left-to-right' : 'Right-to-left'} lags from ${d}`, `Ten ${d}-footers that break ${WAY[dir]}.`);
    case 'lag-up':
      return { ...lag(`Uphill lags from ${d}`, `Ten uphill ${d}-footers.`), surfaces: GREEN };
    case 'lag-down':
      return { ...lag(`Downhill lags from ${d}`, `Ten downhill ${d}-footers.`), surfaces: GREEN };
    case 'lag-past':
      return lag(`Lag past the hole from ${d}`, `Ten from ${d} feet. Only balls that finish past the hole count; short never does.`);
    case 'lag-dead':
      return lag(`Lag dead from ${d}`, `Ten from ${d} feet, trying to stop each one at the hole rather than run it by.`);
    case 'gate':
      return { ...base, name: `Gate at ${d} ft`, stations: ten(d), surfaces: BOTH, how: `Two tees a putterhead apart, a foot in front of the ball. Ten from ${d} feet; only putts that go through clean and drop count.` };
    case 'past':
      return { ...base, name: `Past the hole from ${d}`, stations: ten(d), surfaces: BOTH, how: `Ten from ${d} feet. Any miss has to finish 12 to 18 inches past. Short is the one miss you are not allowed.` };
    case 'die':
      return { ...base, name: d < 10 ? `Dead weight from ${d}` : `Die it from ${d}`, stations: ten(d, { mode: 'zone', zoneFt: 1 }), surfaces: BOTH, how: `Ten from ${d} feet. A ball counts if it drops or stops within a foot past.` };
    case 'apex-lr':
    case 'apex-rl':
      return { ...base, name: `Apex tee, ${WAY[dir]}, ${d} ft`, stations: ten(d), surfaces: GREEN, how: `Find a ${d}-footer that breaks ${WAY[dir]}. Put a tee at the apex, a touch higher than it looks, and roll ten over it.` };
    case 'aim-lr':
    case 'aim-rl':
      return { ...base, name: `Start it ${EDGE[dir]}, ${d} ft`, stations: ten(d), surfaces: ['indoor'], how: `Indoors has no break, so train the start line a ${WAY[dir]} putt needs: two tees a ball apart, one cup outside the ${EDGE[dir]} edge. Ten from ${d} feet; count the ones that go through.` };
    case 'firm-lr':
    case 'firm-rl':
      return { ...base, name: `Firmer, less break, ${d} ft`, stations: ten(d), surfaces: GREEN, how: `A ${d}-foot putt breaking ${WAY[dir]}. Play half the break you read and hit it to finish a foot past.` };
    case 'downhill':
      return { ...base, name: `Downhill ${d}s`, stations: ten(d, { mode: 'zone', zoneFt: 1 }), surfaces: GREEN, how: `Ten downhill ${d}-footers. A ball counts if it drops or stops within a foot past.` };
    case 'uphill':
      return { ...base, name: `Uphill ${d}s, firm`, stations: ten(d), surfaces: GREEN, how: `Ten uphill ${d}-footers, firm enough to hold the line.` };
    case 'double':
      return { ...base, name: `Double breakers, ${d} ft`, stations: ten(d), surfaces: GREEN, how: `Find a ${d}-footer that breaks both ways. Read the second break first and roll ten.` };
  }
  return undefined;
}

export type Cond = 'lr' | 'rl' | 'double' | 'straight' | 'uphill' | 'downhill';

export const COND_LABEL: Record<Cond, string> = {
  lr: 'Breaking left to right',
  rl: 'Breaking right to left',
  double: 'Double breakers',
  straight: 'Straight putts',
  uphill: 'Uphill',
  downhill: 'Downhill',
};

/** The drill a finding gets, on the surface you are on. */
export function fixFor(cond: Cond | null, lean: Lean | null, d: number, surface: Surface): string {
  const id = (k: Kind) => `fix:${k}:${d}`;
  const green = surface === 'green';
  if (d >= LAG_FROM) {
    if (lean === 'short') return id('lag-past');
    if (lean === 'long') return id('lag-dead');
    if (cond === 'lr' || cond === 'rl') return id(`lag-${cond}`);
    if (cond === 'uphill') return id(green ? 'lag-up' : 'lag-past');
    if (cond === 'downhill') return id(green ? 'lag-down' : 'lag-dead');
    return id('lag');
  }
  if (lean === 'start-line') return id('gate');
  if (lean === 'short') return id(cond === 'uphill' && green ? 'uphill' : 'past');
  if (lean === 'long') return id(cond === 'downhill' && green ? 'downhill' : 'die');
  if (cond === 'lr' || cond === 'rl') {
    if (lean === 'high') return green ? id(`firm-${cond}`) : id('past');
    return green ? id(`apex-${cond}`) : id(`aim-${cond}`);
  }
  if (cond === 'double') return green ? id('double') : id('gate');
  if (cond === 'downhill') return green ? id('downhill') : id('die');
  if (cond === 'uphill') return green ? id('uphill') : id('past');
  return id('gate');
}

/* ---------- the slow loop: rounds ---------- */

/** Putts a slice needs, and the comparison group too, before it can be named. */
export const SLICE_NEED = 10;

export interface Slice {
  cond: Cond;
  made: number;
  attempts: number;
  /** The rest of your tagged putts from this distance, the fair comparison. */
  restMade: number;
  restAttempts: number;
  /** Slice success minus the rest, in points. Negative is worse. */
  gap: number;
  /** Half-width of the 95% interval on the gap, in points. */
  margin: number;
  /** Strokes a round this kind of putt costs beyond your normal from this distance. */
  cost: number;
  lean: LeanRead | null;
  /** The distance to build the fix at: the middle of these putts. */
  d: number;
}

const ZONE_RANGE: Record<Zone, [number, number]> = {
  tapin: [0, 2],
  short: [3, 5],
  mid: [6, 8],
  long: [9, 15],
  far: [16, 30],
  lag: [31, 40],
  deep: [41, Infinity],
};

function condsOf(p: Putt): Cond[] {
  const dirs = breakDirsOf(p);
  const out: Cond[] = [];
  const b = breakBucket(dirs);
  if (b === 'lr' || b === 'rl' || b === 'double' || b === 'straight') out.push(b);
  const s = slopeOf(dirs as BreakDir[]);
  if (s) out.push(s);
  return out;
}

interface Scored {
  p: Putt;
  sg: number;
  ok: boolean;
}

/**
 * Inside one distance zone, which kind of putt is costing you, against your other tagged putts
 * from the same distance. Untagged putts are left out of both sides on purpose: putts that get
 * tagged are the harder ones, and comparing them with untagged tap-ins would invent a finding.
 */
export function pinpoint(rounds: Round[], baseline: [number, number][], zone: Zone): Slice[] {
  const [lo, hi] = ZONE_RANGE[zone];
  const lag = isLagZone(zone);
  const tagged: (Scored & { conds: Cond[] })[] = [];
  let holes = 0;
  for (const r of rounds) {
    for (const h of r.holes) {
      if (h.putts.length) holes++;
      h.putts.forEach((p, i) => {
        if (p.d < lo || p.d > hi) return;
        const conds = condsOf(p);
        if (!conds.length) return;
        const next = h.putts[i + 1];
        const sg = puttSG(baseline, p.d, p.made, p.made ? null : (next?.d ?? null));
        if (sg === null) return;
        // A lag putt does its job by finishing close, so that is what counts as success there.
        const ok = lag ? p.made || (!!next && next.d <= 3) : p.made;
        tagged.push({ p, sg, ok, conds });
      });
    }
  }
  const rounds18 = holes / 18 || 1;
  const out: Slice[] = [];
  for (const cond of Object.keys(COND_LABEL) as Cond[]) {
    const slice = tagged.filter((x) => x.conds.includes(cond));
    const rest = tagged.filter((x) => !x.conds.includes(cond));
    if (slice.length < SLICE_NEED || rest.length < SLICE_NEED) continue;
    const made = slice.filter((x) => x.ok).length;
    const restMade = rest.filter((x) => x.ok).length;
    const p1 = made / slice.length;
    const p2 = restMade / rest.length;
    if (p1 >= p2) continue;
    const sgSlice = slice.reduce((s, x) => s + x.sg, 0) / slice.length;
    const sgRest = rest.reduce((s, x) => s + x.sg, 0) / rest.length;
    const ds = slice.map((x) => x.p.d).sort((a, b) => a - b);
    out.push({
      cond,
      made,
      attempts: slice.length,
      restMade,
      restAttempts: rest.length,
      gap: (p1 - p2) * 100,
      margin: 196 * Math.sqrt((p1 * (1 - p1)) / slice.length + (p2 * (1 - p2)) / rest.length),
      cost: ((sgSlice - sgRest) * slice.length) / rounds18,
      lean: leanOf(slice.map((x) => x.p)),
      d: Math.round(ds[ds.length >> 1]),
    });
  }
  return out.filter((s) => s.cost < 0).sort((a, b) => a.cost - b.cost).slice(0, 2);
}

/** How this slice has gone on the course since a date, beside how it went before. */
export function sliceSince(
  rounds: Round[],
  zone: Zone,
  cond: Cond,
  since: string,
): { before: { made: number; attempts: number }; after: { made: number; attempts: number } } {
  const [lo, hi] = ZONE_RANGE[zone];
  const t = { before: { made: 0, attempts: 0 }, after: { made: 0, attempts: 0 } };
  for (const r of rounds) {
    const side = r.date >= since ? t.after : t.before;
    for (const h of r.holes) {
      h.putts.forEach((p, i) => {
        if (p.d < lo || p.d > hi || !condsOf(p).includes(cond)) return;
        const next = h.putts[i + 1];
        side.attempts++;
        if (isLagZone(zone) ? p.made || (!!next && next.d <= 3) : p.made) side.made++;
      });
    }
  }
  return t;
}

/* ---------- the fast loop: practice ---------- */

const BANDS = [
  { label: '3 to 5 ft', lo: 0, hi: 5 },
  { label: '6 to 10 ft', lo: 6, hi: 10 },
  { label: '11 ft and out', lo: 11, hi: Infinity },
];

/** The newest tagged misses a band looks at, so the pattern is how you miss now. */
export const RECENT_MISSES = 20;
export const PATTERN_NEED = 8;

export interface PracticePattern {
  band: string;
  surface: Surface;
  dir: MissDir;
  n: number;
  of: number;
  d: number;
}

/**
 * Your recent practice misses, by distance and surface: when one direction covers at least half
 * of them, that is the habit to fix. Needs only the optional "which way" tap, never a round.
 */
export function practicePattern(sets: PracticeSet[]): PracticePattern | null {
  const newest = [...sets].sort((a, b) => b.date.localeCompare(a.date) || (b.updated ?? '').localeCompare(a.updated ?? ''));
  let best: PracticePattern | null = null;
  for (const surface of ['indoor', 'green'] as Surface[]) {
    for (const band of BANDS) {
      const counts: Partial<Record<MissDir, number>> = {};
      const ds: number[] = [];
      let of = 0;
      for (const s of newest) {
        if (s.surface !== surface || of >= RECENT_MISSES) continue;
        for (const st of s.stations ?? []) {
          if (st.d < band.lo || st.d > band.hi || !st.misses) continue;
          for (const [dir, n] of Object.entries(st.misses) as [MissDir, number][]) {
            counts[dir] = (counts[dir] ?? 0) + n;
            of += n;
            for (let i = 0; i < n; i++) ds.push(st.d);
          }
        }
      }
      if (of < PATTERN_NEED) continue;
      const [dir, n] = (Object.entries(counts) as [MissDir, number][]).reduce((a, b) => (b[1] > a[1] ? b : a));
      if (n * 2 < of) continue;
      ds.sort((a, b) => a - b);
      const found = { band: band.label, surface, dir, n, of, d: ds[ds.length >> 1] };
      if (!best || n / of > best.n / best.of) best = found;
    }
  }
  return best;
}

export function practiceFix(p: PracticePattern): string {
  const lean: Lean = p.dir === 'short' ? 'short' : p.dir === 'long' ? 'long' : 'start-line';
  return fixFor(null, lean, p.d, p.surface);
}
