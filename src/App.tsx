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
import { Tempo } from './pages/Tempo';
import { HistoryPage } from './pages/HistoryPage';
import { Rounds } from './pages/Rounds';
import { RoundDetail } from './pages/RoundDetail';
import { Settings } from './pages/Settings';
import { SharedRound } from './pages/SharedRound';
import { Replay } from './pages/Replay';
import { Stats, TOPICS, type Topic } from './pages/Stats';
import { PRACTICE_TOPICS, type PracticeTopic } from './pages/PracticeStats';
import { Team } from './pages/Team';
import { Privacy, Terms } from './pages/Legal';
import { TeamLivePage, TeamPracticePage, TeamRoundPage } from './pages/TeamPost';
import { Track } from './pages/Track';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { runLapsed } from './lib/practice';
import { remember } from './lib/lastLoaded';
import { go, useRoute } from './lib/router';
import { courseLabel, roundStats } from './lib/stats';
import {
  joinTeam,
  loadFeed,
  loadTeams,
  pendingJoin,
  rememberJoin,
  rememberOnTeam,
  onTeamCached,
  publishPractice,
  publishRounds,
  publishStats,
  unpublishPractice,
  unpublishRounds,
} from './lib/teams';
import { resolveDrill } from './lib/drills';
import { TEST_ID } from './lib/weeklyTest';
import { accountName, currentSession, online } from './lib/cloud';
import { syncQuietly } from './lib/sync';
import { summarise } from './lib/teamSummary';
import { findRound, liveRound, useApp } from './lib/store';
import { holeVsPar, type AppState } from './lib/types';

const TABS = [
  { path: '/', label: 'Rounds' },
  { path: '/track', label: 'Track' },
  { path: '/stats', label: 'Stats' },
  { path: '/practice', label: 'Practice' },
  { path: '/team', label: 'Team' },
  { path: '/settings', label: 'Settings' },
];

/**
 * Track earns a tab only while a round is going, Team only once you are on one. Off a team it is
 * a row in Settings, so the tab bar never holds a page with nothing on it.
 */
function tabsFor(live: boolean, onTeam: boolean) {
  return TABS.filter((t) => (t.path !== '/track' || live) && (t.path !== '/team' || onTeam));
}

/** The practice sets your team sees: what was rolled and how it went. */
function practiceForTeam(state: AppState) {
  return [...state.practice]
    .filter((s) => s.attempts > 0)
    .sort((a, b) => (b.updated ?? b.date).localeCompare(a.updated ?? a.date))
    .slice(0, 50)
    .map((s) => ({
      set_id: s.id,
      played_on: s.date.slice(0, 10),
      title: resolveDrill(state, s.drill)?.name ?? 'Practice',
      kind: s.drill === TEST_ID ? ('test' as const) : ('set' as const),
      session: s.session ?? null,
      made: s.made,
      attempts: s.attempts,
    }));
}

/**
 * Where Track sends you when there is nothing to track: back to whatever you last finished. Swiping
 * back after finishing a round, or the app reopening on Track after a round ended on another
 * phone, used to show an empty Track tab.
 */
function afterTrack(state: AppState): string {
  const newest = (rs: { updated?: string }[]) =>
    rs.reduce((a, r) => ((r.updated ?? '') > a ? (r.updated ?? '') : a), '');
  return newest(state.practiceRounds ?? []) > newest(state.rounds) ? '/practice' : '/';
}

export default function App() {
  const route = useRoute();
  const [onTeam, setOnTeam] = useState(onTeamCached);
  // Tapping the tab you are already on starts it over: the page rebuilds at the top with its
  // filters and sheets cleared. Switching tabs never rebuilds the page you are leaving.
  const [tabTap, setTabTap] = useState(0);
  useEffect(() => {
    const sync = () => setOnTeam(onTeamCached());
    window.addEventListener('break:team', sync);
    const code = pendingJoin();
    // An invite opened before signing in some other way: finish it now. Not over a join route,
    // which handles its own, and not offline, where it would be dropped for nothing.
    if (currentSession() && code && online() && !window.location.hash.startsWith('#/join/')) {
      joinTeam(code, accountName())
        .then(() => rememberOnTeam(true))
        .catch(() => undefined)
        .finally(() => rememberJoin(null));
    } else if (currentSession()) {
      // Kept for the Team tab, so its first open this visit is already filled in.
      loadTeams()
        .then((v) => {
          remember('teams', v);
          if (v.teams.length) return loadFeed().then((f) => remember('feed', f));
        })
        .catch(() => undefined);
    }
    return () => window.removeEventListener('break:team', sync);
  }, []);
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

  // A link keeps the scroll of the page it left, which opened long pages with their back link
  // off screen. Layout effect, so a page scrolling itself to a hole in its own effect still wins.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  const hasRun = !!state.run;
  useEffect(() => {
    if (!hasRun) return;
    // A walked-away session stops here. Its drills are already saved, so ending it loses nothing.
    const check = () => {
      const run = latest.current.run;
      if (run && runLapsed(run, Date.now())) dispatch({ t: 'endRun' });
    };
    check();
    const id = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [hasRun, dispatch]);

  useEffect(() => {
    if (!state.practice.length) return;
    const id = setTimeout(() => {
      void unpublishPractice(
        state.tombstones
          .filter((t) => t.kind === 'practice')
          .sort((a, b) => b.at.localeCompare(a.at))
          .slice(0, 50)
          .map((t) => t.id),
      );
      void publishPractice(practiceForTeam(state));
    }, 1500);
    return () => clearTimeout(id);
  }, [state]);

  useEffect(() => {
    // Any round at all, live included: a new teammate's first round should show on the live strip
    // while they play it, not only once they have finished one.
    if (!state.rounds.length) return;
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
          <h1 className="wordmark">
            BREAK<span className="wordmark-mark">!</span>
          </h1>
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
  const joinMatch = route.match(/^\/join\/([A-Za-z0-9]{4,8})$/);
  const teamRoundMatch = route.match(/^\/team\/round\/([0-9a-f-]{36})\/([^/]+)$/);
  const teamLiveMatch = route.match(/^\/team\/live\/([0-9a-f-]{36})$/);
  const teamDayMatch = route.match(/^\/team\/practice\/([0-9a-f-]{36})\/(\d{4}-\d{2}-\d{2})$/);
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
  ) : route === '/practice/replay' || route.startsWith('/practice/replay/') ? (
    <Replay key={route} roundId={route.startsWith('/practice/replay/') ? route.slice(17) : undefined} />
  ) : route === '/practice/log' ? (
    <PracticeLogPage />
  ) : route === '/practice/why' ? (
    <PracticeWhy />
  ) : route === '/practice/tempo' ? (
    <Tempo />
  ) : roundMatch ? (
    <RoundDetail id={roundMatch[1]} openHole={roundMatch[2] ? Number(roundMatch[2]) : undefined} />
  ) : staleTrack ? (
    afterTrack(state) === '/practice' ? (
      <Practice />
    ) : (
      <Rounds />
    )
  ) : route === '/track' ? (
    <Track />
  ) : route === '/stats' || route === '/stats/practice' ? (
    <Stats key={route} practice={route === '/stats/practice'} />
  ) : route.startsWith('/stats/p/') && route.slice(9) in PRACTICE_TOPICS ? (
    <Stats key={route} practice practiceTopic={route.slice(9) as PracticeTopic} />
  ) : ['/stats/t/improving', '/stats/t/form', '/stats/t/work'].includes(route) ? (
    // Those three pages are one now. Old links and bookmarks land on it.
    <Stats key="/stats/t/progress" topic="progress" />
  ) : route.startsWith('/stats/t/') && route.slice(9) in TOPICS ? (
    <Stats key={route} topic={route.slice(9) as Topic} />
  ) : route === '/practice' ? (
    <Practice />
  ) : route === '/practice/test' ? (
    <Practice openTest />
  ) : teamRoundMatch ? (
    <TeamRoundPage key={route} user={teamRoundMatch[1]} roundId={decodeURIComponent(teamRoundMatch[2])} />
  ) : teamLiveMatch ? (
    <TeamLivePage key={route} user={teamLiveMatch[1]} />
  ) : teamDayMatch ? (
    <TeamPracticePage key={route} user={teamDayMatch[1]} date={teamDayMatch[2]} />
  ) : route === '/team' || joinMatch ? (
    <Team joinCode={joinMatch?.[1]} />
  ) : route === '/settings' ? (
    <Settings />
  ) : route === '/privacy' ? (
    <Privacy />
  ) : route === '/terms' ? (
    <Terms />
  ) : route === '/history' || route === '/moments' ? (
    <HistoryPage />
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
          : route.startsWith('/stats/p/')
            ? 'Practice'
            : route.startsWith('/stats/t/')
              ? 'Stats'
              : route.startsWith('/practice')
                ? 'Practice'
                : route.startsWith('/team') || joinMatch
                  ? 'Team'
                  : route === '/settings' || route === '/privacy' || route === '/terms'
                    ? 'Settings'
                    : route === '/history' || route === '/moments'
                      ? 'History'
                      : 'Putting';

  return (
    <div className="app">
      <div className="topbar">
        <h1 className="wordmark">
            BREAK<span className="wordmark-mark">!</span>
          </h1>
        <span className="sub">{sub}</span>
      </div>
      <main className="main" key={tabTap}>
        {page}
      </main>
      <nav className="nav">
        {tabsFor(!!live, onTeam).map((t) => {
          const here = route.startsWith('/practice')
            ? '/practice'
            : route.startsWith('/stats')
              ? '/stats'
              : route.startsWith('/team')
                ? onTeam
                  ? '/team'
                  : '/settings'
                : route === '/privacy' || route === '/terms'
                  ? '/settings'
                  : route;
          const on =
            t.path === '/'
              ? here === '/' || here === '/moments' || here === '/history' || here.startsWith('/round/')
              : here === t.path;
          return (
            <a
              key={t.path}
              href={`#${t.path}`}
              className={on ? 'on' : undefined}
              onClick={(e) => {
                e.preventDefault();
                // Another tab: just go there. The tab you are on: start it over at its home view.
                if (on) {
                  setTabTap((n) => n + 1);
                  window.scrollTo(0, 0);
                }
                go(t.path);
              }}
            >
              {t.label}
              {t.path === '/track' && live && <span className="dot" aria-label="round in progress" />}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
