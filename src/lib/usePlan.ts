import { useMemo } from 'react';
import { fitToRoom, type Fitted } from './drills';
import { carryKey, carryRows, carryText } from './carry';
import { habitsOf } from './habits';
import { fixDrill, fixFor, pinpoint, practiceFix, practicePattern, sliceSince, type Slice } from './pinpoint';
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
  const carry = carryRows(scoped.rounds, sets, p.family);

  // The slow loop: inside a zone, which kind of putt is behind it, and how that kind has gone on
  // the course since you started on its fix.
  const whyOf = (zone: ZoneRead): WhyItem[] =>
    pinpoint(scoped.rounds, state.baseline, zone.zone).map((slice) => {
      const fixId = fixFor(slice.cond, slice.lean?.lean ?? null, slice.d, surface);
      const fix = fitToRoom(fixDrill(fixId)!, room);
      // A fix whose kind says nothing about the putt, like going past the hole, starts the clock too.
      const row = carry.find((c) => c.key === carryKey(zone.zone, slice.cond));
      const own = sets.filter((x) => x.drill === fixId).map((x) => x.date).sort()[0];
      const started = [row?.started, own].filter((x): x is string => !!x).sort()[0];
      const track = started
        ? (() => {
            const t = sliceSince(scoped.rounds, zone.zone, slice.cond, started);
            return carryText({ started, before: t.before, since: t.after });
          })()
        : null;
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

  const zoneTrack = (zone: ZoneRead) => {
    const row = carry.find((c) => c.key === carryKey(zone.zone, null));
    return row ? carryText(row) : null;
  };

  return { ...p, focus, worst, whyOf, zoneTrack, carry, habits, pattern, patternFix, scope, lastRound };
}
