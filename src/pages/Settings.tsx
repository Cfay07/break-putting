import { BUILT_IN_COURSES } from '../lib/builtInCourses';
import { dedupeCourses } from '../lib/gameHcp';
import { useRef, useState, type ReactNode } from 'react';
import { Account } from '../components/Account';
import { ConfirmButton } from '../components/ConfirmButton';
import { NameField } from '../components/NameField';
import { OldRoundImport } from '../components/OldRoundImport';
import { PracticeImport } from '../components/PracticeImport';
import { Sheet } from '../components/Sheet';
import { accountName, currentSession } from '../lib/cloud';
import { fmtDate, today } from '../lib/format';
import { newId } from '../lib/storage';
import { lastSyncedAt } from '../lib/sync';
import { useApp } from '../lib/store';
import { DEFAULT_BASELINE, type AppState } from '../lib/types';

type Open =
  | { k: 'name' | 'account' | 'addPutter' | 'practice' | 'oldRound' | 'baseline' }
  | { k: 'putter'; id: string }
  | { k: 'course'; id: string };

function Row({ title, sub, end, onClick }: { title: ReactNode; sub?: ReactNode; end?: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <span className="list-main">
        <span className="list-title">{title}</span>
        {sub && <span className="list-sub">{sub}</span>}
      </span>
      {end ?? (onClick && <span className="list-chev" aria-hidden="true">›</span>)}
    </>
  );
  return onClick ? (
    <button type="button" className="list-row" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="list-row">{inner}</div>
  );
}

function syncedText(): string {
  const at = lastSyncedAt();
  if (!at) return 'Not synced yet';
  const mins = Math.round((Date.now() - new Date(at).getTime()) / 60000);
  if (mins < 1) return 'Synced just now';
  if (mins < 60) return `Synced ${mins} min ago`;
  if (mins < 60 * 24) return `Synced ${Math.round(mins / 60)} hr ago`;
  return `Synced ${fmtDate(at.slice(0, 10))}`;
}

/**
 * Deleting a putter never deletes putting. Its rounds and practice sets move to the putter you
 * pick first, so the per-putter splits stay true; one with nothing logged just goes.
 */
function PutterDelete({ id, onDone }: { id: string; onDone: () => void }) {
  const { state, dispatch } = useApp();
  const [moveTo, setMoveTo] = useState('');
  const rounds = state.rounds.filter((r) => r.putterId === id).length;
  const others = state.putters.filter((p) => p.id !== id);
  if (rounds > 0 && others.length === 0) {
    return (
      <p className="small" style={{ margin: 0 }}>
        {rounds} {rounds === 1 ? 'round was' : 'rounds were'} putted with this one. Add the putter they belong to
        first, then delete this one.
      </p>
    );
  }
  return (
    <>
      {rounds > 0 && (
        <>
          <p className="small" style={{ margin: '0 0 8px' }}>
            Its {rounds} {rounds === 1 ? 'round moves' : 'rounds move'} to:
          </p>
          <div className="chips chips-sm">
            {others.map((o) => (
              <button key={o.id} className={moveTo === o.id ? 'chip chip-sel' : 'chip'} onClick={() => setMoveTo(o.id)}>
                {o.name}
              </button>
            ))}
          </div>
        </>
      )}
      <ConfirmButton
        label="Delete putter"
        confirmLabel="Tap again to delete"
        className="btn btn-danger btn-wide"
        style={{ marginTop: 12, ...(rounds > 0 && !moveTo ? { opacity: 0.4, pointerEvents: 'none' } : {}) }}
        onConfirm={() => {
          dispatch({ t: 'deletePutter', id, moveTo: rounds > 0 ? moveTo : undefined });
          onDone();
        }}
      />
    </>
  );
}

function PutterSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const [deleting, setDeleting] = useState(false);
  const p = state.putters.find((x) => x.id === id);
  if (!p) return null;
  return (
    <Sheet title={p.name || 'Putter'} onClose={onClose}>
      <div className="field-label" style={{ marginTop: 0 }}>Name</div>
      <input
        type="text"
        aria-label="putter name"
        value={p.name}
        onChange={(e) => dispatch({ t: 'renamePutter', id: p.id, name: e.target.value })}
      />
      <div className="btn-row" style={{ marginTop: 14 }}>
        {!p.active && !p.retired && (
          <button className="btn" onClick={() => dispatch({ t: 'setActivePutter', id: p.id })}>
            Put in the bag
          </button>
        )}
        <button className="btn" onClick={() => dispatch({ t: 'retirePutter', id: p.id, retired: !p.retired })}>
          {p.retired ? 'Unretire' : 'Retire'}
        </button>
      </div>
      <div style={{ marginTop: 20 }}>
        {deleting ? (
          <PutterDelete id={p.id} onDone={onClose} />
        ) : (
          <button className="text-btn text-danger" onClick={() => setDeleting(true)}>
            Delete this putter
          </button>
        )}
      </div>
    </Sheet>
  );
}

function AddPutterSheet({ onClose }: { onClose: () => void }) {
  const { dispatch } = useApp();
  const [name, setName] = useState('');
  const add = () => {
    dispatch({ t: 'addPutter', id: newId(), name });
    onClose();
  };
  return (
    <Sheet title="Add a putter" onClose={onClose}>
      <input type="text" value={name} placeholder="Cobra Stingray" onChange={(e) => setName(e.target.value)} />
      <button className="btn btn-primary btn-wide" style={{ marginTop: 12 }} disabled={!name.trim()} onClick={add}>
        Add putter
      </button>
    </Sheet>
  );
}

function BaselineSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp();
  return (
    <Sheet title="Expected putts baseline" onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Strokes gained compares your hole to these numbers. Edit them if you want a different bar than scratch.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Feet</th>
              <th>Expected putts</th>
            </tr>
          </thead>
          <tbody>
            {state.baseline.map(([feet, exp], i) => (
              <tr key={feet}>
                <td>{feet}</td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={exp}
                    className="baseline-input"
                    onChange={(e) => {
                      const next = state.baseline.map(
                        (row, j) => (j === i ? [row[0], Number(e.target.value)] : row) as [number, number],
                      );
                      dispatch({ t: 'setBaseline', baseline: next });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="btn btn-wide"
        style={{ marginTop: 10 }}
        onClick={() => dispatch({ t: 'setBaseline', baseline: DEFAULT_BASELINE })}
      >
        Reset to scratch
      </button>
    </Sheet>
  );
}

function CourseSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const c = state.courses.find((x) => x.id === id);
  if (!c) return null;
  const tees = [...new Set(c.tees.map((t) => t.name))];
  return (
    <Sheet title={c.name} onClose={onClose}>
      {c.place && <p className="small muted" style={{ marginTop: 0 }}>{c.place}</p>}
      {tees.length > 0 && (
        <>
          <div className="field-label">Tees</div>
          <p style={{ margin: 0 }}>{tees.join(', ')}</p>
        </>
      )}
      <ConfirmButton
        className="btn btn-danger btn-wide"
        style={{ marginTop: 20 }}
        label="Remove course"
        confirmLabel="Tap again to remove"
        onConfirm={() => {
          dispatch({ t: 'deleteCourse', id: c.id });
          onClose();
        }}
      />
      <p className="small muted">Rounds played there keep their scores and pars.</p>
    </Sheet>
  );
}

export function Settings() {
  const { state, dispatch } = useApp();
  const [open, setOpen] = useState<Open | null>(null);
  const close = () => setOpen(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoreNote, setRestoreNote] = useState('');
  const [pending, setPending] = useState<{ state: AppState; rounds: number; fresh: number; kept: number } | null>(null);
  const session = currentSession();

  const backUp = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `break-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const readBackup = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppState;
      if (!Array.isArray(parsed.rounds) || !Array.isArray(parsed.putters)) {
        setRestoreNote('That file is not a BREAK! backup.');
        return;
      }
      const incoming = { ...parsed, baseline: parsed.baseline ?? DEFAULT_BASELINE };
      const same = (a: { date: string; holeCount: number }, b: { date: string; holeCount: number }) =>
        a.date === b.date && a.holeCount === b.holeCount;
      const fresh = incoming.rounds.filter((r) => !state.rounds.some((x) => x.id === r.id || same(x, r))).length;
      const kept = state.rounds.filter((x) => !incoming.rounds.some((r) => r.id === x.id || same(x, r))).length;
      setPending({ state: incoming, rounds: incoming.rounds.length, fresh, kept });
      setRestoreNote('');
    } catch {
      setRestoreNote('Could not read that file.');
    }
  };

  const putters = state.putters.slice().sort((a, b) => Number(a.retired) - Number(b.retired) || Number(b.active) - Number(a.active));
  const newest = state.rounds.length ? state.rounds.reduce((a, b) => (a.date > b.date ? a : b)).date : null;

  return (
    <>
      <h2>You</h2>
      <div className="list">
        {session ? (
          <>
            <Row title={accountName() || 'Add your name'} sub="Name on every team board" onClick={() => setOpen({ k: 'name' })} />
            <Row title={session.email} sub={syncedText()} onClick={() => setOpen({ k: 'account' })} />
          </>
        ) : (
          <Row title="Sign in" sub="Back up your rounds and use them on another phone" onClick={() => setOpen({ k: 'account' })} />
        )}
      </div>

      <h2>Putters</h2>
      <div className="list">
        {putters.map((p) => (
          <Row
            key={p.id}
            title={p.name}
            end={p.active ? <span className="list-pill">In the bag</span> : p.retired ? <span className="list-pill off">Retired</span> : undefined}
            onClick={() => setOpen({ k: 'putter', id: p.id })}
          />
        ))}
        <Row title={<span className="list-add">Add a putter</span>} onClick={() => setOpen({ k: 'addPutter' })} />
      </div>

      <h2>While you play</h2>
      <div className="list">
        <Row
          title="Hide score on the Track screen"
          sub="For competitive rounds. Every stat still works out afterwards."
          end={
            <button
              type="button"
              role="switch"
              className="switch"
              aria-checked={!!state.quietTrack}
              aria-label="Hide score on the Track screen"
              onClick={() => dispatch({ t: 'setQuietTrack', on: !state.quietTrack })}
            />
          }
        />
      </div>

      <h2>Courses</h2>
      <div className="list">
        <Row
          title="Rounds with no tee use the back tees"
          sub="Off, they use the tee closest to the yardage you usually play."
          end={
            <button
              type="button"
              role="switch"
              className="switch"
              aria-checked={!!state.backTees}
              aria-label="Rounds with no tee use the back tees"
              onClick={() => dispatch({ t: 'setBackTees', on: !state.backTees })}
            />
          }
        />
      </div>
      {state.courses.length === 0 ? (
        <p className="small muted">None saved yet. Pick one when you start a round and it gets kept here with its pars.</p>
      ) : (
        <div className="list">
          {dedupeCourses([...state.courses, ...BUILT_IN_COURSES])
            .filter((c) => state.courses.some((s) => s.id === c.id))
            .map((c) => (
              <Row key={c.id} title={c.name} sub={c.place} onClick={() => setOpen({ k: 'course', id: c.id })} />
            ))}
        </div>
      )}
      {/* The open ratings data is ODbL, which requires this credit wherever its numbers are used. */}
      <p className="small muted" style={{ marginTop: 8 }}>
        Some course ratings: © OpenStreetMap contributors (ODbL), via OpenGolfAPI.
      </p>

      <h2 id="imports">Imports</h2>
      <div className="list">
        <Row title="Team practice file" sub="PDF or pasted text" onClick={() => setOpen({ k: 'practice' })} />
        <Row title="Load an old round" sub="Typed out hole by hole" onClick={() => setOpen({ k: 'oldRound' })} />
        <Row title="Expected putts baseline" sub="What strokes gained is measured against" onClick={() => setOpen({ k: 'baseline' })} />
      </div>

      <h2>Backup</h2>
      <div className="list">
        <Row
          title="Back up"
          sub={`${state.rounds.length} ${state.rounds.length === 1 ? 'round' : 'rounds'}${newest ? `, newest ${fmtDate(newest)}` : ''}`}
          onClick={backUp}
        />
        <Row title="Restore from a backup" onClick={() => fileRef.current?.click()} />
      </div>
      <p className="small muted">This phone can lose its storage without warning. Back up after rounds you care about.</p>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) readBackup(f);
          e.target.value = '';
        }}
      />
      {pending && (
        <div className="card card-live" style={{ marginTop: 10 }}>
          <h3>
            That file holds {pending.rounds} {pending.rounds === 1 ? 'round' : 'rounds'}
          </h3>
          <p className="small muted" style={{ margin: '2px 0 12px' }}>
            {pending.fresh} new to this device, {pending.rounds - pending.fresh} covering rounds you already have.{' '}
            {pending.kept} here {pending.kept === 1 ? 'is' : 'are'} not in the file.
          </p>
          {pending.fresh > 0 && (
            <button
              className="btn btn-primary btn-wide"
              onClick={() => {
                dispatch({ t: 'mergeState', state: pending.state });
                setPending(null);
                setRestoreNote(`Added ${pending.fresh}. Nothing here was removed.`);
              }}
            >
              Add the {pending.fresh} new {pending.fresh === 1 ? 'round' : 'rounds'}
            </button>
          )}
          <button
            className={pending.fresh > 0 ? 'btn btn-wide' : 'btn btn-primary btn-wide'}
            style={{ marginTop: pending.fresh > 0 ? 8 : 0 }}
            onClick={() => {
              dispatch({ t: 'updateFromFile', state: pending.state });
              setPending(null);
              setRestoreNote(
                `Updated ${pending.rounds - pending.fresh}, added ${pending.fresh}, kept ${pending.kept} the file did not mention.`,
              );
            }}
          >
            Update matching rounds, keep the rest
          </button>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <ConfirmButton
              className="btn btn-ghost btn-danger"
              label="Replace everything instead"
              confirmLabel="Tap again to wipe and replace"
              onConfirm={() => {
                dispatch({ t: 'replaceState', state: pending.state });
                setPending(null);
                setRestoreNote('Replaced everything on this device.');
              }}
            />
            <button className="btn btn-ghost" style={{ flex: '0 0 auto' }} onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {restoreNote && <p className="small muted">{restoreNote}</p>}

      <div className="settings-foot">
        <ConfirmButton
          className="text-btn text-danger"
          label="Clear all data"
          confirmLabel="Tap again to wipe everything on this phone"
          onConfirm={() => dispatch({ t: 'clearAll' })}
        />
      </div>

      {open?.k === 'name' && (
        <Sheet title="Your name" onClose={close}>
          <NameField first onSaved={close} />
        </Sheet>
      )}
      {open?.k === 'account' && (
        <Sheet title={session ? 'Account' : 'Sign in'} onClose={close}>
          <Account />
        </Sheet>
      )}
      {open?.k === 'putter' && <PutterSheet id={open.id} onClose={close} />}
      {open?.k === 'addPutter' && <AddPutterSheet onClose={close} />}
      {open?.k === 'course' && <CourseSheet id={open.id} onClose={close} />}
      {open?.k === 'practice' && (
        <Sheet title="Team practice file" onClose={close}>
          <PracticeImport />
        </Sheet>
      )}
      {open?.k === 'oldRound' && (
        <Sheet title="Load an old round" onClose={close}>
          <OldRoundImport />
        </Sheet>
      )}
      {open?.k === 'baseline' && <BaselineSheet onClose={close} />}
    </>
  );
}
