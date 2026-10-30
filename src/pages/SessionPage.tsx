import { BackLink } from '../components/BackLink';
import { useState } from 'react';
import { ConfirmButton } from '../components/ConfirmButton';
import { DrillLogger } from '../components/DrillLogger';
import { useNow } from '../components/useNow';
import { distanceText, fits, fitToRoom, resolveDrill } from '../lib/drills';
import { clock, setScore } from '../lib/practiceView';
import { go } from '../lib/router';
import { usePractice } from '../lib/usePractice';
import { SURFACE_LABELS } from '../lib/types';

export function SessionPage({ id }: { id: string }) {
  const { state, dispatch, surface, room } = usePractice();
  const [open, setOpen] = useState<number | null>(null);
  const session = state.sessions.find((x) => x.id === id);
  const run = state.run?.session === id ? state.run : undefined;
  const now = useNow(!!run, 1000);

  if (!session) {
    return (
      <div className="empty">
        That session is gone. <a href="#/practice">Back to Practice</a>
      </div>
    );
  }

  const blocks = session.blocks.map((b) => {
    const drill = resolveDrill(state, b.drill);
    const usable = !!drill && (!drill.putting || fits(drill, run?.surface ?? surface));
    const minutes = b.minutes ?? drill?.minutes;
    const setId = run?.done[session.blocks.indexOf(b)];
    const set = setId ? state.practice.find((s) => s.id === setId) : undefined;
    return { b, drill, usable, minutes, set };
  });
  const total = blocks.reduce((n, x) => n + (x.minutes ?? 0), 0);
  const elapsed = run ? (now - Date.parse(run.startedAt)) / 1000 : 0;
  const cur = run ? blocks[run.block] : undefined;
  const blockLeft = run && cur?.minutes ? cur.minutes * 60 - (now - Date.parse(run.blockStartedAt)) / 1000 : null;
  const finished = run && run.block >= blocks.length;
  const nextIndex = (from: number) => blocks.findIndex((x, i) => i > from && !run?.done[i] && x.usable);

  const start = () => dispatch({ t: 'startRun', session: id, surface });

  return (
    <div>
      <div className="page-top">
        <BackLink />
        <a href={`#/practice/session-edit/${id}`} className="back-link">
          Edit
        </a>
      </div>
      <h1 className="page-title">{session.name}</h1>
      <p className="small muted" style={{ margin: '2px 0 0' }}>
        {blocks.length} blocks{total ? ` · ${total} min` : ''} · {SURFACE_LABELS[run?.surface ?? surface]}, up to {room} ft
      </p>

      {run && (
        <div className="run-clock">
          <span className="run-big num">{clock(elapsed)}</span>
          {total > 0 && <span className="muted">of {clock(total * 60)}</span>}
          <div className="run-bar" role="img" aria-label="Session progress by block">
            {blocks.map((x, i) => (
              <i
                key={i}
                style={{ flex: x.minutes || 5 }}
                className={run.done[i] ? 'done' : i === run.block ? 'now' : undefined}
              />
            ))}
          </div>
        </div>
      )}

      <ol className="blocks">
        {blocks.map((x, i) => {
          const isNow = run && i === run.block;
          const done = !!x.set;
          return (
            <li key={i} className={isNow ? 'now' : done ? 'done' : !x.usable ? 'off' : undefined}>
              <span className="block-mark" aria-hidden="true">
                {done ? '✓' : ''}
              </span>
              <button
                className="block-main"
                disabled={!x.drill || !x.usable}
                onClick={() => (run ? setOpen(i) : x.drill && go(`/practice/drill/${x.drill.from ?? x.drill.id}`))}
              >
                <strong>{x.drill?.name ?? 'Missing drill'}</strong>
                <span className="small muted">
                  {done
                    ? setScore(x.drill, x.set!)
                    : !x.usable
                      ? 'Needs a green'
                      : x.drill
                        ? distanceText(fitToRoom(x.drill, room))
                        : ''}
                </span>
              </button>
              <span className="small muted num">
                {isNow && blockLeft !== null ? (
                  <span className={blockLeft < 0 ? 'over' : 'left'}>{clock(Math.abs(blockLeft))}{blockLeft < 0 ? ' over' : ' left'}</span>
                ) : x.minutes ? (
                  `${x.minutes} min`
                ) : (
                  ''
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {!run && (
        <div className="btn-row" style={{ marginTop: 18 }}>
          <button className="btn btn-primary" onClick={start}>
            Start session
          </button>
        </div>
      )}
      {run && !finished && cur && (
        <div className="btn-row" style={{ marginTop: 18 }}>
          <button
            className="btn"
            onClick={() => {
              const n = nextIndex(run.block);
              dispatch({ t: 'goToBlock', block: n === -1 ? blocks.length : n });
            }}
          >
            Skip
          </button>
          <button className="btn btn-primary" disabled={!cur.usable} onClick={() => setOpen(run.block)}>
            {cur.drill?.name ? `Roll ${cur.drill.name}` : 'Roll it'}
          </button>
        </div>
      )}
      {run && (
        <div className="btn-row" style={{ marginTop: 10 }}>
          <ConfirmButton
            label={finished ? 'Finish session' : 'End session'}
            confirmLabel="End it?"
            className={finished ? 'btn btn-primary' : 'btn btn-ghost'}
            onConfirm={() => {
              dispatch({ t: 'endRun' });
              go('/practice');
            }}
          />
        </div>
      )}

      {open !== null && blocks[open]?.drill && (() => {
        const fitted = fitToRoom(blocks[open].drill!, room);
        const n = nextIndex(open);
        return (
          <DrillLogger
            key={open}
            drill={fitted}
            surface={run?.surface ?? surface}
            session={id}
            next={n === -1 ? 'Back to the session' : `Next: ${blocks[n].drill?.name ?? 'next block'}`}
            onNext={() => {
              if (n !== -1) dispatch({ t: 'goToBlock', block: n });
              setOpen(n === -1 ? null : n);
            }}
            onSaved={(set) => dispatch({ t: 'finishBlock', block: open, setId: set.id })}
            onClose={() => setOpen(null)}
          />
        );
      })()}
    </div>
  );
}
