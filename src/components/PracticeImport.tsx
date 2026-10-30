import { useRef, useState } from 'react';
import { distanceText } from '../lib/drills';
import { pdfLines, textLines } from '../lib/pdfText';
import { readSheet, type ImportResult } from '../lib/sheetImport';
import { newId } from '../lib/storage';
import { useApp } from '../lib/store';
import type { DrillDef, SessionDef } from '../lib/types';

/** Two drills are the same drill when everything that changes how it is scored matches. */
const sig = (d: DrillDef) => JSON.stringify([d.name, d.scoring, d.stations, d.onMiss, d.target, d.limit]);

/**
 * A coach's practice file in, sessions out. Everything it read is shown before anything is
 * saved, and every block it could not read is named with its text rather than guessed at.
 */
export function PracticeImport() {
  const { state, dispatch } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [keep, setKeep] = useState<boolean[]>([]);
  const [done, setDone] = useState('');

  const have = new Set(state.sessions.map((x) => x.name.toLowerCase()));

  const read = async (lines: Awaited<ReturnType<typeof pdfLines>>) => {
    const r = readSheet(lines, newId);
    if (!r.sessions.length) {
      setError('Nothing in that file reads like a practice plan.');
      return;
    }
    setResult(r);
    setKeep(r.sessions.map((s) => !have.has(s.name.toLowerCase())));
    setDone('');
  };

  const fromFile = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const pdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
      await read(pdf ? await pdfLines(file) : textLines(await file.text()));
    } catch {
      setError('Could not read that file. A PDF saved from Google Sheets or Excel works best.');
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    if (!result) return;
    const existing = new Map(state.drills.map((d) => [sig(d), d.id]));
    const idFor = new Map<string, string>();
    const drills: DrillDef[] = [];
    for (const d of result.drills) {
      const known = existing.get(sig(d));
      if (known) idFor.set(d.id, known);
      else {
        idFor.set(d.id, d.id);
        drills.push(d);
      }
    }
    const sessions: SessionDef[] = result.sessions
      .filter((_, i) => keep[i])
      .map((s) => ({
        id: newId(),
        name: s.name,
        source: 'import',
        blocks: s.blocks.map((b) => ({ drill: idFor.get(b.drill.id)!, minutes: b.minutes })),
      }));
    const used = new Set(sessions.flatMap((s) => s.blocks.map((b) => b.drill)));
    dispatch({ t: 'importPractice', drills: drills.filter((d) => used.has(d.id)), sessions });
    setDone(`Added ${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}. They are on the Practice tab.`);
    setResult(null);
  };

  const picked = keep.filter(Boolean).length;

  return (
    <div>
      <p className="small muted" style={{ marginTop: 0 }}>
        Your team's practice sheet as a PDF or text. Each session comes in with its drills, times and
        scoring, and a drill used in five sessions keeps one history.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void fromFile(f);
          e.target.value = '';
        }}
      />
      <div className="btn-row">
        <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Reading...' : 'Choose a file'}
        </button>
        <button className="btn btn-ghost" onClick={() => setPasting(!pasting)}>
          {pasting ? 'Hide paste box' : 'Paste it instead'}
        </button>
      </div>
      {pasting && (
        <>
          <textarea
            style={{ marginTop: 10, width: '100%' }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the practice plan here"
            aria-label="Practice plan text"
          />
          <button className="btn btn-wide" style={{ marginTop: 8 }} disabled={!text.trim()} onClick={() => void read(textLines(text))}>
            Read it
          </button>
        </>
      )}
      {error && <p className="small neg">{error}</p>}
      {done && <p className="small pos">{done}</p>}

      {result && (
        <div className="import-preview">
          <p className="small" style={{ margin: '14px 0 8px' }}>
            Found {result.sessions.length} sessions and {result.drills.length} drills
            {result.unread ? `. ${result.unread} ${result.unread === 1 ? 'block' : 'blocks'} could not be read, shown below.` : ', every block read.'}
          </p>
          {result.sessions.map((s, i) => {
            const unread = s.blocks.filter((b) => !b.read);
            const dup = have.has(s.name.toLowerCase());
            return (
              <label key={i} className={keep[i] ? 'import-session on' : 'import-session'}>
                <input
                  type="checkbox"
                  checked={keep[i]}
                  onChange={() => setKeep(keep.map((k, j) => (j === i ? !k : k)))}
                />
                <span className="import-main">
                  <strong>
                    {s.name}
                    {dup && <span className="small muted"> · you already have one by this name</span>}
                  </strong>
                  <span className="small muted">
                    {s.blocks
                      .map((b) => {
                        const where = distanceText(b.drill);
                        return where ? `${b.drill.name} (${where})` : b.drill.name;
                      })
                      .join(' · ')}
                  </span>
                  {unread.map((b, j) => (
                    <span key={j} className="small import-unread">
                      Could not read: "{b.text.slice(0, 90)}". It comes in as a block you mark done; edit the drill to score it.
                    </span>
                  ))}
                </span>
              </label>
            );
          })}
          <button className="btn btn-primary btn-wide" style={{ marginTop: 10 }} disabled={!picked} onClick={add}>
            Add {picked} {picked === 1 ? 'session' : 'sessions'}
          </button>
        </div>
      )}
    </div>
  );
}
