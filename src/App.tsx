import { Rounds } from './pages/Rounds';
import { RoundDetail } from './pages/RoundDetail';
import { Settings } from './pages/Settings';
import { Stats } from './pages/Stats';
import { Track } from './pages/Track';
import { useRoute } from './lib/router';
import { liveRound, useApp } from './lib/store';

const TABS = [
  { path: '/', label: 'Rounds' },
  { path: '/track', label: 'Track' },
  { path: '/stats', label: 'Stats' },
  { path: '/settings', label: 'Settings' },
];

export default function App() {
  const route = useRoute();
  const { state } = useApp();
  const live = liveRound(state);

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
        {TABS.map((t) => {
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
