import { currentSession, online, table } from './cloud';
import type { AppState, Putter, Round, SavedCourse, Tombstone } from './types';

const LAST_SYNC = 'break.lastSync';

export interface SyncResult {
  pushed: number;
  pulled: number;
  at: string;
}

export interface Incoming {
  rounds: Round[];
  putters: Putter[];
  removed: string[];
  settings?: { baseline: [number, number][]; courses: SavedCourse[]; updated: string };
}

interface Row<T> {
  id: string;
  payload: T;
  deleted: boolean;
  updated_at: string;
}

function lastSync(): string {
  try {
    return localStorage.getItem(LAST_SYNC) ?? '1970-01-01T00:00:00Z';
  } catch {
    return '1970-01-01T00:00:00Z';
  }
}

export function lastSyncedAt(): string | null {
  const v = lastSync();
  return v.startsWith('1970') ? null : v;
}

function stamp(at: string): void {
  try {
    localStorage.setItem(LAST_SYNC, at);
  } catch {
    // a missed stamp only means the next sync sends a little more than it had to
  }
}

async function upsert(kind: string, rows: unknown[]): Promise<void> {
  if (!rows.length) return;
  const res = await table(`${kind}?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Could not save ${kind} (${res.status}).`);
}

async function pull<T>(kind: string, since: string): Promise<Row<T>[]> {
  const res = await table(`${kind}?select=id,payload,deleted,updated_at&updated_at=gt.${since}`);
  if (!res.ok) throw new Error(`Could not read ${kind} (${res.status}).`);
  return (await res.json()) as Row<T>[];
}

/**
 * Sends anything this device changed since the last sync, then takes anything the server has
 * that is newer. Nothing is destructive: a round only disappears if some device deliberately
 * deleted it, and that arrives as a tombstone rather than as an absence.
 */
export async function sync(state: AppState): Promise<{ result: SyncResult; incoming: Incoming }> {
  const session = currentSession();
  if (!session) throw new Error('Not signed in.');
  if (!online()) throw new Error('No connection.');

  const since = lastSync();
  const startedAt = new Date().toISOString();
  const mine = (updated?: string) => !updated || updated > since;

  const rounds = state.rounds.filter((r) => mine(r.updated));
  const putters = state.putters.filter((p) => mine(p.updated));
  const graves = state.tombstones.filter((t: Tombstone) => t.at > since);

  await upsert(
    'rounds',
    rounds.map((r) => ({
      id: r.id,
      user_id: session.userId,
      payload: r,
      deleted: false,
      updated_at: r.updated ?? startedAt,
    })),
  );
  await upsert(
    'rounds',
    graves
      .filter((t) => t.kind === 'round')
      .map((t) => ({ id: t.id, user_id: session.userId, payload: {}, deleted: true, updated_at: t.at })),
  );
  await upsert(
    'putters',
    putters.map((p) => ({
      id: p.id,
      user_id: session.userId,
      payload: p,
      deleted: false,
      updated_at: p.updated ?? startedAt,
    })),
  );

  if (state.settingsUpdated && state.settingsUpdated > since) {
    await upsert('settings', [
      {
        user_id: session.userId,
        payload: { baseline: state.baseline, courses: state.courses },
        updated_at: state.settingsUpdated,
      },
    ]);
  }

  const [remoteRounds, remotePutters] = await Promise.all([
    pull<Round>('rounds', since),
    pull<Putter>('putters', since),
  ]);

  const settingsRes = await table(
    `settings?select=payload,updated_at&updated_at=gt.${since}&limit=1`,
  );
  const settingsRows = settingsRes.ok
    ? ((await settingsRes.json()) as { payload: Incoming['settings']; updated_at: string }[])
    : [];

  const incoming: Incoming = {
    rounds: remoteRounds.filter((r) => !r.deleted).map((r) => ({ ...r.payload, updated: r.updated_at })),
    putters: remotePutters.filter((p) => !p.deleted).map((p) => ({ ...p.payload, updated: p.updated_at })),
    removed: remoteRounds.filter((r) => r.deleted).map((r) => r.id),
    settings: settingsRows.length
      ? {
          baseline: settingsRows[0].payload?.baseline ?? [],
          courses: settingsRows[0].payload?.courses ?? [],
          updated: settingsRows[0].updated_at,
        }
      : undefined,
  };

  stamp(startedAt);

  return {
    result: {
      pushed: rounds.length + putters.length + graves.length,
      pulled: incoming.rounds.length + incoming.putters.length + incoming.removed.length,
      at: startedAt,
    },
    incoming,
  };
}

/** Fire and forget. A sync that fails offline is not an error worth interrupting a round for. */
export async function syncQuietly(
  state: AppState,
  dispatch: (a: { t: 'applyIncoming'; incoming: Incoming }) => void,
): Promise<void> {
  if (!currentSession() || !online()) return;
  try {
    const { incoming } = await sync(state);
    dispatch({ t: 'applyIncoming', incoming });
  } catch {
    // try again next time the app opens
  }
}

export function resetSyncClock(): void {
  try {
    localStorage.removeItem(LAST_SYNC);
  } catch {
    // nothing to reset
  }
}
