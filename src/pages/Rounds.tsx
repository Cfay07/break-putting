import { useMemo, useState } from 'react';
import { CompareRounds } from '../components/CompareRounds';
import { ConfirmButton } from '../components/ConfirmButton';
import { NewRoundSheet } from '../components/NewRoundSheet';
import { PutterTag } from '../components/PutterTag';
import { fmtDate, signed } from '../lib/format';
import { go } from '../lib/router';
import { currentSession } from '../lib/cloud';
import { bleedsIn } from '../lib/bleed';
import { formOf, formBand } from '../lib/form';
import { courseLabel, roundScale, roundStats } from '../lib/stats';
import { liveRound, useApp } from '../lib/store';

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
  const [open, setOpen] = useState(false);
  const currentPutter = state.putters.find((p) => p.active && !p.retired)?.id;
  const [showAll, setShowAll] = useState(false);
  return (
    <>
      {live && (
        <div className="card card-live">
          <span className="tiny">Round in progress</span>
          <h3 style={{ marginTop: 4 }}>
            {live.practice ? 'Practice round' : live.course || fmtDate(live.date)} · hole {state.track.hole}
            {state.track.phase === 'tags'
              ? ', tagging a miss'
              : `, putt ${(live.holes.find((h) => h.hole === state.track.hole)?.putts.length ?? 0) + 1}`}
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
        <h2>Rounds{finished.length > 0 && <span className="list-count">{finished.length} finished</span>}</h2>
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
            Make an account and they back up and follow you to a new phone. It takes an email and a password.
          </p>
          <a className="btn btn-primary btn-wide" href="#/settings">
            Set up an account
          </a>
        </div>
      )}

      {finished.length === 0 && (
        <div className="empty">
          <p style={{ margin: 0 }}>
            Nothing here yet. Tap New round, pick your course, then log the distance of every putt as you go. One round
            turns on your make rates and strokes gained; a handful turns on the rest.
          </p>
        </div>
      )}

      {finished.length > 0 && (
        <div className="round-cols" aria-hidden="true">
          <span>Score</span>
          <span>Putts</span>
          <span>3-putts</span>
          <span>Gained</span>
          <span>Form</span>
        </div>
      )}
      <div className="round-list">
        {(showAll ? finished : finished.slice(0, 20)).map(({ round: r, stats: s, mistakes, bled, form }) => (
          <button
            key={r.id}
            className={r.competitive ? 'round-row comp' : 'round-row'}
            onClick={() => go(`/round/${r.id}`)}
          >
            {/* Form owns the leading edge: a colour you can read down the whole list. Width, never
              opacity, marks an untagged round, so the colour ramp is never overridden. */}
            {form && (
              <span
                className="form-rail"
                style={{ background: formBand(form.score).ink, width: form.process === null ? 2 : 5 }}
                aria-hidden="true"
              />
            )}
            <div className="round-head">
              <span className="round-date">{fmtDay(r.date)}</span>
              {r.course && <span className="round-course">{courseLabel(r)}</span>}
              {r.competitive && <span className="round-chip">Tourn.</span>}
              {/* The putter shows when it is not the one in the bag now, which is where a switch
                  shows up down the list. */}
              {r.putterId !== currentPutter && <PutterTag putterId={r.putterId} />}
              {/* A drop whenever a putting mistake happened; the number is what it went on to cost. */}
              {mistakes > 0 && (
                <span
                  className={bled > 0 ? 'bleed-tag' : 'bleed-tag clean'}
                  aria-label={bled > 0 ? `putting mistakes put ${bled} on the card` : 'a putting mistake'}
                >
                  <DropMark />
                  {bled > 0 ? bled : ''}
                </span>
              )}
            </div>
            <div className="round-nums num">
              <span className="round-score">{r.score ?? '--'}</span>
              <span>{s.totalPutts}</span>
              <span className={s.threePlus ? 'neg' : undefined}>{s.threePlus}</span>
              <span className={s.sg >= 0 ? 'pos' : 'neg'}>{signed(s.sg, 1)}</span>
              <span className="round-form">
                {form ? (
                  <>
                    {form.score.toFixed(1)}
                    <i
                      style={
                        form.process === null
                          ? { borderColor: formBand(form.score).ink }
                          : { background: formBand(form.score).ink, borderColor: formBand(form.score).ink }
                      }
                      aria-label={form.process === null ? 'scored on the finish only' : 'tagged round'}
                    />
                  </>
                ) : (
                  '--'
                )}
              </span>
            </div>
          </button>
        ))}
      </div>

      {finished.length >= 3 && (
        <a href="#/history" className="rounds-history">
          History ›
        </a>
      )}
      {finished.length > 20 && !showAll && (
        <button className="btn btn-ghost btn-wide" onClick={() => setShowAll(true)}>
          Show all {finished.length} rounds
        </button>
      )}

      <CompareRounds
        rounds={finished.map((x) => x.round).sort((a, b) => b.date.localeCompare(a.date))}
        baseline={state.baseline}
      />

      {open && <NewRoundSheet onClose={() => setOpen(false)} />}
    </>
  );
}

/** "Mon, Sep 14": the weekday helps you find a round faster than the date does. */
function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(y, m - 1, d).getDay()];
  return `${day}, ${fmtDate(iso)}`;
}

/** A putting mistake. Drawn, so it reads the same on every phone, unlike the emoji it replaces. */
function DropMark() {
  return (
    <svg width="9" height="12" viewBox="0 0 9 12" aria-hidden="true">
      <path d="M4.5 0.5C4.5 0.5 0.8 5 0.8 7.6a3.7 3.7 0 0 0 7.4 0C8.2 5 4.5 0.5 4.5 0.5Z" fill="currentColor" />
    </svg>
  );
}
