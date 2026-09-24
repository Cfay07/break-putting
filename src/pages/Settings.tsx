import { useRef, useState } from 'react';
import { Account } from '../components/Account';
import { ConfirmButton } from '../components/ConfirmButton';
import { PutterTag } from '../components/PutterTag';
import { parsePaste } from '../lib/importer';
import { fmtDate, today } from '../lib/format';
import { go } from '../lib/router';
import { newId } from '../lib/storage';
import { blankHoles, makeRound, useApp } from '../lib/store';
import { DEFAULT_BASELINE, type AppState } from '../lib/types';

export function Settings() {
  const { state, dispatch } = useApp();
  const [name, setName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [pDate, setPDate] = useState(today);
  const [pCourse, setPCourse] = useState('');
  const [pPutter, setPPutter] = useState(state.putters.find((p) => p.active)?.id ?? '');
  const [pHoles, setPHoles] = useState(18);
  const [paste, setPaste] = useState('');
  const [pScore, setPScore] = useState('');
  const [pCard, setPCard] = useState('');
  const [pasteErrors, setPasteErrors] = useState<string[]>([]);
  const [pasteNotes, setPasteNotes] = useState<string[]>([]);
  const [added, setAdded] = useState<{ id: string; date: string; putts: number } | null>(null);
  const [restoreNote, setRestoreNote] = useState('');
  const [pending, setPending] = useState<{
    state: AppState;
    rounds: number;
    fresh: number;
    kept: number;
  } | null>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `break-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppState;
      if (!Array.isArray(parsed.rounds) || !Array.isArray(parsed.putters)) {
        alert('That file is not a BREAK! backup.');
        return;
      }
      const incoming = { ...parsed, baseline: parsed.baseline ?? DEFAULT_BASELINE };
      const same = (a: { date: string; holeCount: number }, b: { date: string; holeCount: number }) =>
        a.date === b.date && a.holeCount === b.holeCount;
      const fresh = incoming.rounds.filter(
        (r) => !state.rounds.some((x) => x.id === r.id || same(x, r)),
      ).length;
      const kept = state.rounds.filter(
        (x) => !incoming.rounds.some((r) => r.id === x.id || same(x, r)),
      ).length;
      setPending({ state: incoming, rounds: incoming.rounds.length, fresh, kept });
    } catch {
      alert('Could not read that file.');
    }
  };

  const runPaste = () => {
    if (!pPutter) {
      setPasteErrors(['Pick a putter first.']);
      return;
    }
    const { holes, errors, notes } = parsePaste(paste, pHoles);
    const tally = holes.reduce((sum, h) => sum + h.putts.length, 0);
    if (pCard && Number(pCard) !== tally) {
      notes.push(
        `This reads ${tally} putts and your card says ${pCard}. The round saved either way and the round page flags the difference.`,
      );
    }
    setPasteErrors(errors);
    setPasteNotes(notes);
    if (!holes.some((h) => h.putts.length)) {
      setAdded(null);
      return;
    }
    const round = makeRound({ date: pDate, course: pCourse, putterId: pPutter, holeCount: pHoles });
    dispatch({
      t: 'newRound',
      round: {
        ...round,
        holes: holes.length ? holes : blankHoles(pHoles),
        score: pScore ? Number(pScore) : undefined,
        recordedPutts: pCard ? Number(pCard) : undefined,
        finished: true,
      },
    });
    setAdded({ id: round.id, date: pDate, putts: tally });
    setPaste('');
    setPCourse('');
    setPScore('');
    setPCard('');
  };

  return (
    <>
      <h2>Account</h2>
      <Account />

      <h2>Putters</h2>
      {state.putters.length === 0 && <p className="small muted">No putters yet. Add the one in your bag.</p>}
      {state.putters
        .slice()
        .sort((a, b) => Number(a.retired) - Number(b.retired))
        .map((p) => (
          <div className="card putter-row" key={p.id} style={{ opacity: p.retired ? 0.6 : 1 }}>
            <div className="putter-head">
              <PutterTag putterId={p.id} />
              {p.active && <span className="tiny muted">In the bag</span>}
              {p.retired && <span className="tiny muted">Retired</span>}
            </div>
            <input
              type="text"
              aria-label="putter name"
              value={p.name}
              onChange={(e) => dispatch({ t: 'renamePutter', id: p.id, name: e.target.value })}
            />
            <div className="btn-row">
              {!p.active && !p.retired && (
                <button
                  className="btn btn-ghost"
                  onClick={() => dispatch({ t: 'setActivePutter', id: p.id })}
                >
                  Put in the bag
                </button>
              )}
              <button
                className="btn btn-ghost"
                onClick={() => dispatch({ t: 'retirePutter', id: p.id, retired: !p.retired })}
              >
                {p.retired ? 'Unretire' : 'Retire'}
              </button>
            </div>
          </div>
        ))}
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          value={name}
          placeholder="Add a putter"
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="btn"
          style={{ flex: '0 0 auto' }}
          disabled={!name.trim()}
          onClick={() => {
            dispatch({ t: 'addPutter', id: newId(), name });
            setName('');
          }}
        >
          Add
        </button>
      </div>

      <h2>Courses</h2>
      {state.courses.length === 0 ? (
        <p className="small muted">
          None saved yet. Pick one when you start a round and it gets kept here with its pars.
        </p>
      ) : (
        state.courses.map((c) => (
          <div className="card" key={c.id} style={{ marginBottom: 8 }}>
            <div className="round-head">
              <h3 style={{ fontSize: 16 }}>{c.name}</h3>
              <ConfirmButton
                className="linkish tiny"
                label="Remove"
                confirmLabel="Tap again"
                onConfirm={() => dispatch({ t: 'deleteCourse', id: c.id })}
              />
            </div>
            <p className="small muted" style={{ margin: '2px 0 0' }}>
              {[c.place, c.tees.map((t) => t.name).join(', ')].filter(Boolean).join(' · ')}
            </p>
          </div>
        ))
      )}

      <h2>While you play</h2>
      <div className="card">
        <div className="round-head">
          <span className="k" style={{ fontSize: 14 }}>
            Hide score and bleed on the Track screen
          </span>
          <button
            className={state.quietTrack ? 'chip chip-sel' : 'chip'}
            style={{ minHeight: 32, padding: '0 12px', fontSize: 13 }}
            aria-pressed={!!state.quietTrack}
            onClick={() => dispatch({ t: 'setQuietTrack', on: !state.quietTrack })}
          >
            {state.quietTrack ? 'Hidden' : 'Shown'}
          </button>
        </div>
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          For tournament rounds. Putts still log exactly the same and every stat is still worked out
          afterwards, you just do not see the running score or the drop while you are out there.
        </p>
      </div>

      <h2>Under the hood</h2>
      <details>
        <summary>Expected putts baseline</summary>
      <p className="small muted">
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
        className="btn btn-ghost btn-wide"
        style={{ marginTop: 10 }}
        onClick={() => dispatch({ t: 'setBaseline', baseline: DEFAULT_BASELINE })}
      >
        Reset baseline
      </button>
      </details>

      <details>
        <summary>Bulk-load an old round</summary>
      <p className="small muted">
        Write it the way you write it on your phone. Hole number, then one entry per putt in order, commas
        between them. Words in an entry become tags: high, low, on line, short, long, past, lip, push,
        pull. Whatever follows the pipe is your running score, which is how the app works out greens in
        regulation.
      </p>
      <pre className="small card" style={{ margin: '0 0 10px', overflowX: 'auto' }}>{`1: 8 feet (lip) (high), 1 foot | E
2: 22 feet (high&short), 2 feet (high and pushed), 1 foot | +1
3: 34 feet (high), 1 foot | +3`}</pre>
      <p className="small muted">
        A tagged last putt from more than 2 feet means the tap-in went unwritten, so one gets added. A tagged
        tap-in inside 2 feet reads as a note on the putt before it. Either way the import tells you which holes
        it did that to.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div className="field-label" style={{ marginTop: 0 }}>Date</div>
          <input type="date" value={pDate} onChange={(e) => setPDate(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="field-label" style={{ marginTop: 0 }}>Holes</div>
          <div className="seg">
            {[18, 9].map((n) => (
              <button key={n} type="button" aria-pressed={pHoles === n} onClick={() => setPHoles(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="field-label">Course</div>
      <input type="text" value={pCourse} onChange={(e) => setPCourse(e.target.value)} placeholder="Optional" />
      <div className="field-label">Putter</div>
      <div className="chips">
        {state.putters
          .filter((p) => !p.retired)
          .map((p) => (
            <button
              key={p.id}
              className={pPutter === p.id ? 'chip chip-sel' : 'chip'}
              onClick={() => setPPutter(p.id)}
            >
              {p.name}
            </button>
          ))}
      </div>
      <div className="field-label">Holes</div>
      <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'1: 30 3\n2: 12'} />
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div className="field-label">Score</div>
          <input type="number" inputMode="numeric" value={pScore} onChange={(e) => setPScore(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="field-label">Putts on the card</div>
          <input type="number" inputMode="numeric" value={pCard} onChange={(e) => setPCard(e.target.value)} />
        </div>
      </div>
      {added && (
        <div className="card card-good" style={{ marginTop: 12 }}>
          <h3>
            Added {fmtDate(added.date)} · {added.putts} putts
          </h3>
          <button className="btn btn-ghost btn-wide" style={{ marginTop: 8 }} onClick={() => go(`/round/${added.id}`)}>
            Open the round
          </button>
        </div>
      )}
      {pasteErrors.length > 0 && (
        <ul className="small neg">
          {pasteErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {pasteNotes.length > 0 && (
        <ul className="small muted">
          {pasteNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <button className="btn btn-wide" style={{ marginTop: 10 }} disabled={!paste.trim()} onClick={runPaste}>
        Add as a finished round
      </button>
      </details>

      <h2>Data</h2>
      <div className="btn-row">
        <button className="btn" onClick={exportJson}>
          Export JSON
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
      </div>
      {pending && (
        <div className="card card-live" style={{ marginTop: 10 }}>
          <h3>
            That file holds {pending.rounds} {pending.rounds === 1 ? 'round' : 'rounds'}
          </h3>
          <p className="small muted" style={{ margin: '2px 0 12px' }}>
            {pending.fresh} new to this device, {pending.rounds - pending.fresh} covering rounds you
            already have. {pending.kept} here {pending.kept === 1 ? 'is' : 'are'} not in the file.
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
            <button
              className="btn btn-ghost"
              style={{ flex: '0 0 auto' }}
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {restoreNote && <p className="small muted">{restoreNote}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importJson(f);
          e.target.value = '';
        }}
      />
      <p className="small muted">
        {state.rounds.length} {state.rounds.length === 1 ? 'round' : 'rounds'} on this device
        {state.rounds.length
          ? `, newest ${fmtDate(state.rounds.reduce((a, b) => (a.date > b.date ? a : b)).date)}`
          : ''}. A browser can wipe local
        storage without warning, so export after rounds you care about.
      </p>

      <h2>Danger</h2>
      <ConfirmButton
        className="btn btn-danger btn-wide"
        label="Clear all data"
        confirmLabel="Tap again to wipe everything"
        onConfirm={() => dispatch({ t: 'clearAll' })}
      />
    </>
  );
}
