import { expectedPutts } from './sg';
import type { DrillDef, PracticeSet, Station, StationResult, Surface } from './types';

/**
 * The same eighteen putts every week, in a new order. It is the one practice number that means
 * the same thing next month as it does today, and it needs no rounds at all, so a player with
 * nothing logged still has a target and a score to beat.
 */
export const TEST_ID = 'weekly-test';

const SHORT = [3, 4, 4, 5, 5, 6, 6, 7, 8, 9, 10, 12];
const LAG = [20, 22, 24, 26, 28, 30];
const LAG_FROM = 16;

/** The eighteen balls for a room. A short room moves the long six in, it never drops them. */
export function testBalls(room: number): Station[] {
  const short: Station[] = SHORT.map((d) => ({ d: Math.min(d, room), balls: 1 }));
  const top = Math.min(room, 30);
  // Under 16 ft there is no lag putt to be had, so the six test pace from the back of the room
  // against a tighter circle instead.
  const zoneFt = top >= LAG_FROM ? 3 : 2;
  const lo = Math.max(LAG_FROM, top - 10);
  const lag: Station[] = LAG.map((d) => ({
    d: top >= LAG_FROM ? Math.round(lo + ((d - 20) * (top - lo)) / 10) : top,
    balls: 1,
    mode: 'zone',
    zoneFt,
    label: `inside ${zoneFt} ft`,
  }));
  return [...short, ...lag];
}

/** Monday of the week a date falls in. */
export function weekOf(date: string): string {
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

function shuffled<T>(xs: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const next = () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function howOf(balls: Station[]): string {
  const makes = balls.filter((b) => b.mode !== 'zone').map((b) => b.d);
  const lags = balls.filter((b) => b.mode === 'zone');
  const range = (ds: number[]) => {
    const lo = Math.min(...ds);
    const hi = Math.max(...ds);
    return lo === hi ? `${lo} ft` : `${lo} to ${hi} ft`;
  };
  return (
    `${makes.length} putts from ${range(makes)} count if they drop. ` +
    `${lags.length} from ${range(lags.map((b) => b.d))} count if they finish ${lags[0].label}. ` +
    'One ball each, full routine, no do-overs. The putts stay the same every week and only the order changes.'
  );
}

/** The test as written, in no particular order: what history and the drill page show. */
export function testDef(room = 30): DrillDef {
  const balls = testBalls(room);
  return {
    id: TEST_ID,
    name: 'Weekly test',
    scoring: 'count',
    stations: balls,
    how: howOf(balls),
    minutes: 6,
    surfaces: ['indoor', 'green'],
    putting: true,
    source: 'app',
  };
}

/** This week's order. The same all week, so stepping away and coming back changes nothing. */
export function testDrill(room: number, surface: Surface, date: string): DrillDef {
  const def = testDef(room);
  return { ...def, stations: shuffled(def.stations, `${weekOf(date)}|${surface}`) };
}

/** Two tests are only compared when they were the same eighteen putts. */
export function setupOf(stations: Pick<StationResult, 'd' | 'mode' | 'attempts'>[]): string {
  const counts = new Map<string, number>();
  for (const s of stations) {
    const k = `${s.d}${s.mode === 'zone' ? 'z' : 'm'}`;
    counts.set(k, (counts.get(k) ?? 0) + s.attempts);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}x${n}`)
    .join(',');
}

export interface TestStatus {
  /** The week's test: the first one taken, since a second go is practice, not the test. */
  thisWeek: PracticeSet | null;
  /** Every week's test on this surface and setup, oldest first, one per week. */
  weeks: PracticeSet[];
  best: PracticeSet | null;
}

export function testStatus(sets: PracticeSet[], surface: Surface, room: number, date: string): TestStatus {
  const setup = setupOf(testBalls(room).map((b) => ({ d: b.d, mode: b.mode ?? 'make', attempts: b.balls })));
  const mine = sets
    .filter((s) => s.drill === TEST_ID && s.surface === surface && s.attempts > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.updated ?? '').localeCompare(b.updated ?? ''));
  const firstOfWeek = new Map<string, PracticeSet>();
  for (const s of mine) if (!firstOfWeek.has(weekOf(s.date))) firstOfWeek.set(weekOf(s.date), s);
  const weeks = [...firstOfWeek.values()].filter((s) => s.stations && setupOf(s.stations) === setup);
  const best = weeks.reduce<PracticeSet | null>((b, s) => (!b || s.made > b.made ? s : b), null);
  return { thisWeek: firstOfWeek.get(weekOf(date)) ?? null, weeks, best };
}

/** The Monday the next test opens. */
export function nextTestDay(date: string): string {
  const t = new Date(`${weekOf(date)}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 7);
  return t.toISOString().slice(0, 10);
}

/** A test split the way it is scored: putts that had to drop, and lag putts that had to finish close. */
export function testParts(set: PracticeSet, baseline: [number, number][]) {
  const st = set.stations ?? [];
  const makes = st.filter((s) => s.mode !== 'zone');
  const lags = st.filter((s) => s.mode === 'zone');
  const sum = (xs: StationResult[], f: (s: StationResult) => number) => xs.reduce((n, s) => n + f(s), 0);
  return {
    holed: sum(makes, (s) => s.made),
    of: sum(makes, (s) => s.attempts),
    // Two minus expected putts is the scratch make rate, the same way Work on gets it.
    scratch: sum(makes, (s) => s.attempts * Math.min(1, Math.max(0, 2 - expectedPutts(baseline, s.d)))),
    inside: sum(lags, (s) => s.made),
    lags: sum(lags, (s) => s.attempts),
  };
}
