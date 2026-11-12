import { useMemo, useState } from 'react';
import { fmtDate } from '../lib/format';
import { gameHcp, ratingGaps } from '../lib/gameHcp';
import { countingOf, HCP_WINDOW, hcpText, puttingHcp, type HcpRound } from '../lib/puttingHcp';
import type { Round, SavedCourse } from '../lib/types';

type Scale = (h: number) => string;

/** From tour level to 30 by default, stretched to fit either headline number, in steps of 10. */
function scaleFor(values: number[]): { at: Scale; marks: [number, string][] } {
  const lo = Math.min(-6, Math.floor(Math.min(...values) / 2) * 2);
  const hi = Math.max(30, Math.ceil(Math.max(...values) / 10) * 10);
  // A round past either end sits on the edge; its real number is printed beside it.
  const at: Scale = (h) => `${((Math.max(lo, Math.min(hi, h)) - lo) / (hi - lo)) * 100}%`;
  const marks: [number, string][] = [[lo, hcpText(lo).replace('.0', '')]];
  for (let v = 0; v <= hi; v += 10) marks.push([v, String(v)]);
  return { at, marks };
}

function Lane({ r, you, out, at }: { r: HcpRound; you: number; out: boolean; at: Scale }) {
  // A 9+9 is two rounds; open the one that finished it.
  const open = r.id.split('+').pop()!;
  return (
    <a className="hcp-lane" href={`#/round/${open}`}>
      <span className="hcp-date">
        {fmtDate(r.date)}
        {r.nines && <small> 9+9</small>}
        {out && <em> next out</em>}
      </span>
      <span className="hcp-track">
        <i className="hcp-you" style={{ left: at(you) }} />
        <i className="hcp-pt" style={{ left: at(r.hcp) }} />
      </span>
      <b className="num">{hcpText(r.hcp)}</b>
    </a>
  );
}

const SG_EDGE = 6;
const sgAt = (v: number) => `${((Math.max(-SG_EDGE, Math.min(SG_EDGE, v)) + SG_EDGE) / (2 * SG_EDGE)) * 100}%`;
const signed1 = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;

/** A putting round as strokes gained against tour, on its own scale: one round is not a handicap. */
function PuttLane({ r, mean, out }: { r: HcpRound; mean: number; out: boolean }) {
  const open = r.id.split('+').pop()!;
  return (
    <a className="hcp-lane" href={`#/round/${open}`}>
      <span className="hcp-date">
        {fmtDate(r.date)}
        {r.nines && <small> 9+9</small>}
        {out && <em> next out</em>}
      </span>
      <span className="hcp-track">
        <i className="hcp-you" style={{ left: sgAt(mean) }} />
        <i className="hcp-pt" style={{ left: sgAt(r.sg ?? 0) }} />
      </span>
      <b className="num">{signed1(r.sg ?? 0)}</b>
    </a>
  );
}

const SHOWN_PUTTING = 8;

interface Props {
  rounds: Round[];
  /** Every round, unfiltered, so the tee you usually play is known even inside a filter. */
  everyRound: Round[];
  /** Rate a round with no tee off the back tees. */
  backTees: boolean;
  courses: SavedCourse[];
  baseline: [number, number][];
  shoot: number;
  withTour: number;
  scoredRounds: number;
}

export function StandCard({ rounds, everyRound, backTees, courses, baseline, shoot, withTour, scoredRounds }: Props) {
  const putting = useMemo(() => puttingHcp(rounds, baseline), [rounds, baseline]);
  const game = useMemo(() => gameHcp(rounds, courses, everyRound, backTees), [rounds, courses, everyRound, backTees]);
  const gaps = useMemo(
    () => ratingGaps(rounds, courses, everyRound, backTees),
    [rounds, courses, everyRound, backTees],
  );
  const [view, setView] = useState<'putting' | 'game'>('putting');
  const shown = view === 'game' && game ? game : putting;
  const kind = view === 'game' && game ? 'game' : 'putting';
  const counting =
    shown?.rounds.filter((r) => r.counts).sort((a, b) => a.hcp - b.hcp || b.date.localeCompare(a.date)) ?? [];
  const rest = shown ? shown.rounds.length - counting.length : 0;
  const meanSg = putting ? putting.rounds.reduce((a, r) => a + (r.sg ?? 0), 0) / putting.rounds.length : 0;
  const gap = putting && game ? game.hcp - putting.hcp : null;
  // Sized from the two headline numbers, so switching views never moves the line and one
  // freak round cannot squash the rest against an end.
  const { at, marks } = scaleFor([putting, game].flatMap((x) => (x ? [x.hcp] : [])));

  return (
    <div className="hcp-card light">
      <div className="stand-grid">
        <div>
          <span className="pay-eyebrow">You shoot</span>
          <strong className="num">{shoot.toFixed(1)}</strong>
        </div>
        <div>
          <span className="pay-eyebrow">With tour putting</span>
          <strong className="num">{withTour.toFixed(1)}</strong>
        </div>
        <div>
          <span className="pay-eyebrow">Plays to</span>
          <strong className="num">{game ? hcpText(game.hcp) : '–'}</strong>
        </div>
        <div>
          <span className="pay-eyebrow">Putts to</span>
          <strong className="num">{putting ? hcpText(putting.hcp) : '–'}</strong>
        </div>
      </div>

      <p className="hcp-how">
        {shoot > withTour
          ? `A tour pro's putter would save you ${(shoot - withTour).toFixed(1)} a round. `
          : `You putt better than tour, by ${(withTour - shoot).toFixed(1)} a round. `}
        {gap !== null &&
          (Math.abs(gap) < 0.5
            ? 'Your putting is right in line with the rest of your game.'
            : `Your putting plays ${Math.abs(gap).toFixed(1)} ${gap > 0 ? 'better' : 'worse'} than your game.`)}
        {!game && ' Plays to needs five rounds on a rated tee.'}
      </p>

      {(putting || game) && (
        <div
          className="hcp-line2"
          role="img"
          aria-label={`Plays to ${game ? hcpText(game.hcp) : 'not yet'}, putts to ${putting ? hcpText(putting.hcp) : 'not yet'}`}
        >
          <span className="hcp-track">
            {game && <i className="hcp-dot game" style={{ left: at(game.hcp) }} />}
            {putting && <i className="hcp-dot" style={{ left: at(putting.hcp) }} />}
          </span>
          <span className="hcp-axis2">
            {marks.map(([v, label]) => (
              <span key={v} className="hcp-mark" style={{ left: at(v) }}>
                {label}
              </span>
            ))}
          </span>
          <span className="hcp-key">
            <i className="game" /> Plays to <i /> Putts to
          </span>
        </div>
      )}

      {shown && (
        <>
          {game && putting && (
            <div className="seg hcp-seg">
              <button aria-pressed={kind === 'putting'} onClick={() => setView('putting')}>
                Putting rounds
              </button>
              <button aria-pressed={kind === 'game'} onClick={() => setView('game')}>
                Scoring rounds
              </button>
            </div>
          )}
          {kind === 'putting' ? (
            <>
              <div className="hcp-chart putting">
                {[...shown.rounds.slice(0, SHOWN_PUTTING)]
                  .sort((x, y) => (y.sg ?? 0) - (x.sg ?? 0))
                  .map((r) => (
                  <PuttLane key={r.id} r={r} mean={meanSg} out={r.id === shown.nextOut?.id} />
                ))}
                <div className="hcp-lane hcp-axis">
                  <span />
                  <span className="hcp-track">
                    {[-SG_EDGE, 0, SG_EDGE].map((v) => (
                      <span key={v} className="hcp-mark" style={{ left: sgAt(v) }}>
                        {v === 0 ? 'Tour' : signed1(v).replace('.0', '')}
                      </span>
                    ))}
                  </span>
                  <span />
                </div>
              </div>
              <p className="pay-note">
                Strokes gained putting against tour, your newest {Math.min(SHOWN_PUTTING, shown.rounds.length)} of{' '}
                {shown.rounds.length}, best first. All {shown.rounds.length} count. The line is your average, {signed1(meanSg)}.
                {shown.nextOut && ` ${fmtDate(shown.nextOut.date)} is the next round out.`}
              </p>
              <p className="pay-note">
                How it works: Putts to is your average strokes gained putting over your last {HCP_WINDOW} rounds, put
                on the handicap scale. Tour putting is +6.0, and each stroke a round you lose to tour adds 6.0. Every
                round counts, because one round of putting swings too far either way to pick the best ones. Two
                nine-hole rounds make one 9+9. Not an official handicap.
              </p>
            </>
          ) : (
            <>
              <div className="hcp-chart game">
                {counting.map((r) => (
                  <Lane key={r.id} r={r} you={shown.hcp} out={r.id === shown.nextOut?.id} at={at} />
                ))}
              </div>
              <p className="pay-note">
                {shown.rounds.length < HCP_WINDOW
                  ? `You have ${shown.rounds.length} rated rounds, so your best ${shown.counting} count (40%), shown above. At ${HCP_WINDOW} it becomes your best ${countingOf(HCP_WINDOW)}.`
                  : `Your best ${shown.counting} of your last ${shown.rounds.length}, shown above.`}
                {rest > 0 && ` The other ${rest} were worse and don't count.`}
                {shown.nextOut && !shown.nextOut.counts && ` ${fmtDate(shown.nextOut.date)} is the next round out.`}
                {gaps.guessed > 0 &&
                  ` ${gaps.guessed} imported ${gaps.guessed === 1 ? "round didn't" : "rounds didn't"} say the tee, so ${gaps.guessed === 1 ? 'it uses' : 'they use'} ${backTees ? 'the back tees' : 'the one closest to the yardage you usually play'}.`}
                {gaps.unrated > 0 &&
                  ` ${gaps.unrated} ${gaps.unrated === 1 ? 'round is' : 'rounds are'} on a course with no published rating yet.`}
              </p>
              <p className="pay-note">
                How it works: each round is (113 / slope) x (score minus course rating), off the tee you played. Plays to
                is the average of your best {countingOf(HCP_WINDOW)} of your last {HCP_WINDOW} rounds, or your best 40%
                until you have {HCP_WINDOW}. Two nine-hole rounds make one 9+9. Scoring average over {scoredRounds}{' '}
                rounds. Not an official handicap.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
