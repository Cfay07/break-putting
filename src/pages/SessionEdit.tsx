import { useState } from 'react';
import { ConfirmButton } from '../components/ConfirmButton';
import { Sheet } from '../components/Sheet';
import { allDrills, distanceText, resolveDrill } from '../lib/drills';
import { go, replaceRoute } from '../lib/router';
import { newId } from '../lib/storage';
import { useApp } from '../lib/store';
import type { DrillDef, SessionDef } from '../lib/types';

const GROUPS: { k: DrillDef['source']; label: string }[] = [
  { k: 'mine', label: 'Yours' },
  { k: 'import', label: 'Imported' },
  { k: 'app', label: "BREAK!'s" },
];

export function SessionEdit({ id }: { id: string }) {
  const { state, dispatch } = useApp();
  const original = id === 'new' ? undefined : state.sessions.find((x) => x.id === id);
  const [s, setS] = useState<SessionDef>(() =>
    original ? structuredClone(original) : { id: newId(), name: '', blocks: [], source: 'mine' },
  );
  const [adding, setAdding] = useState(false);

  if (id !== 'new' && !original) {
    return (
      <div className="empty">
        That session is gone. <a href="#/practice">Back to Practice</a>
      </div>
    );
  }

  const blocks = s.blocks;
  const setBlocks = (b: SessionDef['blocks']) => setS({ ...s, blocks: b });
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };
  const total = blocks.reduce((n, b) => n + (b.minutes ?? 0), 0);
  const save = () => {
    dispatch({ t: 'saveSession', session: { ...s, name: s.name.trim() || 'My session' } });
    go(`/practice/session/${s.id}`);
  };
  const drills = allDrills(state);

  return (
    <div>
      <div className="page-top">
        <a href={original ? `#/practice/session/${id}` : '#/practice'} className="back-link">
          Cancel
        </a>
        <button className="btn btn-primary save-top" disabled={!blocks.length} onClick={save}>
          Save
        </button>
      </div>
      <h1 className="page-title">{original ? 'Edit session' : 'New session'}</h1>

      <label className="field">
        <span className="field-label">Name</span>
        <input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="Dorm mat, 20 min" />
      </label>

      <span className="field-label">
        Blocks{total ? ` · ${total} min` : ''}
      </span>
      <div className="edit-rows">
        {blocks.map((b, i) => {
          const d = resolveDrill(state, b.drill);
          return (
            <div key={i} className="block-edit">
              <span className="block-edit-main">
                <strong>{d?.name ?? 'Missing drill'}</strong>
                <span className="small muted">{d ? distanceText(d) : ''}</span>
              </span>
              <span className="mini-step">
                <button aria-label="Fewer minutes" disabled={!b.minutes} onClick={() => setBlocks(blocks.map((x, j) => (j === i ? { ...x, minutes: Math.max(0, (x.minutes ?? 0) - 1) || undefined } : x)))}>
                  −
                </button>
                <span className="num">
                  {b.minutes ?? 0}
                  <span className="muted"> min</span>
                </span>
                <button aria-label="More minutes" onClick={() => setBlocks(blocks.map((x, j) => (j === i ? { ...x, minutes: (x.minutes ?? 0) + 1 } : x)))}>
                  +
                </button>
              </span>
              <span className="block-edit-tools">
                <button className="linkish small" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  Up
                </button>
                <button className="linkish small" aria-label="Move down" disabled={i === blocks.length - 1} onClick={() => move(i, 1)}>
                  Down
                </button>
                <button className="linkish small muted" onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <button className="btn btn-ghost btn-wide" style={{ marginTop: 10 }} onClick={() => setAdding(true)}>
        Add a drill
      </button>

      <div className="btn-row" style={{ marginTop: 22 }}>
        {original && (
          <ConfirmButton
            label="Delete session"
            confirmLabel="Delete it?"
            onConfirm={() => {
              dispatch({ t: 'deleteSession', id: original.id });
              replaceRoute('/practice');
            }}
          />
        )}
        <button className="btn btn-primary" disabled={!blocks.length} onClick={save}>
          Save
        </button>
      </div>

      {adding && (
        <Sheet title="Add a drill" onClose={() => setAdding(false)}>
          {GROUPS.map((g) => {
            const list = drills.filter((d) => d.source === g.k);
            if (!list.length) return null;
            return (
              <div key={g.k}>
                <h2 style={{ marginTop: 12 }}>{g.label}</h2>
                <div className="menu">
                  {list.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setBlocks([...blocks, { drill: d.from ?? d.id, minutes: d.minutes }]);
                        setAdding(false);
                      }}
                    >
                      <span className="menu-row">
                        {d.name}
                        <span className="small muted" style={{ display: 'block', fontWeight: 400 }}>
                          {distanceText(d)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </Sheet>
      )}
    </div>
  );
}
