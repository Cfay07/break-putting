import { useEffect } from 'react';
import { drillsNear, fitToRoom, type Fitted } from './drills';
import { fmtDate, today } from './format';
import { COND_LABEL, fixDrill, fixFor, sliceSince, type Cond } from './pinpoint';
import { LEAN_TEXT, type ZoneRead } from './practice';
import { digitsFor } from './sample';
import { daysBetween, STALE_DAYS, targetKind, type TargetKind } from './target';
import { isLagZone, SURFACE_LABELS, type PinnedTarget } from './types';
import { usePlan, type WhyItem } from './usePlan';
import { nextTestDay, testParts, testStatus } from './weeklyTest';
import { DIR_MEANS } from '../pages/PracticeWhy';

/** The session the target builds, kept under one id so starting it again replaces it. */
export const TARGET_SESSION = 'target-session';

/** Course putts on the target since it was set, before it can say whether you are holing more. */
export const CHECK_AFTER = 10;

const unique = (ds: (Fitted | null | undefined)[]): Fitted[] => {
  const seen = new Set<string>();
  return ds.filter((d): d is Fitted => !!d && !seen.has(d.id) && !!seen.add(d.id));
};

interface Pick {
  kind: TargetKind;
  zone: ZoneRead | null;
  item: WhyItem | null;
  /** A pinned slice the newest rounds no longer flag. It stays the target until the course says fixed. */
  cond: Cond | null;
}

export interface TargetProgress {
  before: { made: number; attempts: number };
  after: { made: number; attempts: number };
  /** Holing more since it was set, past chance. */
  fixed: boolean;
}

/** One-sided two-proportion test at 95%: the after rate beats the before rate past chance. */
export function beatsBefore(b: { made: number; attempts: number }, a: { made: number; attempts: number }): boolean {
  if (a.attempts < CHECK_AFTER || b.attempts < CHECK_AFTER) return false;
  const p1 = b.made / b.attempts;
  const p2 = a.made / a.attempts;
  const pooled = (b.made + a.made) / (b.attempts + a.attempts);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / b.attempts + 1 / a.attempts));
  return se > 0 && (p2 - p1) / se >= 1.645;
}

/**
 * The target, everywhere it shows. It is worked out from your recent rounds once, pinned on that
 * day, and kept until the course says it is fixed, so the round page and Practice never disagree
 * and the plan does not move under you between sessions.
 */
export function useTarget() {
  const plan = usePlan();
  const { state, dispatch, surface, room, drills, fitted, focus, worst, whyOf, zoneTrack, habits, pattern, patternFix, scope, lastRound, scoped } =
    plan;
  const date = today();
  const done = new Set((state.targetsDone ?? []).map((t) => t.key));
  const test = testStatus(state.practice, surface, room, date);

  const keyOf = (p: Pick): string | null =>
    p.kind === 'slice' && p.zone && (p.item || p.cond)
      ? `slice:${p.zone.zone}:${p.item?.slice.cond ?? p.cond}`
      : p.kind === 'zone' && p.zone
        ? `zone:${p.zone.zone}`
        : p.kind === 'habit' && habits[0]
          ? `habit:${habits[0].title}`
          : null;

  // What the rounds point at today, skipping anything you already fixed.
  const candidate = (): Pick => {
    const why = worst ? whyOf(worst).filter((w) => !done.has(`slice:${worst.zone}:${w.slice.cond}`)) : [];
    const zoneOpen = worst && !done.has(`zone:${worst.zone}`) ? worst : null;
    const kind = targetKind({
      zone: zoneOpen ?? (why.length ? worst : null),
      slice: why[0]?.slice ?? null,
      habit: habits.find((h) => !done.has(`habit:${h.title}`)) ?? null,
      pattern,
      lastRound,
      today: date,
    });
    return { kind, zone: worst, item: why[0] ?? null, cond: null };
  };

  const resolve = (pin: PinnedTarget | undefined): Pick | null => {
    if (!pin || pin.fixedOn) return null;
    const [type, a, b] = pin.key.split(':');
    if (type === 'slice' || type === 'zone') {
      const zone = focus.zones.find((z) => z.zone === a);
      if (!zone) return null;
      if (type === 'zone') return { kind: 'zone', zone, item: null, cond: null };
      const item = whyOf(zone).find((w) => w.slice.cond === b) ?? null;
      return { kind: 'slice', zone, item, cond: b as Cond };
    }
    if (type === 'habit' && habits.some((h) => h.title === pin.key.slice(6))) return { kind: 'habit', zone: null, item: null, cond: null };
    return null;
  };

  const pinned = resolve(state.target);
  const pick = pinned ?? candidate();
  const key = keyOf(pick);

  // Pin the first target, and a new one once the old one cannot be read any more.
  const pinTitle = (() => {
    if (pick.kind === 'slice' && pick.zone) {
      const c = pick.item?.slice.cond ?? pick.cond!;
      return `${COND_LABEL[c]}, ${isLagZone(pick.zone.zone) ? '16 ft and out' : pick.zone.label}`;
    }
    if (pick.kind === 'zone' && pick.zone) return pick.zone.label;
    if (pick.kind === 'habit' && habits[0]) return habits[0].title;
    return '';
  })();
  useEffect(() => {
    if (!pinned && key && key !== state.target?.key) dispatch({ t: 'setTarget', target: { key, title: pinTitle, setOn: date } });
  }, [pinned, key, pinTitle, date, dispatch, state.target?.key]);

  const setOn = pinned ? state.target!.setOn : date;
  const stale = !lastRound || daysBetween(lastRound, date) > STALE_DAYS;
  const pct = (n: number, of: number) => Math.round((n / of) * 100);
  const fromPractice =
    pattern && pick.kind !== 'practice'
      ? `In practice, ${pattern.n} of your last ${pattern.of} tagged misses from ${pattern.band} went ${pattern.dir}.`
      : null;

  let title = pinTitle;
  const lines: string[] = [];
  let picks: Fitted[] = [];
  let progress: TargetProgress | null = null;
  const tz = pick.zone;
  const zoneDrills = tz ? drillsNear(drills, tz.zone, tz.lean?.lean ?? null, surface, room) : [];

  if (pick.kind === 'slice' && tz) {
    const cond = pick.item?.slice.cond ?? pick.cond!;
    const lag = isLagZone(tz.zone);
    const s = pick.item?.slice;
    if (s) {
      lines.push(
        `${s.made} of ${s.attempts} ${lag ? 'finished within 3 ft' : 'holed'} in ${scope}, against ${pct(s.restMade, s.restAttempts)}% on your other tagged putts from there.`,
      );
      if (s.lean) lines.push(`${s.lean.n} of ${s.lean.of} tagged misses ${LEAN_TEXT[s.lean.lean]}.`);
    }
    const t = sliceSince(scoped.rounds, tz.zone, cond, setOn);
    progress = { ...t, fixed: beatsBefore(t.before, t.after) };
    const fix = pick.item?.fix ?? fitToRoom(fixDrill(fixFor(cond, null, tz.zone === 'short' ? 4 : 8, surface))!, room);
    picks = unique([fix, fromPractice ? patternFix : null, ...zoneDrills]);
  } else if (pick.kind === 'zone' && tz) {
    title = tz.label;
    const costs = Math.abs(tz.sgPerRound).toFixed(digitsFor(tz.sample));
    const cost = Number(costs) ? `It costs ${costs} strokes a round.` : '';
    lines.push(
      isLagZone(tz.zone)
        ? `${tz.leave !== null ? `You leave it ${tz.leave.toFixed(1)} ft away on average, with` : 'You have'} ${tz.threePutts} three-putts in ${tz.firstPutts}, in ${scope}. ${cost}`
        : `${tz.makes} of ${tz.attempts} holed in ${scope}, where a scratch golfer makes ${pct(tz.scratchMakes, tz.attempts)}%. ${cost}`,
    );
    if (tz.lean) {
      const read = tz.lean.lean === 'high' || tz.lean.lean === 'low';
      lines.push(
        `${tz.lean.n} of ${tz.lean.of} tagged misses from there ${LEAN_TEXT[tz.lean.lean]}.` +
          (read && surface === 'indoor' ? ' A flat spot cannot train the read. On a putt with real slope, switch to Green.' : ''),
      );
    }
    const t = sliceSince(scoped.rounds, tz.zone, null, setOn);
    progress = { ...t, fixed: beatsBefore(t.before, t.after) };
    const track = zoneTrack(tz);
    if (track) lines.push(track);
    picks = unique([zoneDrills[0], fromPractice ? patternFix : null, ...zoneDrills.slice(1)]);
  } else if (pick.kind === 'habit') {
    const h = habits[0];
    title = h.title;
    lines.push(h.detail);
    picks = unique([fitted(h.fix), fromPractice ? patternFix : null]);
  } else if (pick.kind === 'practice' && pattern) {
    title = `${pattern.band}, ${SURFACE_LABELS[pattern.surface].toLowerCase()}`;
    lines.push(`${pattern.n} of your last ${pattern.of} tagged misses went ${pattern.dir}. ${DIR_MEANS[pattern.dir]}`);
    if (lastRound && stale) {
      lines.push(`Your last round was ${fmtDate(lastRound)}, so this comes from your practice. New rounds take it back.`);
    }
    picks = unique([patternFix]);
  } else if (test.thisWeek) {
    const t = testParts(test.thisWeek, state.baseline);
    title = `This week's test: ${test.thisWeek.made} of ${test.thisWeek.attempts}`;
    lines.push(
      `Holed ${t.holed} of ${t.of}, where a scratch golfer averages ${t.scratch.toFixed(1)}. ${t.inside} of ${t.lags} lag putts finished close.`,
    );
    lines.push(`The next one opens ${fmtDate(nextTestDay(date))}. Until then, mix these in.`);
    const short = drillsNear(drills, 'mid', null, surface, room)[0];
    const long = drillsNear(drills, 'far', null, surface, room)[0];
    picks = unique(t.holed < t.scratch ? [short, long] : [long, short]);
  } else {
    title = 'Take the weekly test';
    lines.push(
      !focus.rounds
        ? 'Eighteen putts, about six minutes, no rounds needed. Your rounds name a target once there are enough of them, and until then this is the number that shows you getting better.'
        : worst && worst.sgPerRound >= 0
          ? `You beat scratch from every distance in ${scope}. The test is how you keep it that way week to week.`
          : `${focus.rounds} ${focus.rounds === 1 ? 'round' : 'rounds'} in, too few putts from any one distance to name a target yet. Eighteen putts, about six minutes, and it is the number to beat every week.`,
    );
  }
  if (fromPractice && pick.kind !== 'test') lines.push(fromPractice);
  const habitFix = habits[0] ? fitted(habits[0].fix) : null;
  if ((pick.kind === 'zone' || pick.kind === 'slice') && picks.length < 2 && habitFix && !picks.some((d) => d.id === habitFix.id)) {
    lines.push(habits[0].detail);
    picks.push(habitFix);
  }
  picks = picks.slice(0, 2);
  // The scored check at the end of a session: a plain count drill from the target's distance.
  const check = zoneDrills.find((d) => d.scoring === 'count' && !picks.some((p) => p.id === d.id)) ?? null;

  const markFixed = () => {
    if (!state.target) return;
    const closed = { ...state.target, fixedOn: date };
    dispatch({ t: 'closeTarget', target: closed });
  };

  return {
    plan,
    test,
    kind: pick.kind,
    key,
    title,
    lines,
    picks,
    check: pick.kind === 'slice' || pick.kind === 'zone' ? check : null,
    setOn: key ? setOn : null,
    progress,
    markFixed,
    testIsTarget: pick.kind === 'test',
    hasWhy: focus.rounds > 0 || habits.length > 0 || !!pattern,
  };
}
