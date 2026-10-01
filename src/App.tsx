import { Rounds } from './pages/Rounds';
import { RoundDetail } from './pages/RoundDetail';
import { Settings } from './pages/Settings';
import { Stats } from './pages/Stats';
import { Team } from './pages/Team';
import { Track } from './pages/Track';
import { useEffect } from 'react';
import { bleedSummary } from './lib/bleed';
import { fitMakeModel, makeability } from './lib/makeability';
import { useRoute } from './lib/router';
import { courseLabel, overall, roundStats } from './lib/stats';
import { publishRounds, publishStats } from './lib/teams';
import { syncQuietly } from './lib/sync';
import { liveRound, useApp } from './lib/store';
import type { AppState } from './lib/types';

/**
 * What this player shares with their teams. Only these numbers leave the device; the rounds
 * themselves stay owner-only in the database.
 */
function summarise(state: AppState) {
  const done = state.rounds.filter((r) => r.finished);
  const o = overall(done, state.baseline);
  const model = fitMakeModel(done);
  const live = state.rounds.find((r) => !r.finished);
  const played = live ? live.holes.filter((h) => h.putts.length > 0).length : 0;
  return {
    rounds: done.length,
    competitive_rounds: done.filter((r) => r.competitive).length,
    putts_pr: o.puttsPerRound,
    three_pr: o.threePuttsPerRound,
    sg_pr: o.sgPerRound,
    make6: makeability(model, 6),
    bleed_pr: bleedSummary(done).shotsPerRound,
    scoring_pct: o.scoringPct !== null ? o.scoringPct / 100 : null,
    last_round: done.length ? done.reduce((a, b) => (b.date > a.date ? b : a)).date : null,
    live: live && played
      ? {
          hole: Math.max(...live.holes.filter((h) => h.putts.length).map((h) => h.hole)),
          thru: played,
          course: live.course,
          started_at: live.updated ?? new Date().toISOString(),
        }
      : null,
  };
}

const TABS = [
  { path: '/', label: 'Rounds' },
  { path: '/track', label: 'Track' },
  { path: '/stats', label: 'Stats' },
  { path: '/team', label: 'Team' },
  { path: '/settings', label: 'Settings' },
];

/** Track earns a tab only while a round is going. Otherwise it is a dead end. */
function tabsFor(live: boolean, route: string) {
  return TABS.filter((t) => t.path !== '/track' || live || route === '/track');
}

export default function App() {
  const route = useRoute();
  const { state, dispatch } = useApp();
  const live = liveRound(state);

  useEffect(() => {
    void syncQuietly(state, dispatch);
    const onBack = () => void syncQuietly(state, dispatch);
    window.addEventListener('online', onBack);
    return () => window.removeEventListener('online', onBack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!state.rounds.some((r) => r.finished)) return;
    const id = setTimeout(() => {
      void publishStats(summarise(state));
      void publishRounds(
        state.rounds
          .filter((r) => r.finished)
          .map((r) => {
            const s = roundStats(r, state.baseline);
            return {
              round_id: r.id,
              played_on: r.date,
              course: courseLabel(r),
              holes_played: s.holesPlayed,
              score: r.score ?? null,
              putts: s.totalPutts,
              three_putts: s.threePlus,
              sg: Number(s.sg.toFixed(3)),
              competitive: !!r.competitive,
            };
          }),
      );
    }, 1200);
    return () => clearTimeout(id);
  }, [state]);

  const roundMatch = route.match(/^\/round\/(.+)$/);
  const page = roundMatch ? (
    <RoundDetail id={roundMatch[1]} />
  ) : route === '/track' ? (
    <Track />
  ) : route === '/stats' ? (
    <Stats />
  ) : route === '/team' ? (
    <Team />
  ) : route === '/settings' ? (
    <Settings />
  ) : (
    <Rounds />
  );

  const sub = roundMatch
    ? 'Round'
    : route === '/track'
      ? live
        ? 'Logging'
        : 'Track'
      : route === '/stats'
        ? 'All rounds'
        : route === '/team'
          ? 'Team'
          : route === '/settings'
            ? 'Settings'
            : 'Putting';

  return (
    <div className="app">
      <div className="topbar">
        <h1 className="wordmark">BREAK!</h1>
        <span className="sub">{sub}</span>
      </div>
      <main className="main">{page}</main>
      <nav className="nav">
        {tabsFor(!!live, route).map((t) => {
          const on = t.path === '/' ? route === '/' || route.startsWith('/round/') : route === t.path;
          return (
            <a key={t.path} href={`#${t.path}`} className={on ? 'on' : undefined}>
              {t.label}
              {t.path === '/track' && live && <span className="dot" aria-label="round in progress" />}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
