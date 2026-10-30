import { useEffect, useState } from 'react';
import type { Fitted } from '../lib/drills';
import { clock, MODE_WORDS, ON_MISS_TEXT, tallyStations } from '../lib/practiceView';
import { stationName } from './CountLogger';
import type { LoggerProps } from './DrillLogger';
import { useNow } from './useNow';

interface LadderState {
  at: number;
  made: number;
  tries: number;
  /** Most stations cleared in a row at any point. */
  best: number;
  fails: number;
  finished: boolean;
  /** The attempt is over without finishing: a failed station on an "end" ladder. */
  over: boolean;
}

/**
 * Where a ladder stands after these taps. Rebuilt from the taps every time rather than stepped,
 * so Undo is just dropping the last tap and can never leave the ladder in a state it could not
 * have reached.
 */
export function replayLadder(drill: Pick<Fitted, 'stations' | 'onMiss' | 'checkpoints'>, hits: boolean[]): LadderState {
  const st: LadderState = { at: 0, made: 0, tries: 0, best: 0, fails: 0, finished: false, over: false };
  for (const hit of hits) {
    if (st.finished || st.over) break;
    const s = drill.stations[st.at];
    const need = s.need ?? s.balls;
    st.tries++;
    if (hit) st.made++;
    if (st.made >= need) {
      st.at++;
      st.best = Math.max(st.best, st.at);
      st.made = 0;
      st.tries = 0;
      if (st.at === drill.stations.length) st.finished = true;
      continue;
    }
    if (s.balls - st.tries >= need - st.made) continue;
    st.fails++;
    st.made = 0;
    st.tries = 0;
    switch (drill.onMiss ?? 'end') {
      case 'end':
        st.over = true;
        break;
      case 'restart':
        st.at = 0;
        break;
      case 'checkpoint':
        st.at = Math.max(0, ...(drill.checkpoints ?? [0]).filter((c) => c <= st.at));
        break;
      case 'back':
        st.at = Math.max(0, st.at - 1);
        break;
      case 'stay':
        break;
    }
  }
  return st;
}

export function LadderLogger({ drill, onSave }: LoggerProps) {
  const [hits, setHits] = useState<boolean[]>([]);
  const [started, setStarted] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const now = useNow(started !== null && !!drill.limit);
  const st = replayLadder(drill, hits);
  const left = drill.limit && started !== null ? drill.limit * 60 - (now - started) / 1000 : null;

  const finish = (all: boolean[], timedOut = false) => {
    const end = replayLadder(drill, all);
    const queue: { d: number; mode: 'make' | 'twoputt' | 'zone'; made: boolean }[] = [];
    // Walk the taps again to know which station each ball was hit from.
    let probe: boolean[] = [];
    for (const hit of all) {
      const at = replayLadder(drill, probe).at;
      const s = drill.stations[Math.min(at, drill.stations.length - 1)];
      queue.push({ d: s.d, mode: s.mode ?? 'make', made: hit });
      probe = [...probe, hit];
    }
    onSave({
      made: all.filter(Boolean).length,
      attempts: all.length,
      reached: end.finished ? drill.stations.length : end.best,
      finished: end.finished && !timedOut,
      seconds: started !== null ? Math.round((Date.now() - started) / 1000) : undefined,
      stations: tallyStations(queue),
    });
  };

  const timedOut = left !== null && left <= 0 && !st.finished && !st.over;
  useEffect(() => {
    if (timedOut) finish(hits, true);
    // Fires once, the moment the clock runs out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOut]);

  const tap = (hit: boolean) => {
    if (started === null) setStarted(Date.now());
    const next = [...hits, hit];
    setHits(next);
    const after = replayLadder(drill, next);
    if (after.finished || after.over) finish(next);
  };

  if (picking) {
    return (
      <div className="runner-body">
        <p className="small muted">How far did you get?</p>
        <div className="focus-drills">
          {drill.stations.map((s, i) => (
            <button
              key={i}
              className="focus-drill"
              onClick={() =>
                onSave({ made: 0, attempts: 0, reached: i + 1, finished: i + 1 === drill.stations.length })
              }
            >
              <span>
                <strong>Cleared {stationName(s)}</strong>
              </span>
            </button>
          ))}
          <button
            className="focus-drill"
            onClick={() => onSave({ made: 0, attempts: 0, reached: 0, finished: false })}
          >
            <span>Did not clear the first one</span>
          </button>
        </div>
        <button className="linkish small muted runner-link" onClick={() => setPicking(false)}>
          Count it ball by ball instead
        </button>
      </div>
    );
  }

  const cur = drill.stations[Math.min(st.at, drill.stations.length - 1)];
  const need = cur.need ?? cur.balls;
  const mode = cur.mode ?? 'make';

  return (
    <div className="runner-body">
      <p className="small muted">
        {drill.how} {ON_MISS_TEXT[drill.onMiss ?? 'end']}
      </p>
      <ol className="ladder">
        {drill.stations.map((s, i) => {
          const done = i < st.at;
          const on = i === st.at;
          const need = s.need ?? s.balls;
          return (
            <li key={i} className={on ? 'on' : done ? 'done' : undefined}>
              <span className="ladder-d num">{stationName(s)}</span>
              <span className="ladder-need">{need === s.balls ? `${need} in a row` : `${need} of ${s.balls}`}</span>
              <span className="ladder-dots">
                {Array.from({ length: Math.min(s.balls, 10) }, (_, b) => (
                  <i key={b} className={done || (on && b < st.made) ? 'in' : undefined} />
                ))}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="runner-meta">
        <span>
          {cur.d} ft: {st.made} of {need} needed, {cur.balls - st.tries} balls left
        </span>
        {st.fails > 0 && <span>{st.fails} reset{st.fails === 1 ? '' : 's'}</span>}
        {left !== null && <span className="num">{clock(left)} left</span>}
      </div>
      <div className="runner-btns">
        <button className="runner-no" onClick={() => tap(false)}>
          {MODE_WORDS[mode].no}
        </button>
        <button className="runner-yes" onClick={() => tap(true)}>
          {MODE_WORDS[mode].yes}
        </button>
      </div>
      <div className="runner-foot">
        <button className="linkish small muted" disabled={!hits.length} onClick={() => setHits(hits.slice(0, -1))}>
          Undo
        </button>
        {hits.length > 0 ? (
          <button className="btn" onClick={() => finish(hits)}>
            End here
          </button>
        ) : (
          <button className="linkish small muted" onClick={() => setPicking(true)}>
            Just say how far I got
          </button>
        )}
      </div>
    </div>
  );
}
