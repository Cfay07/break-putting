import { useEffect, useState } from 'react';
import { fmtDate } from '../lib/format';
import { findFocus, startSession } from '../lib/starters';
import { loadFocus } from '../lib/teams';
import { resolveDrill } from '../lib/drills';
import { usePractice } from '../lib/usePractice';

const CACHE = 'break.focus';

type Week = { session: string; set_at: string; team: string };

function cached(): Week | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? 'null') as Week | null;
  } catch {
    return null;
  }
}

/** The session your coach picked for the week, first thing on Practice. */
export function TeamWeek() {
  const { state, dispatch, surface } = usePractice();
  const [week, setWeek] = useState<Week | null>(cached);

  useEffect(() => {
    loadFocus()
      .then((all) => {
        const next = all[0] ? { session: all[0].session, set_at: all[0].set_at, team: all[0].team } : null;
        setWeek(next);
        try {
          if (next) localStorage.setItem(CACHE, JSON.stringify(next));
          else localStorage.removeItem(CACHE);
        } catch {
          // Shows after the network answers instead of straight away.
        }
      })
      .catch(() => undefined);
  }, []);

  const focus = findFocus(week?.session);
  if (!week || !focus) return null;

  const from = week.set_at.slice(0, 10);
  const done = state.practice
    .filter((s) => s.session === focus.id && s.date >= from)
    .map((s) => s.date)
    .sort()
    .pop();
  const drills = focus.blocks.map((b) => resolveDrill(state, b.drill)?.name).filter(Boolean);
  const mins = focus.blocks.reduce((n, b) => n + (b.minutes ?? 0), 0);

  return (
    <section className="team-week">
      <span className="team-week-eyebrow">This week · {week.team}</span>
      <strong className="team-week-name">{focus.name}</strong>
      <span className="team-week-sub">
        {done ? `Done ${fmtDate(done)}. ` : ''}
        {mins} min · {drills.join(', ')}
      </span>
      <button
        className={done ? 'btn btn-wide' : 'btn btn-primary btn-wide'}
        onClick={() => startSession(state, dispatch, focus, surface)}
      >
        {done ? 'Run it again' : 'Start'}
      </button>
    </section>
  );
}
