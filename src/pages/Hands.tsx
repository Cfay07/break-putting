import { handGap, handLink, handsOf, HAND_NEED, LINK_WEEKS } from '../lib/hands';
import type { Tally2 } from '../lib/practice';
import { usePractice } from '../lib/usePractice';
import type { Hand } from '../lib/types';

const pct = (t: Tally2) => Math.round((t.made / t.attempts) * 100);
const cell = (t: Tally2) => (t.attempts ? `${pct(t)}%` : '');
const HAND_WORD: Record<Hand, string> = { left: 'Left hand', right: 'Right hand' };

/**
 * One hand at a time, against two hands and against the course, at the distances the
 * one-handed putts were rolled from.
 */
export function Hands() {
  const { state, scoped } = usePractice();
  const { rows, total } = handsOf(state.practice, scoped.rounds);
  const gap = handGap(total.left, total.right);
  const main: Hand = total.left.attempts >= total.right.attempts ? 'left' : 'right';
  const link = handLink(state.practice, scoped.rounds, main);

  const lines: { k: string; t: Tally2 }[] = [
    { k: 'Left hand', t: total.left },
    { k: 'Right hand', t: total.right },
    { k: 'Both hands, same distances', t: total.both },
    { k: 'Rounds, same distances', t: total.play },
  ].filter((l) => l.t.attempts > 0);

  return (
    <div>
      <div className="page-top">
        <a href="#/practice" className="back-link">
          Practice
        </a>
      </div>
      <h1 className="page-title">One hand at a time</h1>
      {!rows.length ? (
        <p className="small muted">No one-handed putts logged yet.</p>
      ) : (
        <>
          <h2>Holed</h2>
          {lines.map((l) => (
            <div key={l.k} className="stat-row">
              <span className="k">{l.k}</span>
              <span className="v num">
                {pct(l.t)}% <span className="small muted">of {l.t.attempts}</span>
              </span>
            </div>
          ))}

          {gap.verdict !== 'waiting' && (
            <div className={`card trend-read ${gap.verdict === 'even' ? 'flat' : 'up'}`}>
              <strong>
                {gap.verdict === 'even'
                  ? 'No clear difference between your hands'
                  : `${HAND_WORD[gap.verdict]} is ${Math.round(Math.abs(gap.diff))} points better`}
              </strong>
              <span className="small muted">
                {gap.verdict === 'even'
                  ? `The gap is inside the ±${Math.round(gap.margin)} points chance alone moves it.`
                  : `Bigger than the ±${Math.round(gap.margin)} points chance alone moves it.`}
              </span>
            </div>
          )}
          {gap.verdict === 'waiting' && total.left.attempts > 0 && total.right.attempts > 0 && (
            <p className="small muted">
              Comparing the hands takes {HAND_NEED} balls each: {total.left.attempts} left, {total.right.attempts} right so far.
            </p>
          )}

          <h2>By distance</h2>
          <div className="table-wrap">
            <table className="hands-table">
              <thead>
                <tr>
                  <th />
                  <th>Left</th>
                  <th>Right</th>
                  <th>Both</th>
                  <th>Rounds</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.d}>
                    <td>{r.d} ft</td>
                    {[r.left, r.right, r.both, r.play].map((t, i) => (
                      <td key={i} className="num">
                        {cell(t)}
                        {t.attempts > 0 && <span className="hands-n">{t.attempts}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>With your game</h2>
          {link.r === null ? (
            <p className="small muted">
              Lining your {main} hand up with your rounds takes weeks with both in them: at least 10 one-hand balls
              and 10 course putts from 3 to 8 ft. {link.weeks} of {LINK_WEEKS} so far.
            </p>
          ) : (
            <div className="card trend-read flat">
              <strong>
                {Math.abs(link.r) < 0.3
                  ? `Your ${main} hand and your short putts on the course barely move together`
                  : link.r > 0
                    ? `Good ${main}-hand weeks go with good weeks on the course`
                    : `Good ${main}-hand weeks go with worse weeks on the course`}
              </strong>
              <span className="small muted">
                r = {link.r.toFixed(2)} over {link.weeks} weeks. That says they move together, not that one causes the
                other: a week you putt well is a week you putt well with everything.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
