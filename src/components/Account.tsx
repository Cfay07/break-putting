import { useState } from 'react';
import { currentSession, online, signIn, signOut, signUp } from '../lib/cloud';
import { lastSyncedAt, resetSyncClock, sync } from '../lib/sync';
import { claimStored, emptyState, storedOwner } from '../lib/storage';
import { useApp } from '../lib/store';
import { fmtDate } from '../lib/format';

function whenSynced(): string {
  const at = lastSyncedAt();
  if (!at) return 'not yet';
  const d = new Date(at);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} hr ago`;
  return fmtDate(at.slice(0, 10));
}

export function Account() {
  const { state, dispatch } = useApp();
  const [session, setSession] = useState(currentSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const runSync = async () => {
    setBusy(true);
    setNote('Syncing...');
    try {
      const { result, incoming } = await sync(state);
      dispatch({ t: 'applyIncoming', incoming });
      setNote(`Sent ${result.pushed}, received ${result.pulled}.`);
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const enter = async (mode: 'in' | 'up') => {
    if (!email.trim() || password.length < 6) {
      setNote('Email, and a password of at least six characters.');
      return;
    }
    setBusy(true);
    setNote('');
    try {
      const s = mode === 'in' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
      // Rounds are kept on the device, so without this a second account signing in on the same
      // phone would read the first account's rounds and, worse, push them back up stamped with
      // its own user id. Whoever owned them last is remembered through sign out for this check.
      const previous = storedOwner();
      const switched = previous !== null && previous !== s.userId;
      const base = switched ? emptyState() : state;
      if (switched) dispatch({ t: 'clearAll' });
      claimStored(s.userId);
      setSession(s);
      setPassword('');
      resetSyncClock();
      const { result, incoming } = await sync(base);
      dispatch({ t: 'applyIncoming', incoming });
      setNote(
        switched
          ? `Signed in as ${s.email}. The rounds on this phone belonged to a different account, so they were cleared instead of being taken over. Received ${result.pulled}.`
          : `Signed in. Sent ${result.pushed}, received ${result.pulled}.`,
      );
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    setNote('Syncing before sign out...');
    let safe = true;
    try {
      const { incoming } = await sync(state);
      dispatch({ t: 'applyIncoming', incoming });
    } catch {
      safe = false;
    }
    signOut();
    resetSyncClock();
    setSession(null);
    setBusy(false);
    if (safe) {
      // Everything is up in the account now, so the copy on the phone is only a way for the
      // next person who signs in to end up looking at it.
      dispatch({ t: 'clearAll' });
      setNote('Signed out. Your rounds are saved to your account and cleared off this phone. Sign back in to pull them down.');
    } else {
      setNote('Signed out, but this phone could not reach your account first, so your rounds were left on it. Sign back in and sync when you have signal.');
    }
  };

  if (session) {
    return (
      <>
        <div className="card">
          <div className="stat-row">
            <span className="k">Signed in</span>
            <span className="v" style={{ fontSize: 14 }}>
              {session.email}
            </span>
          </div>
          <div className="stat-row">
            <span className="k">Last synced</span>
            <span className="v" style={{ fontSize: 14 }}>
              {whenSynced()}
            </span>
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn btn-primary" disabled={busy} onClick={runSync}>
            {busy ? 'Syncing...' : 'Sync now'}
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={leave}>
            Sign out
          </button>
        </div>
        {note && <p className="small muted">{note}</p>}
        <p className="small muted">
          Rounds are written to this phone first and sent up afterwards, so logging never waits on
          a signal.{!online() && ' You are offline right now.'}
        </p>
      </>
    );
  }

  return (
    <>
      <p className="small muted">
        Optional. Sign in and your rounds follow you between devices. Skip it and everything stays
        on this phone exactly as it is now.
      </p>
      {!storedOwner() && state.rounds.length > 0 && (
        <p className="small muted">
          This phone has {state.rounds.length}{' '}
          {state.rounds.length === 1 ? 'round' : 'rounds'} on it that are not tied to any account
          yet. Signing in adds them to whichever account you use.
        </p>
      )}
      <div className="field-label">Email</div>
      <input
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="field-label">Password</div>
      <input
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" disabled={busy} onClick={() => enter('in')}>
          Sign in
        </button>
        <button className="btn" disabled={busy} onClick={() => enter('up')}>
          Create account
        </button>
      </div>
      {note && <p className="small muted">{note}</p>}
    </>
  );
}
