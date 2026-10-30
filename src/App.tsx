import { Practice } from './pages/Practice';
import { DrillPage } from './pages/DrillPage';
import { DrillEdit } from './pages/DrillEdit';
import { SessionPage } from './pages/SessionPage';
import { SessionEdit } from './pages/SessionEdit';
import { DrillBrowse } from './pages/DrillBrowse';
import { Distances } from './pages/Distances';
import { SessionList } from './pages/SessionList';
import { Hands } from './pages/Hands';
import { PracticeLogPage } from './components/PracticeLog';
import { PracticeWhy } from './pages/PracticeWhy';
import { Rounds } from './pages/Rounds';
import { RoundDetail } from './pages/RoundDetail';
import { Settings } from './pages/Settings';
import { SharedRound } from './pages/SharedRound';
import { Stats } from './pages/Stats';
import { Team } from './pages/Team';
import { Track } from './pages/Track';
import { useEffect, useRef } from 'react';
import { bleedSummary } from './lib/bleed';
import { fitMakeModel, makeability } from './lib/makeability';
import { useRoute } from './lib/router';
import { courseLabel, overall, roundStats } from './lib/stats';
import { publishRounds, publishStats, unpublishRounds } from './lib/teams';
import { syncQuietly } from './lib/sync';
import { findRound, liveRound, useApp } from './lib/store';
import { holeVsPar, type AppState } from './lib/types';

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
    bounce_back: bleedSummary(done).afterRate,
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
  { path: '/practice', label: 'Practice' },
  { path: '/settings', label: 'Settings' },
];

/** Team lives under Settings over the winter, so its page lights the tab it is reached from. */
const PARENT: Record<string, string> = { '/team': '/settings' };

/** Track earns a tab only while a round is going. Otherwise it is a dead end. */
function tabsFor(live: boolean) {
  return TABS.filter((t) => t.path !== '/track' || live);
}

/**
 * Where Track sends you when there is nothing to track: back to whatever you last finished. Swiping
 * back after finishing a round, or the app reopening on Track after a round ended on another
 * phone, used to show an empty Track tab.
 */
function afterTrack(state: AppState): string {
  const newest = (rs: { updated?: string }[]) => rs.reduce((a, r) => ((r.updated ?? '') > a ? (r.updated ?? '') : a), '');
  return newest(state.practiceRounds ?? []) > newest(state.rounds) ? '/practice' : '/';
}

export default function App() {
  const route = useRoute();
  const { state, dispatch } = useApp();
  const live = liveRound(state);

  // Installed to a home screen, the app resumes rather than reloads, so mounting once is not
  // the same as opening the app. Sync whenever it comes back to the foreground too, and keep
  // the latest state in a ref so these listeners never push a stale snapshot.
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    const run = () => void syncQuietly(latest.current, dispatch);
    run();
    // Both directions. Pushing only on the way in meant the hole you just logged sat on the
    // phone until the next time you opened the app, so anything reading the round off the
    // server was permanently one visit behind.
    document.addEventListener('visibilitychange', run);
    window.addEventListener('focus', run);
    window.addEventListener('online', run);
    return () => {
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('focus', run);
      window.removeEventListener('online', run);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staleTrack = route === '/track' && !live;
  // A page for something deleted, reached by swiping back or from another phone, moves on quietly.
  const grave = (id: string) => state.tombstones.find((t) => t.id === id);
  const buried = (id: string) => !!grave(id);
  const deadRound = route.match(/^\/round\/([^/]+)/)?.[1];
  const deadPractice = route.match(/^\/practice\/(?:session|session-edit|drill|edit)\/([^/]+)$/)?.[1];
  const deadEnd =
    deadRound && !findRound(state, deadRound) && buried(deadRound)
      ? grave(deadRound)!.kind === 'practice'
        ? '/stats/practice'
        : '/'
      : deadPractice && deadPractice !== 'new' && buried(deadPractice)
        ? '/practice'
        : null;
  useEffect(() => {
    // Same rule: a delete that already moved on keeps its own destination.
    if (deadEnd && window.location.hash === `#${route}`) window.location.replace(`#${deadEnd}`);
  }, [deadEnd, route]);
  useEffect(() => {
    // Only if Track is still the page: finishing a round ends it and moves on in the same tap,
    // and this must not overrule that move. Replaced, not pushed, so back cannot land here again.
    if (staleTrack && window.location.hash === '#/track') window.location.replace(`#${afterTrack(latest.current)}`);
  }, [staleTrack]);

  useEffect(() => {
    if (!state.rounds.some((r) => r.finished)) return;
    const id = setTimeout(() => {
      void publishStats(summarise(state));
      // Bounded on purpose. Anything older than the last fifty deletions went up long ago, and
      // an unbounded list would eventually outgrow the request line.
      void unpublishRounds(
        state.tombstones
          .filter((t) => t.kind === 'round')
          .sort((a, b) => b.at.localeCompare(a.at))
          .slice(0, 50)
          .map((t) => t.id),
      );
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
              detail: r.holes
                .filter((h) => h.putts.length || holeVsPar(h) !== undefined)
                .map((h) => ({
                  h: h.hole,
                  p: h.putts.length,
                  d: h.putts[0]?.d ?? null,
                  v: holeVsPar(h) ?? null,
                })),
            };
          }),
      );
    }, 1200);
    return () => clearTimeout(id);
  }, [state]);

  // A shared round is for someone with no account, so it gets the wordmark and nothing else:
  // no tab bar, since there is nowhere for a visitor to go.
  const sharedMatch = route.match(/^\/s\/(.+)$/);
  if (sharedMatch) {
    return (
      <div className="app">
        <div className="topbar">
          <h1 className="wordmark">BREAK!</h1>
          <span className="sub">Shared round</span>
        </div>
        <main className="main">
          <SharedRound token={decodeURIComponent(sharedMatch[1])} />
        </main>
      </div>
    );
  }

  // /round/<id> and /round/<id>/hole/<n>, so a stat can land on the hole it is talking about
  // rather than the top of the round.
  const roundMatch = route.match(/^\/round\/([^/]+)(?:\/hole\/(\d+))?$/);
  const practiceMatch = route.match(/^\/practice\/(drill|edit|session|session-edit)\/([^/]+)$/);
  const page = practiceMatch ? (
    practiceMatch[1] === 'drill' ? (
      <DrillPage key={practiceMatch[2]} id={practiceMatch[2]} />
    ) : practiceMatch[1] === 'edit' ? (
      <DrillEdit key={practiceMatch[2]} id={practiceMatch[2]} />
    ) : practiceMatch[1] === 'session-edit' ? (
      <SessionEdit key={practiceMatch[2]} id={practiceMatch[2]} />
    ) : (
      <SessionPage key={practiceMatch[2]} id={practiceMatch[2]} />
    )
  ) : route === '/practice/drills' ? (
    <DrillBrowse />
  ) : route === '/practice/distances' ? (
    <Distances />
  ) : route === '/practice/sessions' ? (
    <SessionList />
  ) : route === '/practice/hands' ? (
    <Hands />
  ) : route === '/practice/log' ? (
    <PracticeLogPage />
  ) : route === '/practice/why' ? (
    <PracticeWhy />
  ) : roundMatch ? (
    <RoundDetail id={roundMatch[1]} openHole={roundMatch[2] ? Number(roundMatch[2]) : undefined} />
  ) : staleTrack ? (
    afterTrack(state) === '/practice' ? <Practice /> : <Rounds />
  ) : route === '/track' ? (
    <Track />
  ) : route === '/stats' || route === '/stats/practice' ? (
    <Stats key={route} practice={route === '/stats/practice'} />
  ) : route === '/practice' ? (
    <Practice />
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
        : route === '/stats/practice'
          ? 'Practice'
        : route.startsWith('/practice')
          ? 'Practice'
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
        {tabsFor(!!live).map((t) => {
          const here = route.startsWith('/practice')
            ? '/practice'
            : route.startsWith('/stats')
              ? '/stats'
              : (PARENT[route] ?? route);
          const on = t.path === '/' ? here === '/' || here.startsWith('/round/') : here === t.path;
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
