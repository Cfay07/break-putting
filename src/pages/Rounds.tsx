import { useMemo, useState } from 'react';
import { ConfirmButton } from '../components/ConfirmButton';
import { CoursePicker, type CourseChoice } from '../components/CoursePicker';
import { PutterTag } from '../components/PutterTag';
import { Sheet } from '../components/Sheet';
import { fmtDate, signed, today } from '../lib/format';
import { go } from '../lib/router';
import { courseLabel, roundScale, roundStats } from '../lib/stats';
import { newId } from '../lib/storage';
import { liveRound, makeRound, useApp } from '../lib/store';

const SORTS = ['recent', 'best', 'worst'] as const;
type Sort = (typeof SORTS)[number];
const SORT_LABELS: Record<Sort, string> = { recent: 'Recent', best: 'Best', worst: 'Worst' };

export function Rounds() {
  const { state, dispatch } = useApp();
  const live = liveRound(state);
  const [sort, setSort] = useState<Sort>('recent');
  const finished = useMemo(() => {
    const rows = state.rounds
      .filter((r) => r.finished)
      .map((r) => ({ round: r, stats: roundStats(r, state.baseline) }));
    rows.sort((a, b) => b.round.date.localeCompare(a.round.date));
    if (sort !== 'recent') {
      // Nine-hole rounds double, so a tidy nine cannot outrank a good eighteen on volume alone.
      // The sort is stable, so rounds that tie stay in date order.
      const sg = (x: (typeof rows)[number]) => x.stats.sg * roundScale(x.round);
      const dir = sort === 'best' ? -1 : 1;
      rows.sort((a, b) => (sg(a) - sg(b)) * dir);
    }
    return rows;
  }, [state.rounds, state.baseline, sort]);
  const usable = state.putters.filter((p) => !p.retired);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [date, setDate] = useState(today);
  const [choice, setChoice] = useState<CourseChoice>({ name: '' });
  const [half, setHalf] = useState<'front' | 'back'>('front');
  const [holeCount, setHoleCount] = useState(18);
  const [putterId, setPutterId] = useState(usable.find((p) => p.active)?.id ?? usable[0]?.id ?? '');
  const [newPutter, setNewPutter] = useState('');

  const teeNines = choice.tee?.includes('/') ? choice.tee.split('/').map((n) => n.trim()) : null;
  const parsForRound =
    choice.pars && holeCount === 9 && choice.pars.length > 9
      ? half === 'back'
        ? choice.pars.slice(9, 18)
        : choice.pars.slice(0, 9)
      : choice.pars;
  // The saved tee already carries the nine names, so there is nothing to type in by hand.
  const nineNames =
    holeCount === 9
      ? { first: teeNines ? teeNines[half === 'back' ? 1 : 0] : '', second: '' }
      : { first: teeNines ? teeNines[0] : '', second: teeNines ? teeNines[1] : '' };

  const start = () => {
    let id = putterId;
    if (!usable.length) {
      if (!newPutter.trim()) return;
      id = newId();
      dispatch({ t: 'addPutter', id, name: newPutter });
    }
    if (!id) return;
    dispatch({
      t: 'newRound',
      round: {
        ...makeRound({
          date,
          course: choice.name,
          putterId: id,
          holeCount,
          pars: parsForRound,
        }),
        courseId: choice.courseId,
        tee: choice.tee,
        firstNine: nineNames.first.trim() || undefined,
        secondNine: nineNames.second.trim() || undefined,
      },
    });
    setOpen(false);
    setChoice({ name: '' });
    setNewPutter('');
    go('/track');
  };

  return (
    <>
      {live && (
        <div className="card card-live">
          <span className="tiny">Round in progress</span>
          <h3 style={{ marginTop: 4 }}>
            {live.course || fmtDate(live.date)} · hole {state.track.hole}
            {state.track.phase === 'tags' ? ', tagging a miss' : `, putt ${
              (live.holes.find((h) => h.hole === state.track.hole)?.putts.length ?? 0) + 1
            }`}
          </h3>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={() => go('/track')}>
              Continue
            </button>
            <ConfirmButton
              className="btn btn-ghost btn-danger"
              style={{ flex: '0 0 auto' }}
              label="Discard"
              confirmLabel="Tap again to discard"
              onConfirm={() => dispatch({ t: 'deleteRound', id: live.id })}
            />
          </div>
        </div>
      )}

      {!live && (
        <button className="btn btn-primary btn-wide" onClick={() => setOpen(true)}>
          New round
        </button>
      )}

      <div className="list-head">
        <h2>Rounds</h2>
        {finished.length >= 3 && (
          <div className="sort-pick">
            {SORTS.map((o) => (
              <button key={o} type="button" aria-pressed={sort === o} onClick={() => setSort(o)}>
                {SORT_LABELS[o]}
              </button>
            ))}
          </div>
        )}
      </div>
      {finished.length === 0 && (
        <div className="empty">
          <p style={{ margin: 0 }}>No finished rounds yet. Log one and the stats fill in.</p>
        </div>
      )}

      {(showAll ? finished : finished.slice(0, 20)).map(({ round: r, stats: s }) => (
        <button key={r.id} className="round-row" onClick={() => go(`/round/${r.id}`)}>
          <div className="round-head">
            <span className="round-date">{fmtDate(r.date)}</span>
            <PutterTag putterId={r.putterId} />
          </div>
          {r.course && (
            <span className="small muted" style={{ display: 'block', marginTop: 2 }}>
              {courseLabel(r)}
            </span>
          )}
          <div className="metrics num">
            <span className="metric">
              <span className="tiny">Putts</span>
              <span className="val">{s.totalPutts}</span>
            </span>
            <span className="metric">
              <span className="tiny">3-putts</span>
              <span className={s.threePlus ? 'val neg' : 'val'}>{s.threePlus}</span>
            </span>
            <span className="metric">
              <span className="tiny">SG</span>
              <span className={s.sg >= 0 ? 'val pos' : 'val neg'}>{signed(s.sg, 2)}</span>
            </span>
            <span className="metric">
              <span className="tiny">Score</span>
              <span className="val">{r.score ?? '--'}</span>
            </span>
          </div>
        </button>
      ))}

      {finished.length > 20 && !showAll && (
        <button className="btn btn-ghost btn-wide" onClick={() => setShowAll(true)}>
          Show all {finished.length} rounds
        </button>
      )}

      {open && (
        <Sheet title="New round" onClose={() => setOpen(false)}>
          <div className="field-label">Date</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          <CoursePicker holeCount={holeCount} value={choice} onChange={setChoice} />

          <div className="field-label">Holes</div>
          <div className="seg">
            {[18, 9].map((n) => (
              <button key={n} type="button" aria-pressed={holeCount === n} onClick={() => setHoleCount(n)}>
                {n}
              </button>
            ))}
          </div>

          {holeCount === 9 && (choice.pars?.length ?? 0) > 9 && (
            <>
              <div className="field-label">Which nine</div>
              <div className="seg">
                {(['front', 'back'] as const).map((h) => (
                  <button key={h} type="button" aria-pressed={half === h} onClick={() => setHalf(h)}>
                    {h === 'front' ? 'Front' : 'Back'}
                    {teeNines ? ` · ${teeNines[h === 'back' ? 1 : 0]}` : ''}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="field-label">Putter</div>
          {usable.length ? (
            <div className="chips">
              {usable.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={putterId === p.id ? 'chip chip-sel' : 'chip'}
                  onClick={() => setPutterId(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          ) : (
            <>
              <input
                type="text"
                value={newPutter}
                onChange={(e) => setNewPutter(e.target.value)}
                placeholder="Scotty Cameron, L.A.B. DF3, whatever is in the bag"
              />
              <p className="small muted" style={{ margin: '6px 0 0' }}>
                Name your putter once and it is remembered. This is the only thing needed to start.
              </p>
            </>
          )}

          <button
            className="btn btn-primary btn-wide"
            style={{ marginTop: 18 }}
            onClick={start}
            disabled={usable.length ? !putterId : !newPutter.trim()}
          >
            Start tracking
          </button>
        </Sheet>
      )}
    </>
  );
}
