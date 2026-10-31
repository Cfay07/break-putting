import { useMemo } from 'react';
import { carryRows } from '../lib/carry';
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
  if (!round.finished || round.practice) return null;
  const { tags, found, still, lines, work } = pay;
  const newest = !scoped.rounds.some((r) => r.date > round.date);
  const nudge = !tags.tagged && newest;
  if (!lines.length && !found.length && !still && !work.length && !nudge) return null;
  return (
    <>
      <h2>What this round showed</h2>
      <div className="card payoff">
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
        {(found.length > 0 || still || work.length > 0) && (
          <a className="inline-link" href="#/practice/why">
            What to work on ›
          </a>
        )}
      </div>
    </>
  );
}
