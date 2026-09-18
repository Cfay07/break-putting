import { useState } from 'react';
import { BUILT_IN_COURSES } from '../lib/builtInCourses';
import { loadCourse, searchCourses, type CourseHit } from '../lib/courseApi';
import { newId } from '../lib/storage';
import { useApp } from '../lib/store';
import type { SavedCourse, SavedTee } from '../lib/types';

export interface CourseChoice {
  name: string;
  courseId?: string;
  tee?: string;
  pars?: number[];
}

export function CoursePicker({
  holeCount,
  value,
  onChange,
}: {
  holeCount: number;
  value: CourseChoice;
  onChange: (c: CourseChoice) => void;
}) {
  const { state, dispatch } = useApp();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<(CourseHit & { saved?: boolean })[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<SavedCourse | null>(null);
  const [manual, setManual] = useState(false);
  const [mName, setMName] = useState('');
  const [mTee, setMTee] = useState('');
  const [mPars, setMPars] = useState<number[]>(() => Array(18).fill(4));

  const pick = (course: SavedCourse, tee: SavedTee) => {
    onChange({
      name: course.name,
      courseId: course.id,
      tee: tee.name,
      pars: tee.pars.slice(0, holeCount),
    });
    setOpen(null);
    setHits(null);
    setManual(false);
  };

  const openCourse = (course: SavedCourse) => {
    if (course.tees.length === 1) pick(course, course.tees[0]);
    else setOpen(course);
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setError('');

    const local = [
      ...state.courses,
      ...BUILT_IN_COURSES.filter((b) => !state.courses.some((c) => c.id === b.id)),
    ];
    const mine = local
      .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
      .map((c) => ({ id: c.id, name: c.name, place: c.place ?? '', saved: true }));

    try {
      const found = await searchCourses(q);
      const fresh = found.filter((f) => !mine.some((m) => m.id === f.id));
      setHits([...mine, ...fresh]);
      if (!mine.length && !fresh.length) {
        setError('Nothing came back for that. Type the pars in by hand instead.');
      }
    } catch (e) {
      setHits(mine);
      if (!mine.length) setError(`${(e as Error).message} Type the pars in by hand instead.`);
    } finally {
      setBusy(false);
    }
  };

  const openHit = async (hit: CourseHit & { saved?: boolean }) => {
    const mine =
      state.courses.find((c) => c.id === hit.id) ?? BUILT_IN_COURSES.find((c) => c.id === hit.id);
    if (mine) {
      openCourse(mine);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const course = await loadCourse(hit.id);
      dispatch({ t: 'saveCourse', course });
      openCourse(course);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveManual = () => {
    if (!mName.trim()) return;
    const course: SavedCourse = {
      id: newId(),
      name: mName.trim(),
      tees: [{ name: mTee.trim() || 'Pars', pars: mPars.slice(0, holeCount) }],
    };
    dispatch({ t: 'saveCourse', course });
    pick(course, course.tees[0]);
    setMName('');
    setMTee('');
  };

  if (value.pars?.length) {
    const par = value.pars.reduce((a, b) => a + b, 0);
    return (
      <div className="card card-live">
        <h3>{value.name}</h3>
        <p className="small muted" style={{ margin: '2px 0 10px' }}>
          {value.tee} · par {par}
        </p>
        <button
          className="btn btn-ghost btn-wide"
          onClick={() => onChange({ name: value.name, courseId: undefined, tee: undefined, pars: undefined })}
        >
          Change course
        </button>
      </div>
    );
  }

  if (open) {
    return (
      <div className="card">
        <h3>{open.name}</h3>
        <p className="small muted" style={{ margin: '2px 0 10px' }}>
          Which tees?
        </p>
        <div className="chips">
          {open.tees.map((t) => (
            <button key={`${t.name}${t.yards}`} className="chip" onClick={() => pick(open, t)}>
              {t.name}
              {t.yards ? ` · ${t.yards}` : ''}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-wide" style={{ marginTop: 10 }} onClick={() => setOpen(null)}>
          Back
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="field-label">Find a course</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          value={query}
          placeholder="Course or club name"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
        />
        <button className="btn" style={{ flex: '0 0 auto' }} disabled={busy || !query.trim()} onClick={runSearch}>
          {busy ? '...' : 'Search'}
        </button>
      </div>

      {hits?.map((h) => (
        <button key={h.id} className="round-row" style={{ marginTop: 8 }} onClick={() => openHit(h)}>
          <span className="round-date" style={{ fontSize: 15 }}>
            {h.name}
          </span>
          <span className="small muted" style={{ display: 'block' }}>
            {[h.saved ? 'Already on your phone' : '', h.place].filter(Boolean).join(' · ')}
          </span>
        </button>
      ))}

      {error && <p className="small neg">{error}</p>}

      {!manual ? (
        <button className="btn btn-ghost btn-wide" style={{ marginTop: 10 }} onClick={() => setManual(true)}>
          Type the pars in by hand
        </button>
      ) : (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="field-label" style={{ marginTop: 0 }}>
            Course
          </div>
          <input type="text" value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Ives Grove" />
          <div className="field-label">Tees or nines</div>
          <input type="text" value={mTee} onChange={(e) => setMTee(e.target.value)} placeholder="Blue + Red" />
          <div className="field-label">Par for each hole</div>
          <div className="par-grid">
            {Array.from({ length: holeCount }, (_, i) => (
              <label key={i}>
                <span className="tiny">{i + 1}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={mPars[i]}
                  onChange={(e) => {
                    const next = [...mPars];
                    next[i] = Number(e.target.value) || 0;
                    setMPars(next);
                  }}
                />
              </label>
            ))}
          </div>
          <p className="small muted">
            Par {mPars.slice(0, holeCount).reduce((a, b) => a + b, 0)}. Saved for next time so you only do this once.
          </p>
          <button className="btn btn-primary btn-wide" disabled={!mName.trim()} onClick={saveManual}>
            Save course
          </button>
        </div>
      )}
    </>
  );
}
