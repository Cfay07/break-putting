import { useState } from 'react';
import { accountName, currentSession, storedName } from '../lib/cloud';
import { setDisplayName } from '../lib/teams';

/**
 * One name for the whole account. Joining a second team should not mean introducing yourself
 * again, and a roster that reads "conor.fayard" next to "Conor Fayard" is the same person twice.
 */
export function NameField({ onSaved, first }: { onSaved?: () => void; first?: boolean }) {
  const [name, setName] = useState(accountName);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  if (!currentSession()) return null;

  const save = async () => {
    setBusy(true);
    setNote('');
    try {
      await setDisplayName(name);
      setNote('Saved. Every team you are on shows this now.');
      onSaved?.();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="field-label" style={first ? { marginTop: 0 } : undefined}>
        Display name
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={name}
          maxLength={40}
          placeholder="How teammates see you"
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          className="btn"
          style={{ flex: '0 0 auto' }}
          disabled={busy || !name.trim() || name.trim() === storedName()}
          onClick={save}
        >
          Save
        </button>
      </div>
      {note ? (
        <p className="small muted">{note}</p>
      ) : (
        <p className="small muted">This is the name on every team board, not just one.</p>
      )}
    </>
  );
}
