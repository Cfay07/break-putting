import { useState } from 'react';
import { ConfirmButton } from './ConfirmButton';
import { Sheet } from './Sheet';
import { resolveDrill } from '../lib/drills';
import { fmtDate } from '../lib/format';
import { byTime } from '../lib/practice';
import { setScore } from '../lib/practiceView';
import { useApp } from '../lib/store';
import { SURFACE_LABELS, type PracticeSet } from '../lib/types';

interface Entry {
  key: string;
  date: string;
  session?: string;
  sets: PracticeSet[];
}

/** One entry per practice: a session on a day, or the loose drills rolled that day. */
export function practicesOf(sets: PracticeSet[]): Entry[] {
  const m = new Map<string, Entry>();
  for (const s of [...sets].sort(byTime)) {
    const key = `${s.date}|${s.session ?? ''}`;
    const e = m.get(key) ?? { key, date: s.date, session: s.session, sets: [] };
    e.sets.push(s);
    m.set(key, e);
  }
  return [...m.values()].sort((a, b) => b.date.localeCompare(a.date) || byTime(b.sets[0], a.sets[0]));
}

export function PracticeLog({ limit }: { limit?: number }) {
  const { state, dispatch } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const all = practicesOf(state.practice);
  const list = limit ? all.slice(0, limit) : all;
  const shown = all.find((e) => e.key === open) ?? null;
  const name = (e: Entry) =>
    e.session ? (state.sessions.find((x) => x.id === e.session)?.name ?? 'A deleted session') : 'Drills';

  return (
    <>
      <div className="row-list">
        {list.map((e) => (
          <button key={e.key} className="nav-row log-row" onClick={() => setOpen(e.key)}>
            <span className="nav-main">
              <strong>{name(e)}</strong>
              <span className="small muted">
                {fmtDate(e.date)} · {e.sets.length} {e.sets.length === 1 ? 'set' : 'sets'} ·{' '}
                {e.sets.reduce((n, s) => n + s.attempts, 0)} putts
              </span>
            </span>
          </button>
        ))}
        {limit && all.length > limit && (
          <a className="nav-row" href="#/practice/log">
            <span className="nav-main">
              <strong>Every practice</strong>
              <span className="small muted">{all.length} in all</span>
            </span>
          </a>
        )}
      </div>
      {shown && (
        <Sheet title={`${name(shown)}, ${fmtDate(shown.date)}`} onClose={() => setOpen(null)}>
          {shown.sets.map((s) => {
            const d = resolveDrill(state, s.drill);
            return (
              <div key={s.id} className="stat-row">
                <span className="k">
                  {d?.name ?? 'Deleted drill'} · {SURFACE_LABELS[s.surface]}
                </span>
                <span className="v num">{setScore(d, s)}</span>
              </div>
            );
          })}
          <ConfirmButton
            label="Delete this practice"
            confirmLabel={`Delete all ${shown.sets.length}?`}
            className="btn btn-danger btn-wide"
            style={{ marginTop: 14 }}
            onConfirm={() => {
              dispatch({ t: 'deletePracticeSets', ids: shown.sets.map((s) => s.id) });
              setOpen(null);
            }}
          />
        </Sheet>
      )}
    </>
  );
}

export function PracticeLogPage() {
  return (
    <div>
      <div className="page-top">
        <a href="#/practice" className="back-link">
          Practice
        </a>
      </div>
      <h1 className="page-title">Every practice</h1>
      <div style={{ marginTop: 12 }}>
        <PracticeLog />
      </div>
    </div>
  );
}
