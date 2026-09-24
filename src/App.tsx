import { Rounds } from './pages/Rounds';
import { RoundDetail } from './pages/RoundDetail';
import { Settings } from './pages/Settings';
import { Stats } from './pages/Stats';
import { Track } from './pages/Track';
import { useEffect } from 'react';
import { useRoute } from './lib/router';
import { syncQuietly } from './lib/sync';
import { liveRound, useApp } from './lib/store';

const TABS = [
  { path: '/', label: 'Rounds' },
  { path: '/track', label: 'Track' },
  { path: '/stats', label: 'Stats' },
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

  const roundMatch = route.match(/^\/round\/(.+)$/);
  const page = roundMatch ? (
    <RoundDetail id={roundMatch[1]} />
  ) : route === '/track' ? (
    <Track />
  ) : route === '/stats' ? (
    <Stats />
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
        : route === '/settings'
          ? 'Settings'
          : 'Putting';

  return (
    <div className="app">
      <div className="topbar">
        <h1 className="wordmark">BREAK!</h1>
        <span className="sub">{sub}</span>
      </div>
      {page}
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
