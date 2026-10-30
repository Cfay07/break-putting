import { fmtDate } from './format';
import { COND_LABEL, fixParts, SLICE_NEED, sliceSince, ZONE_RANGE, type Cond } from './pinpoint';
import { ZONES } from './practice';
import { isLagZone, type PracticeSet, type Round, type Zone } from './types';
import { TEST_ID } from './weeklyTest';

/**
 * The last step of the loop: rounds name a target, you practice it, and later rounds say whether
 * it moved. Everything is worked out from dates, so there is nothing to lock in and nothing to
 * lose. A round from before the first practice is a before number for good, a surface switch
 * changes nothing, and a target you fixed stays on the list after it stops being a target.
 */
export interface Carry {
  key: string;
  zone: Zone;
  cond: Cond | null;
  label: string;
  started: string;
  before: { made: number; attempts: number };
  since: { made: number; attempts: number };
}

const COND_OF_KIND: Record<string, Cond> = {
  'apex-lr': 'lr',
  'aim-lr': 'lr',
  'firm-lr': 'lr',
  'lag-lr': 'lr',
  'apex-rl': 'rl',
  'aim-rl': 'rl',
  'firm-rl': 'rl',
  'lag-rl': 'rl',
  uphill: 'uphill',
  'lag-up': 'uphill',
  downhill: 'downhill',
  'lag-down': 'downhill',
  double: 'double',
};

const TRACKED: Zone[] = ['short', 'mid', 'long', 'far'];

function zoneAt(d: number): Zone | null {
  return TRACKED.find((z) => d >= ZONE_RANGE[z][0] && d <= ZONE_RANGE[z][1]) ?? null;
}

const zoneLabel = (z: Zone) => (isLagZone(z) ? '16 ft and out' : (ZONES.find((x) => x.key === z)?.label ?? z));

export function carryKey(zone: Zone, cond: Cond | null): string {
  return `${isLagZone(zone) ? 'far' : zone}|${cond ?? ''}`;
}

/** Everything you have practiced, newest first. The weekly test is measuring, not working on it. */
export function carryRows(rounds: Round[], sets: PracticeSet[], family: (id: string) => string = (id) => id): Carry[] {
  const first = new Map<string, { zone: Zone; cond: Cond | null; started: string }>();
  const note = (zone: Zone, cond: Cond | null, date: string) => {
    const key = carryKey(zone, cond);
    const cur = first.get(key);
    if (!cur || date < cur.started) first.set(key, { zone, cond, started: date });
  };
  for (const s of sets) {
    if (s.drill === TEST_ID) continue;
    for (const st of s.stations ?? []) {
      const zone = st.hand ? null : zoneAt(st.d);
      if (zone) note(zone, null, s.date);
    }
    const fix = fixParts(family(s.drill));
    const zone = fix && zoneAt(fix.d);
    if (fix && zone && COND_OF_KIND[fix.kind]) note(zone, COND_OF_KIND[fix.kind], s.date);
  }
  return [...first.entries()]
    .map(([key, { zone, cond, started }]) => {
      const t = sliceSince(rounds, zone, cond, started);
      return {
        key,
        zone,
        cond,
        started,
        label: cond ? `${COND_LABEL[cond]}, ${zoneLabel(zone)}` : zoneLabel(zone),
        before: t.before,
        since: t.after,
      };
    })
    .sort((a, b) => b.started.localeCompare(a.started) || Number(!!b.cond) - Number(!!a.cond) || a.key.localeCompare(b.key));
}

const pct = (t: { made: number; attempts: number }) => Math.round((t.made / t.attempts) * 100);

/** Past chance or not, and never a word about why. A course can get easier on its own. */
export function carryText(c: Pick<Carry, 'started' | 'before' | 'since'>): string {
  const since = `Since you started on ${fmtDate(c.started)}`;
  if (c.since.attempts < SLICE_NEED) {
    return `${since}: ${c.since.attempts} of these on the course, ${SLICE_NEED - c.since.attempts} more to compare.`;
  }
  const now = `${since}: ${pct(c.since)}% of ${c.since.attempts}`;
  if (c.before.attempts < SLICE_NEED) return `${now}. Too few before that to compare.`;
  const p1 = c.before.made / c.before.attempts;
  const p2 = c.since.made / c.since.attempts;
  const margin = 1.96 * Math.sqrt((p1 * (1 - p1)) / c.before.attempts + (p2 * (1 - p2)) / c.since.attempts);
  const read = Math.abs(p2 - p1) <= margin ? 'Within what chance can do.' : p2 > p1 ? 'Up by more than chance.' : 'Down by more than chance.';
  return `${now}, against ${pct(c.before)}% of ${c.before.attempts} before. ${read}`;
}
