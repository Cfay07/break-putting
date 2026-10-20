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

/**
 * The conflict target has to be the table's actual key. This said `id` for everything, and
 * settings is keyed by user_id and has no id column at all, so every settings push answered
 * 400. That push runs before the pull, so the throw took the pull down with it: rounds went up
 * and nothing ever came back, on every device, silently, because a quiet sync eats its error.
 */
async function upsert(kind: string, rows: unknown[], key = 'id'): Promise<void> {
  if (!rows.length) return;
  const res = await table(`${kind}?on_conflict=${key}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const why = await res.text().catch(() => '');
    throw new Error(`Could not save ${kind} (${res.status}). ${why}`.trim());
  }
}

async function pull<T>(kind: string, since: string): Promise<{ rows: Row<T>[]; at: string | null }> {
  const res = await table(`${kind}?select=id,payload,deleted,updated_at&updated_at=gt.${since}`);
  if (!res.ok) throw new Error(`Could not read ${kind} (${res.status}).`);
  return { rows: (await res.json()) as Row<T>[], at: res.headers.get('date') };
}

/**
 * The marker for "everything newer than this" used to be stamped from the phone's own clock,
 * and the next pull asks the server for rows newer than it. A phone running even slightly fast
 * stamps past a change that is already sitting on the server, and then filters that change out
 * of every pull it ever makes again. It can never arrive. Take the time off the server's own
 * response instead, backed up two seconds for anything written while the query was in flight.
 */
function serverStamp(header: string | null, fallback: string): string {
  const t = header ? Date.parse(header) : NaN;
  if (Number.isNaN(t)) return new Date(Date.parse(fallback) - 60_000).toISOString();
  return new Date(t - 2_000).toISOString();
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
    await upsert(
      'settings',
      [
        {
          user_id: session.userId,
          payload: { baseline: state.baseline, courses: state.courses },
          updated_at: state.settingsUpdated,
        },
      ],
      'user_id',
    );
  }

  const [roundPull, putterPull] = await Promise.all([
    pull<Round>('rounds', since),
    pull<Putter>('putters', since),
  ]);
  const remoteRounds = roundPull.rows;
  const remotePutters = putterPull.rows;
  const syncedAt = serverStamp(roundPull.at, startedAt);

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

  stamp(syncedAt);

  return {
    result: {
      pushed: rounds.length + putters.length + graves.length,
      pulled: incoming.rounds.length + incoming.putters.length + incoming.removed.length,
      at: startedAt,
    },
    incoming,
  };
}

/** Hiding and showing in quick succession fires twice, and the second has nothing new to push. */
let running = false;

/** Fire and forget. A sync that fails offline is not an error worth interrupting a round for. */
export async function syncQuietly(
  state: AppState,
  dispatch: (a: { t: 'applyIncoming'; incoming: Incoming }) => void,
): Promise<void> {
  if (running || !currentSession() || !online()) return;
  running = true;
  try {
    const { incoming } = await sync(state);
    dispatch({ t: 'applyIncoming', incoming });
  } catch {
    // try again next time the app opens
  } finally {
    running = false;
  }
}

export function resetSyncClock(): void {
  try {
    localStorage.removeItem(LAST_SYNC);
  } catch {
    // nothing to reset
  }
}
