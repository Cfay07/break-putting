import { useMemo, useState } from 'react';
import { ConfirmButton } from '../components/ConfirmButton';
import { CoursePicker, type CourseChoice } from '../components/CoursePicker';
import { PutterTag } from '../components/PutterTag';
import { Sheet } from '../components/Sheet';
import { fmtDate, signed, today } from '../lib/format';
import { go } from '../lib/router';
import { GreenSpeedPick } from '../components/GreenSpeedPick';
import { Conditions } from '../components/Conditions';
import { currentSession } from '../lib/cloud';
import { bleedsIn } from '../lib/bleed';
import { formOf, formBand } from '../lib/form';
import { courseLabel, roundScale, roundStats } from '../lib/stats';
import type { GreenSpeed } from '../lib/types';
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
      .map((r) => ({
        round: r,
        stats: roundStats(r, state.baseline),
        // Two numbers, because a mistake that cost nothing is not the same as no mistake and
        // the card could not tell them apart when it only counted shots.
        mistakes: bleedsIn(r).length,
        bled: bleedsIn(r).reduce((n, b) => n + b.shots, 0),
        form: formOf(r, state.baseline),
      }));
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
  const [competitive, setCompetitive] = useState(false);
  const [greenSpeed, setGreenSpeed] = useState<GreenSpeed | undefined>();
  const [aerated, setAerated] = useState<boolean | undefined>();
  const [bumpy, setBumpy] = useState<number | undefined>();
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
        competitive: competitive || undefined,
        greenSpeed,
        aerated,
        bumpy,
        firstNine: nineNames.first.trim() || undefined,
        secondNine: nineNames.second.trim() || undefined,
      },
    });
    setOpen(false);
    setChoice({ name: '' });
    setNewPutter('');
    // The sheet is reused, so conditions from the last round must not ride along into the next.
    setAerated(undefined);
    setBumpy(undefined);
    go('/track');
  };

  return (
    <>
      {live && (
        <div className="card card-live">
          <span className="tiny">Round in progress</span>
          <h3 style={{ marginTop: 4 }}>
            {live.practice ? 'Practice round' : live.course || fmtDate(live.date)} · hole {state.track.hole}
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
      {!currentSession() && (
        <div className="card signin-lead">
          <strong>Your rounds only live on this phone</strong>
          <p className="small" style={{ margin: '4px 0 10px' }}>
            Make an account and they back up, follow you to a new phone, and let you join your
            team. It takes an email and a password.
          </p>
          <a className="btn btn-primary btn-wide" href="#/settings">
            Set up an account
          </a>
        </div>
      )}

      {finished.length === 0 && (
        <div className="empty">
          <p style={{ margin: 0 }}>
            Nothing here yet. Tap New round, pick your course, then log the distance of every putt
            as you go. One round turns on your make rates and strokes gained; a handful turns on
            the rest.
          </p>
        </div>
      )}

      <div className="round-list">
      {(showAll ? finished : finished.slice(0, 20)).map(({ round: r, stats: s, mistakes, bled, form }) => (
        <button
            key={r.id}
            className={r.competitive ? 'round-row comp' : 'round-row'}
            onClick={() => go(`/round/${r.id}`)}
          >
          {/* The leading edge used to be the competitive marker. Form took it, because a colour
              running the height of every card is the one thing you can read down a whole list
              without stopping, and competitive moved to a trophy that needs no learning. */}
          {form && (
            <span
              className="form-rail"
              // Width, never opacity. Fading an untagged round lightened its colour and so
              // overrode the ramp: a dark-green 9.1 drawn at 0.75 came out lighter than a
              // mid-green 6.5 at full strength, which is the one thing the scale must not do.
              style={{
                background: formBand(form.score).ink,
                width: form.process === null ? 2 : 5,
              }}
              aria-hidden="true"
            />
          )}
          <div className="round-head">
            {/* Date and cup travel as one. Loose in a space-between row they were two separate
                children, so a round with no blood drop split the spare width between them and
                left the cup stranded mid-card. */}
            <span className="round-when">
              <span className="round-date">{fmtDate(r.date)}</span>
              {r.competitive && (
                <span className="comp-cup" aria-label="competitive round">
                  🏆
                </span>
              )}
            </span>
            {/* Drawn whenever a putting mistake happened, same as the drop on the scorecard,
                so no drop means no mistake. The number is what it went on to cost, and a zero
                sits quiet because getting away with one is not damage. */}
            {mistakes > 0 && (
              <span
                className={bled > 0 ? 'bleed-tag' : 'bleed-tag clean'}
                aria-label={
                  bled > 0
                    ? `${bled} shot${bled === 1 ? '' : 's'} lost after a putting mistake`
                    : 'a putting mistake that cost nothing'
                }
              >
                🩸{bled}
              </span>
            )}
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
              <span className={s.sg >= 0 ? 'val pos' : 'val neg'}>{signed(s.sg)}</span>
            </span>
            <span className="metric">
              <span className="tiny">Score</span>
              <span className="val">{r.score ?? '--'}</span>
            </span>
            {form && (
              <span className="metric metric-form">
                <span className="tiny">Form</span>
                <span
                  className="val"
                  style={{ color: formBand(form.score).ink }}
                >
                  {form.score.toFixed(1)}
                </span>
              </span>
            )}
          </div>
        </button>
      ))}
      </div>

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

          <div className="field-label">Greens, by stimp</div>
          <GreenSpeedPick value={greenSpeed} onPick={setGreenSpeed} />
          {/* Green speed sits here and is on 27 of 27 rounds. Bumpiness and aeration sat on the
              round page afterwards and are on 2 and 0. Same question, same sheet. */}
          <Conditions
            aerated={aerated}
            bumpy={bumpy}
            onChange={(patch) => {
              if ('aerated' in patch) setAerated(patch.aerated);
              if ('bumpy' in patch) setBumpy(patch.bumpy);
            }}
          />

          <div className="field-label">Playing</div>
          <div className="seg">
            {[false, true].map((t) => (
              <button
                key={String(t)}
                type="button"
                aria-pressed={competitive === t}
                onClick={() => setCompetitive(t)}
              >
                {t ? 'Competitive' : 'Casual'}
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
            // A round with no course cannot say where it was played, and every panel that
            // groups or labels by course has to carry a fallback for it. Require one.
            disabled={!choice.name.trim() || (usable.length ? !putterId : !newPutter.trim())}
          >
            Start tracking
          </button>
        </Sheet>
      )}
    </>
  );
}
