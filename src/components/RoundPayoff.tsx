import { useMemo } from 'react';
import { carryRows } from '../lib/carry';
import { fmtDate } from '../lib/format';
import { sliceSince, type Cond } from '../lib/pinpoint';
import { useTarget } from '../lib/useTarget';
import { isLagZone, type Zone } from '../lib/types';
import { roundPayoff, type HabitLine } from '../lib/roundPayoff';
import { usePractice } from '../lib/usePractice';
import type { Round } from '../lib/types';

function PatternLine({ tag, h }: { tag: string; h: HabitLine }) {
  return (
    <p>
      <strong>
        {tag}: {h.title}.
      </strong>{' '}
      <span className="muted">
        {h.round && h.total ? `This round: ${h.round}. All rounds so far: ${h.total}.` : h.detail}
      </span>
    </p>
  );
}

/** The reason to tag next time: what these tags just said, and how your practice target played. */
export function RoundPayoff({ round }: { round: Round }) {
  const { state, scoped, surface, family } = usePractice();
  const pay = useMemo(
    () => roundPayoff(round, scoped.rounds, carryRows(scoped.rounds, state.practice, family), surface),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- family only reads state.drills
    [round, scoped.rounds, state.practice, state.drills, surface],
  );
  const target = useTarget();
  if (!round.finished || round.practice) return null;
  const { tags, found, still, lines } = pay;
  // The pinned target replaces the older practice tracking lines, so the page names one plan.
  const [type, zone, cond] = (target.key ?? '').split(':');
  const work = target.key ? [] : pay.work;
  const here =
    type === 'slice' || type === 'zone'
      ? sliceSince([round], zone as Zone, type === 'slice' ? (cond as Cond) : null, '0000').after
      : null;
  const newest = !scoped.rounds.some((r) => r.date > round.date);
  const nudge = !tags.tagged && newest;
  if (!lines.length && !found.length && !still && !work.length && !nudge && !target.key) return null;
  return (
    <>
      <h2>What this round showed</h2>
      <div className="card payoff">
        {target.key && (
          <div className="payoff-target">
            <span className="payoff-eyebrow">Your target{target.setOn ? ` · since ${fmtDate(target.setOn)}` : ''}</span>
            <strong>{target.title}</strong>
            <span className="muted">
              {here && here.attempts
                ? `This round: ${here.made} of ${here.attempts}${isLagZone(zone as Zone) ? ' finished within 3 ft' : ' holed'}.`
                : 'None of these this round.'}
              {target.progress && target.progress.after.attempts < 10
                ? ` ${target.progress.after.attempts} of 10 course putts toward a check.`
                : ''}
            </span>
            <a className="inline-link" href="#/practice">
              Practice it ›
            </a>
          </div>
        )}
        {found.map((h) => (
          <PatternLine key={h.title} tag="New" h={h} />
        ))}
        {still && <PatternLine tag="Still there" h={still} />}
        {work.map((w) => (
          <p key={w.label}>
            <strong>
              {w.label}: {w.made} of {w.attempts} this round.
            </strong>{' '}
            <span className="muted">{w.text}</span>
          </p>
        ))}
        {lines.length > 0 && (
          <p className="muted">
            From the {tags.tagged} of {tags.putts} putts you tagged. {lines.join(' ')}
          </p>
        )}
        {nudge && (
          <p className="muted">
            No tags this round. Next time tag just your misses from 3 to 15 ft, and this is where it tells you why they
            missed.
          </p>
        )}
        {!target.key && (found.length > 0 || still || work.length > 0) && (
          <a className="inline-link" href="#/practice/why">
            What to work on ›
          </a>
        )}
      </div>
    </>
  );
}
