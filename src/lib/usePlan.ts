import { useMemo } from 'react';
import { fitToRoom, type Fitted } from './drills';
import { fmtDate } from './format';
import { habitsOf } from './habits';
import { fixDrill, fixFor, pinpoint, practiceFix, practicePattern, SLICE_NEED, sliceSince, type Slice } from './pinpoint';
import { focusOf, type ZoneRead } from './practice';
import { putterName } from './store';
import { usePractice } from './usePractice';

export interface WhyItem {
  slice: Slice;
  fix: Fitted;
  track: string | null;
}

/** Everything the Practice tab and its Why page read: the leak, what is behind it, and the habits. */
export function usePlan() {
  const p = usePractice();
  const { state, surface, room, putterId, scoped } = p;
  const sets = state.practice;

  const focus = useMemo(() => focusOf(state.rounds, state.baseline, putterId), [state.rounds, state.baseline, putterId]);
  const worst = focus.zones.find((z) => z.zone === focus.worst) ?? null;

  // The slow loop: inside a zone, which kind of putt is behind it, and how that kind has gone on
  // the course since you started on its fix.
  const whyOf = (zone: ZoneRead): WhyItem[] =>
    pinpoint(scoped.rounds, state.baseline, zone.zone).map((slice) => {
      const fixId = fixFor(slice.cond, slice.lean?.lean ?? null, slice.d, surface);
      const fix = fitToRoom(fixDrill(fixId)!, room);
      const started = sets.filter((x) => x.drill === fixId).map((x) => x.date).sort()[0];
      let track: string | null = null;
      if (started) {
        const t = sliceSince(scoped.rounds, zone.zone, slice.cond, started);
        const pct = (x: { made: number; attempts: number }) => Math.round((x.made / x.attempts) * 100);
        track =
          t.after.attempts >= SLICE_NEED && t.before.attempts
            ? `On the course since you started it on ${fmtDate(started)}: ${pct(t.after)}% of ${t.after.attempts}, against ${pct(t.before)}% before.`
            : `Started on ${fmtDate(started)}. ${t.after.attempts} of these putts on the course since, short of the ${SLICE_NEED} it takes to compare.`;
      }
      return { slice, fix, track };
    });

  // Habits that are not about a distance: reads, start line, lips, strike, decel, bleed.
  const habits = useMemo(() => habitsOf(scoped.rounds, surface).slice(0, 3), [scoped.rounds, surface]);
  // The fast loop: your own practice misses, no round needed.
  const pattern = practicePattern(sets);
  const patternFix = pattern ? fitToRoom(fixDrill(practiceFix(pattern))!, room) : null;

  const recentWord = focus.allRounds > focus.rounds ? `last ${focus.rounds}` : `${focus.rounds}`;
  const scope =
    focus.putterOnly && putterId ? `your ${recentWord} rounds with the ${putterName(state, putterId)}` : `your ${recentWord} rounds`;
  const lastRound = state.rounds.filter((r) => r.finished).reduce<string | null>((m, r) => (!m || r.date > m ? r.date : m), null);

  return { ...p, focus, worst, whyOf, habits, pattern, patternFix, scope, lastRound };
}
