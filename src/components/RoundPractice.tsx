import { resolveDrill } from '../lib/drills';
import { signed } from '../lib/format';
import { swingHoles, usual } from '../lib/roundRanks';
import { conversion } from '../lib/situations';
import { BUCKETS, type Stats } from '../lib/stats';
import { FOCUS, startSession, type FocusBand } from '../lib/starters';
import { usePractice } from '../lib/usePractice';
import type { Round } from '../lib/types';
import { RoundPayoff } from './RoundPayoff';

/** Which fifteen-minute session works on a distance band. */
const BAND_FOCUS: Record<string, FocusBand> = {
  tapin: 'short',
  b35: 'short',
  b68: 'mid',
  b915: 'makeable',
  b1630: 'lag',
  b3140: 'lag',
  b4150: 'long',
  b5160: 'long',
  b61: 'long',
};

/**
 * The round, read for practice: where the strokes went by distance, the hole that hurt, what your
 * tags said, and the session that works on the leak, one tap to start.
 */
export function RoundPractice({
  round,
  stats,
  baseline,
}: {
  round: Round;
  stats: Stats;
  baseline: [number, number][];
}) {
  const { state, dispatch, surface } = usePractice();
  const bands = BUCKETS.map((b) => ({ ...b, t: stats.buckets[b.key] })).filter((b) => b.t.attempts > 0);
  const worst = bands.reduce<(typeof bands)[number] | null>((a, b) => (b.t.sg < (a?.t.sg ?? 0) ? b : a), null);
  const best = bands.reduce<(typeof bands)[number] | null>((a, b) => (b.t.sg > (a?.t.sg ?? 0) ? b : a), null);
  const swing = swingHoles(round, baseline);
  const conv = conversion([round]);
  const usualConvert = usual(round, state.rounds, baseline, 'convert');
  const usualSaves = usual(round, state.rounds, baseline, 'saves');
  const focus = worst ? FOCUS.find((f) => f.band === BAND_FOCUS[worst.key]) : undefined;
  const span = Math.max(0.5, ...bands.map((b) => Math.abs(b.t.sg)));

  return (
    <section className="round-practice">
      {worst ? (
        <div className="rp-lead">
          <span className="rp-k">Where it cost you</span>
          <strong>{worst.label}</strong>
          <span>
            {worst.t.makes} of {worst.t.attempts} holed, {signed(worst.t.sg)} strokes against tour averages.
            {best
              ? ` You made it back from ${best.label}: ${best.t.makes} of ${best.t.attempts}, ${signed(best.t.sg)}.`
              : ''}
          </span>
        </div>
      ) : (
        <div className="rp-lead">
          <span className="rp-k">Nothing cost you</span>
          <strong>Every distance at or above tour average</strong>
        </div>
      )}

      <div className="rp-bands" role="img" aria-label="Strokes gained by distance this round">
        {bands.map((b) => (
          <div key={b.key} className="rp-band">
            <span className="rp-band-l">{b.label}</span>
            <span className="rp-band-n num">
              {b.t.makes}/{b.t.attempts}
            </span>
            <span className="rp-band-bar">
              <i
                className={b.t.sg < 0 ? 'neg' : 'pos'}
                style={{
                  width: `${(Math.abs(b.t.sg) / span) * 50}%`,
                  [b.t.sg < 0 ? 'right' : 'left']: '50%',
                }}
              />
            </span>
            <span className={b.t.sg < 0 ? 'rp-band-v num neg' : 'rp-band-v num pos'}>{signed(b.t.sg)}</span>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        Every putt this round by its length: holed of tried, and strokes gained against tour averages.
      </p>

      {(conv.greens > 0 || conv.missed > 0) && (
        <div className="card" style={{ marginTop: 14 }}>
          {conv.greens > 0 && (
            <div className="stat-row">
              <span className="k">Birdies from greens</span>
              <span className="v num">
                {Math.round((conv.birdies / conv.greens) * 100)}%
                <span className="small muted">
                  {' '}
                  · {conv.birdies} of {conv.greens}
                  {usualConvert !== null ? `, usual ${Math.round(usualConvert * 100)}%` : ''}
                </span>
              </span>
            </div>
          )}
          {conv.missed > 0 && (
            <div className="stat-row">
              <span className="k">Pars saved</span>
              <span className="v num">
                {Math.round((conv.saves / conv.missed) * 100)}%
                <span className="small muted">
                  {' '}
                  · {conv.saves} of {conv.missed}
                  {usualSaves !== null ? `, usual ${Math.round(usualSaves * 100)}%` : ''}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {swing && swing.worst.sg < 0 && (
        <p className="rp-hole">
          <b>The hole that hurt:</b> {swing.worst.hole},{' '}
          {swing.worst.putts >= 3 ? `three putts from ${swing.worst.first} ft` : `missed ${swing.worst.first} ft`},{' '}
          <span className="neg">{signed(swing.worst.sg)}</span>.
        </p>
      )}

      <RoundPayoff round={round} />

      {focus && worst && (
        <div className="rp-do">
          <span className="rp-k">Practice this</span>
          <strong>{focus.name}</strong>
          <span>
            {focus.blocks.reduce((n, b) => n + (b.minutes ?? 0), 0)} min ·{' '}
            {focus.blocks
              .map((b) => resolveDrill(state, b.drill)?.name)
              .filter(Boolean)
              .join(', ')}
          </span>
          <button className="btn btn-primary btn-wide" onClick={() => startSession(state, dispatch, focus, surface)}>
            Start
          </button>
        </div>
      )}
    </section>
  );
}
