import { useEffect, useMemo, useState } from 'react';
import { playerWeeks, teamLeak } from '../lib/coach';
import { fmtDate, signed } from '../lib/format';
import { FOCUS, findFocus } from '../lib/starters';
import { lastLoaded, remember } from '../lib/lastLoaded';
import { loadCoach, setFocus, type Focus, type PlayerStats, type TeamRound } from '../lib/teams';
import { DEFAULT_BASELINE } from '../lib/types';
import type { TeamPracticeRow } from '../lib/feed';
import { Sheet } from './Sheet';

const QUIET_DAYS = 7;

/**
 * Everything a coach needs from one screen, and nothing for them to log: where the team loses
 * strokes, one tap to make that the week's practice, and who is doing the work.
 */
export function CoachView({
  team,
  players,
  stats,
}: {
  team: { id: string; name: string };
  players: { id: string; name: string }[];
  stats: PlayerStats[];
}) {
  const [data, setData] = useState<{ rounds: TeamRound[]; practice: TeamPracticeRow[]; focus: Focus | null } | null>(
    () => lastLoaded(`coach:${team.id}`) ?? null,
  );
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    loadCoach(team.id)
      .then((d) => setData(remember(`coach:${team.id}`, d)))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load the team.'));
  }, [team.id]);

  const ids = useMemo(() => players.map((p) => p.id), [players]);
  const leak = useMemo(() => (data ? teamLeak(data.rounds, ids, DEFAULT_BASELINE) : null), [data, ids]);
  const weeks = useMemo(
    () => (data ? playerWeeks(ids, data.rounds, data.practice, stats, data.focus) : []),
    [data, ids, stats],
  );

  if (err) return <p className="small neg">{err}</p>;
  if (!data) return <p className="small muted">Loading the team…</p>;

  const name = (id: string) => players.find((p) => p.id === id)?.name ?? 'A player';
  const focus = findFocus(data.focus?.session);
  const suggested = leak ? FOCUS.find((f) => f.band === leak.worst.key)! : null;
  const practiced = weeks.filter((w) => w.sets > 0).length;
  const putts = weeks.reduce((a, w) => a + w.putts, 0);
  const roundsThisWeek = weeks.reduce((a, w) => a + w.rounds, 0);
  const did = weeks.filter((w) => w.didFocus);
  const leakRounds = data.rounds.filter((r) => ids.includes(r.user_id) && r.played_on);
  const span = leakRounds.length
    ? `${fmtDate(leakRounds[leakRounds.length - 1].played_on!)} to ${fmtDate(leakRounds[0].played_on!)}`
    : '';

  const pick = async (session: string) => {
    setBusy(true);
    setErr('');
    try {
      await setFocus(team.id, session);
      setData({ ...data, focus: { team_id: team.id, session, set_at: new Date().toISOString() } });
      setPicking(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not set the week.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="coach">
      <div className="field-label">Where the team loses strokes</div>
      {leak ? (
        <div className="coach-leak">
          <p className="coach-leak-head">
            {leak.worst.label}. {Math.abs(leak.worst.per18).toFixed(1)} strokes a round against tour averages.
          </p>
          <p className="coach-leak-sub">
            From {leak.rounds} rounds, {span}.{' '}
            {leak.players > 1 && `${leak.sharing} of ${leak.players} players have it as their biggest leak.`}
          </p>
          <div className="coach-bands">
            {leak.bands.map((b) => (
              <div key={b.key} className={b.key === leak.worst.key ? 'coach-band worst' : 'coach-band'}>
                <span>{b.label}</span>
                <span className="num">{signed(b.per18, 1)}</span>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            Strokes per 18 holes, by where the first putt started. A three-putt from 40 feet counts at 40 feet.
          </p>
        </div>
      ) : (
        <p className="small muted">
          Shows once the team has logged two rounds with putt lengths. Every round a player logs counts.
        </p>
      )}

      <div className="field-label">This week's practice</div>
      <div className="coach-focus">
        {focus ? (
          <>
            <p className="coach-focus-name">{focus.name}</p>
            <p className="small muted" style={{ margin: '2px 0 0' }}>
              Set {fmtDate(data.focus!.set_at.slice(0, 10))}. It sits at the top of every player's Practice.
            </p>
            <p className="coach-focus-did">
              {did.length
                ? `Done by ${did.map((w) => name(w.user)).join(', ')}. ${did.length} of ${players.length}.`
                : `Nobody has run it yet. 0 of ${players.length}.`}
            </p>
          </>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            Nothing set. Pick one and every player sees it first thing on Practice.
          </p>
        )}
        {suggested && focus?.id !== suggested.id && (
          <button className="btn btn-primary btn-wide" disabled={busy} onClick={() => void pick(suggested.id)}>
            Make it this week's practice
          </button>
        )}
        <button className="btn btn-wide" style={{ marginTop: 8 }} onClick={() => setPicking(true)}>
          {focus ? 'Change it' : 'Pick a session'}
        </button>
      </div>

      <div className="field-label">Last 7 days</div>
      <div className="coach-week">
        <span>
          <b className="num">
            {practiced} of {players.length}
          </b>
          practiced
        </span>
        <span>
          <b className="num">{putts}</b>practice putts
        </span>
        <span>
          <b className="num">{roundsThisWeek}</b>
          {roundsThisWeek === 1 ? 'round' : 'rounds'}
        </span>
      </div>

      <div className="field-label">Players</div>
      <div className="coach-table">
        <div className="coach-row coach-row-head">
          <span>Last 7 days</span>
          <span>Rounds</span>
          <span>Putts</span>
          <span>Test</span>
          <span>Trend</span>
        </div>
        {weeks
          .slice()
          .sort((a, b) => b.putts - a.putts || b.rounds - a.rounds || name(a.user).localeCompare(name(b.user)))
          .map((w) => (
            <div key={w.user} className="coach-row">
              <span className="coach-name">
                {name(w.user)}
                {w.quiet === null ? (
                  <small>Nothing logged yet</small>
                ) : w.quiet >= QUIET_DAYS ? (
                  <small className="quiet">Quiet {w.quiet} days</small>
                ) : null}
              </span>
              <span className="num">{w.rounds || '·'}</span>
              <span className="num">{w.putts || '·'}</span>
              <span className="num">{w.test ? `${w.test.made}/${w.test.attempts}` : '·'}</span>
              <span
                className={w.trend === null || Math.abs(w.trend) < 0.05 ? 'num' : w.trend > 0 ? 'num pos' : 'num neg'}
              >
                {w.trend === null ? '·' : signed(w.trend, 1)}
              </span>
            </div>
          ))}
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>
        Test is the newest weekly test. Trend is strokes gained per round over the last 30 days against that player's
        season. Nobody logs anything for this screen. It is built from what players log.
      </p>

      {picking && (
        <Sheet title="This week's practice" onClose={() => setPicking(false)}>
          <p className="small muted" style={{ margin: '0 0 8px' }}>
            Fifteen minutes, three drills, fitted to each player's room.
          </p>
          <div className="menu">
            {FOCUS.map((f) => (
              <button key={f.id} aria-current={f.id === focus?.id} disabled={busy} onClick={() => void pick(f.id)}>
                <span className="menu-row">
                  {f.name}
                  {f.id === suggested?.id && <small className="muted"> · the team's leak</small>}
                </span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </section>
  );
}
