import { pressureOf, spotVsMixed, SPOT_NEED, missBands, type SpotTally } from '../lib/practiceReview';
import { resolveDrill } from '../lib/drills';
import { usePractice } from '../lib/usePractice';
import { SURFACE_LABELS, type MissDir, type Surface } from '../lib/types';
import { DIR_MEANS } from '../pages/PracticeWhy';

const SURFACES: Surface[] = ['indoor', 'green'];
const pct = (made: number, of: number) => Math.round((made / of) * 100);

function SpotRow({ k, t }: { k: string; t: SpotTally }) {
  return (
    <div className="stat-row">
      <span className="k">{k}</span>
      <span className="v num">
        {pct(t.made, t.attempts)}% of {t.attempts}
        <span className="small muted"> · scratch {pct(t.scratch, t.attempts)}%</span>
      </span>
    </div>
  );
}

/** The same putt over and over flatters you. The mixed number is the one the course sees. */
export function SpotVsMixed() {
  const { state } = usePractice();
  const blocks = SURFACES.map((s) => ({ s, ...spotVsMixed(state.practice, state.practiceRounds ?? [], s, state.baseline) })).filter(
    (b) => b.same.attempts >= SPOT_NEED && b.mixed.attempts >= SPOT_NEED,
  );
  if (!blocks.length) return null;
  return (
    <>
      <h2>Same spot against mixed</h2>
      {blocks.map((b) => (
        <div key={b.s}>
          {blocks.length > 1 && <p className="small muted">{SURFACE_LABELS[b.s]}</p>}
          <SpotRow k="Same putt, again and again" t={b.same} />
          <SpotRow k="A new putt every ball" t={b.mixed} />
        </div>
      ))}
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        Putts from 3 to 10 ft. Scratch is what a scratch golfer holes from the same putts, so a mix of distances is a
        fair fight. Mixed means the weekly test and practice rounds, and it is the one the course sees.
      </p>
    </>
  );
}

const DIR_ORDER: MissDir[] = ['left', 'right', 'short', 'long'];
const DIR_LABEL: Record<MissDir, string> = { left: 'Left', right: 'Right', short: 'Short', long: 'Long' };

/** Every tagged practice miss, by distance, so you can see the habit instead of being told it. */
export function MissBandsCard() {
  const { state } = usePractice();
  const blocks = SURFACES.flatMap((s) => missBands(state.practice, s).map((b) => ({ s, b })));
  if (!blocks.length) return null;
  return (
    <>
      <h2>How you miss in practice</h2>
      {blocks.map(({ s, b }) => {
        const top = DIR_ORDER.reduce((a, d) => (b.dirs[d] > b.dirs[a] ? d : a), DIR_ORDER[0]);
        return (
          <div key={s + b.label} className="card miss-card">
            <strong>
              {b.label}, {SURFACE_LABELS[s].toLowerCase()}
            </strong>
            {DIR_ORDER.map((d) => (
              <div key={d} className="miss-bar">
                <span>{DIR_LABEL[d]}</span>
                <span className="miss-track">
                  <i style={{ width: `${(b.dirs[d] / b.total) * 100}%` }} className={d === top ? 'top' : undefined} />
                </span>
                <span className="num">{b.dirs[d]}</span>
              </div>
            ))}
            <p className="small muted" style={{ margin: '8px 0 0' }}>
              From the {b.total} misses you tagged.
              {b.dirs[top] * 2 > b.total ? ` More than half went ${top}. ${DIR_MEANS[top]}` : ''}
            </p>
          </div>
        );
      })}
    </>
  );
}

/** In-a-row drills: the practice where a miss costs you something. */
export function PressureCard() {
  const { state } = usePractice();
  const p = pressureOf(state.practice, (id) => resolveDrill(state, id));
  if (p.streaks < 3 || !p.best) return null;
  return (
    <>
      <h2>When a miss costs the run</h2>
      {p.tried > 0 && (
        <div className="stat-row">
          <span className="k">In-a-row drills finished</span>
          <span className="v num">
            {p.finished} of {p.tried}
          </span>
        </div>
      )}
      <div className="stat-row">
        <span className="k">
          Longest run{p.best.d ? `, ${p.best.d} ft` : ''}
          <span className="small muted"> · {p.best.drill}</span>
        </span>
        <span className="v num">{p.best.run}</span>
      </div>
    </>
  );
}
