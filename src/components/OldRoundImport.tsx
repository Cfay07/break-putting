import { useState } from 'react';
import { GreenSpeedPick } from './GreenSpeedPick';
import { parsePaste } from '../lib/importer';
import { fmtDate, today } from '../lib/format';
import { go } from '../lib/router';
import { blankHoles, makeRound, useApp } from '../lib/store';
import type { GreenSpeed } from '../lib/types';

/** A round written down by hand, the way it sits in a phone's notes, loaded as finished. */
export function OldRoundImport() {
  const { state, dispatch } = useApp();
  const [pDate, setPDate] = useState(today);
  const [pCourse, setPCourse] = useState('');
  const [pPutter, setPPutter] = useState(state.putters.find((p) => p.active)?.id ?? '');
  const [pHoles, setPHoles] = useState(18);
  // A pasted round almost always came out of DECADE, and DECADE is where the competitive play lives.
  const [pComp, setPComp] = useState(true);
  const [pGreens, setPGreens] = useState<GreenSpeed | undefined>();
  const [paste, setPaste] = useState('');
  const [pScore, setPScore] = useState('');
  const [pCard, setPCard] = useState('');
  const [pasteErrors, setPasteErrors] = useState<string[]>([]);
  const [pasteNotes, setPasteNotes] = useState<string[]>([]);
  const [added, setAdded] = useState<{ id: string; date: string; putts: number } | null>(null);

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
        competitive: pComp || undefined,
        greenSpeed: pGreens,
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
      <div className="field-label">Greens, by stimp</div>
      <GreenSpeedPick value={pGreens} onPick={setPGreens} />
      <div className="field-label">Playing</div>
      <div className="seg">
        {[false, true].map((t) => (
          <button key={String(t)} type="button" aria-pressed={pComp === t} onClick={() => setPComp(t)}>
            {t ? 'Competitive' : 'Casual'}
          </button>
        ))}
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
    </>
  );
}
