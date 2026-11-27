import { useMemo, useState } from 'react';
import { CoursePicker, fitPars, isNine, mergeCourses, teesFor, type CourseChoice } from './CoursePicker';
import { Conditions } from './Conditions';
import { GreenSpeedPick } from './GreenSpeedPick';
import { Sheet } from './Sheet';
import { ninesPart } from '../lib/builtInCourses';
import { fmtDate, today } from '../lib/format';
import { go } from '../lib/router';
import { newId } from '../lib/storage';
import { roundScale } from '../lib/stats';
import { makeRound, useApp } from '../lib/store';
import { GREEN_SPEED_LABELS, GREEN_SPEED_STIMP, type GreenSpeed, type Round, type SavedCourse } from '../lib/types';

const dayLabel = (iso: string) => {
  if (iso === today()) return `Today, ${fmtDate(iso)}`;
  const [y, m, d] = iso.split('-').map(Number);
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(y, m - 1, d).getDay()]}, ${fmtDate(iso)}`;
};

/** One screen: the last course and tee already picked, everything else a row you can change. */
export function NewRoundSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp();
  const known = useMemo(() => mergeCourses(state.courses), [state.courses]);
  const usable = state.putters.filter((p) => !p.retired);

  // Real rounds at a known course, newest first. These decide what is filled in.
  const past = useMemo(
    () =>
      state.rounds
        .filter((r) => r.finished && !r.practice && r.courseId && known.some((c) => c.id === r.courseId))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [state.rounds, known],
  );
  const last = past[0];
  const recentCourses = useMemo(() => {
    const ids: string[] = [];
    for (const r of past) if (!ids.includes(r.courseId!)) ids.push(r.courseId!);
    return ids.slice(0, 4).map((id) => known.find((c) => c.id === id)!);
  }, [past, known]);

  const choiceFrom = (course: SavedCourse, teeName: string | undefined, holes: number): CourseChoice => {
    const tees = teesFor(course, holes);
    const tee = tees.find((t) => t.name === teeName) ?? tees[0];
    return {
      name: course.name,
      courseId: course.id,
      tee: tee?.name,
      pars: tee ? fitPars(tee.pars, holes) : undefined,
      nineOnly: isNine(course),
    };
  };
  const lastAt = (courseId: string) => past.find((r) => r.courseId === courseId);

  const [date, setDate] = useState(today);
  const [holeCount, setHoleCount] = useState(() => (last && roundScale(last) > 1 ? 9 : 18));
  const [choice, setChoice] = useState<CourseChoice>(() => {
    const c = last && known.find((k) => k.id === last.courseId);
    return c ? choiceFrom(c, last.tee, roundScale(last) > 1 ? 9 : 18) : { name: '' };
  });
  const [searching, setSearching] = useState(!last);
  const [half, setHalf] = useState<'front' | 'back'>('front');
  const [competitive, setCompetitive] = useState(false);
  const [greenSpeed, setGreenSpeed] = useState<GreenSpeed | undefined>(() => last?.greenSpeed);
  const [greensOpen, setGreensOpen] = useState(false);
  const [aerated, setAerated] = useState<boolean | undefined>();
  const [bumpy, setBumpy] = useState<number | undefined>();
  const [putterId, setPutterId] = useState(
    () =>
      (last && usable.some((p) => p.id === last.putterId) ? last.putterId : undefined) ??
      usable.find((p) => p.active)?.id ??
      usable[0]?.id ??
      '',
  );
  const [newPutter, setNewPutter] = useState('');

  const course = choice.courseId ? known.find((c) => c.id === choice.courseId) : undefined;
  const timesHere = course ? past.filter((r) => r.courseId === course.id) : [];
  const pickCourse = (c: SavedCourse) => {
    const holes = isNine(c) ? 9 : holeCount;
    if (holes !== holeCount) setHoleCount(holes);
    setChoice(choiceFrom(c, lastAt(c.id)?.tee, holes));
    setGreenSpeed(lastAt(c.id)?.greenSpeed ?? greenSpeed);
    setSearching(false);
  };
  const setHoles = (n: number) => {
    setHoleCount(n);
    if (course) setChoice(choiceFrom(course, choice.tee, n));
  };

  const teeNines = choice.tee?.includes('/')
    ? ninesPart(choice.tee)
        .split('/')
        .map((n) => n.trim())
    : null;
  const parsForRound =
    choice.pars && holeCount === 9 && choice.pars.length > 9
      ? half === 'back'
        ? choice.pars.slice(9, 18)
        : choice.pars.slice(0, 9)
      : choice.pars;
  const nineNames =
    holeCount === 9
      ? { first: teeNines ? teeNines[half === 'back' ? 1 : 0] : '', second: '' }
      : { first: teeNines ? teeNines[0] : '', second: teeNines ? teeNines[1] : '' };

  const ready = !!choice.name.trim() && (usable.length ? !!putterId : !!newPutter.trim());
  const start = () => {
    if (!ready) return;
    let id = putterId;
    if (!usable.length) {
      id = newId();
      dispatch({ t: 'addPutter', id, name: newPutter });
    }
    const round: Round = {
      ...makeRound({ date, course: choice.name, putterId: id, holeCount, pars: parsForRound }),
      courseId: choice.courseId,
      tee: choice.tee,
      competitive: competitive || undefined,
      greenSpeed,
      aerated,
      bumpy,
      firstNine: nineNames.first.trim() || undefined,
      secondNine: nineNames.second.trim() || undefined,
    };
    dispatch({ t: 'newRound', round });
    onClose();
    go('/track');
  };

  return (
    <Sheet title="New round" onClose={onClose}>
      <label className="nr-date">
        <span>{dayLabel(date)}</span>
        <input
          type="date"
          value={date}
          max={today()}
          onChange={(e) => setDate(!e.target.value || e.target.value > today() ? today() : e.target.value)}
          aria-label="Date played"
        />
      </label>

      {course && !searching ? (
        <div className="nr-course">
          <span className="nr-eyebrow">{course.id === last?.courseId ? 'Same as last time' : 'Course'}</span>
          <strong className="nr-name">{course.name}</strong>
          <span className="nr-sub">
            {[
              course.place,
              timesHere.length
                ? `played ${timesHere.length} ${timesHere.length === 1 ? 'time' : 'times'} · last ${fmtDate(timesHere[0].date)}`
                : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <div className="nr-tees">
            {teesFor(course, holeCount).map((t) => (
              <button
                key={t.name}
                type="button"
                aria-pressed={choice.tee === t.name}
                onClick={() => setChoice(choiceFrom(course, t.name, holeCount))}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <CoursePicker
          holeCount={holeCount}
          value={{ name: '' }}
          onChange={(c) => {
            const picked = c.courseId ? known.find((k) => k.id === c.courseId) : undefined;
            if (picked) {
              const holes = c.nineOnly ? 9 : holeCount;
              if (holes !== holeCount) setHoleCount(holes);
              setChoice(choiceFrom(picked, c.tee, holes));
            } else setChoice(c);
            setSearching(false);
          }}
        />
      )}

      {!searching && (
        <div className="nr-others">
          {recentCourses
            .filter((c) => c.id !== course?.id)
            .slice(0, 3)
            .map((c) => (
              <button key={c.id} type="button" onClick={() => pickCourse(c)}>
                {c.name}
              </button>
            ))}
          <button type="button" className="nr-search" onClick={() => setSearching(true)}>
            Another course
          </button>
        </div>
      )}

      <div className="nr-rows">
        <div className="nr-row">
          <span>Holes</span>
          <div className="seg">
            {[18, 9].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={holeCount === n}
                disabled={choice.nineOnly && n === 18}
                onClick={() => setHoles(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        {holeCount === 9 && (choice.pars?.length ?? 0) > 9 && (
          <div className="nr-row">
            <span>Nine</span>
            <div className="seg">
              {(['front', 'back'] as const).map((h) => (
                <button key={h} type="button" aria-pressed={half === h} onClick={() => setHalf(h)}>
                  {teeNines ? teeNines[h === 'back' ? 1 : 0] : h === 'front' ? 'Front' : 'Back'}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="nr-row">
          <span>Putter</span>
          {usable.length ? (
            <div className="seg">
              {usable.map((p) => (
                <button key={p.id} type="button" aria-pressed={putterId === p.id} onClick={() => setPutterId(p.id)}>
                  {p.name}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={newPutter}
              onChange={(e) => setNewPutter(e.target.value)}
              placeholder="What's in the bag"
            />
          )}
        </div>
        <div className="nr-row">
          <span>Playing</span>
          <div className="seg">
            {[false, true].map((t) => (
              <button key={String(t)} type="button" aria-pressed={competitive === t} onClick={() => setCompetitive(t)}>
                {t ? 'Tournament' : 'Casual'}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="nr-row nr-greens" onClick={() => setGreensOpen((o) => !o)}>
          <span>Greens</span>
          <span className="nr-greens-v">
            {greenSpeed ? `${GREEN_SPEED_LABELS[greenSpeed]}, stimp ${GREEN_SPEED_STIMP[greenSpeed]}` : 'Not set'}
            <i aria-hidden="true">{greensOpen ? '−' : '+'}</i>
          </span>
        </button>
        {greensOpen && (
          <div className="nr-greens-open">
            <GreenSpeedPick value={greenSpeed} onPick={setGreenSpeed} />
            <Conditions
              aerated={aerated}
              bumpy={bumpy}
              onChange={(patch) => {
                if ('aerated' in patch) setAerated(patch.aerated);
                if ('bumpy' in patch) setBumpy(patch.bumpy);
              }}
            />
          </div>
        )}
      </div>

      {last && <p className="small muted nr-note">Filled in from your last round. Change anything after you finish.</p>}

      <div className="nr-start">
        <button className="btn btn-primary btn-wide" onClick={start} disabled={!ready}>
          <span>Start round</span>
          {choice.name && (
            <small>
              {[choice.name, choice.tee, holeCount === 9 ? '9 holes' : '18 holes'].filter(Boolean).join(' · ')}
            </small>
          )}
        </button>
      </div>
    </Sheet>
  );
}
