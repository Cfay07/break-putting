import { anonRpc, table } from './cloud';
import type { Round } from './types';

export interface SharedRound {
  round: Round;
  baseline: [number, number][];
  sharedBy: string | null;
  sharedAt: string;
}

/**
 * A snapshot, not a live view. Sharing a round should not keep broadcasting every edit made
 * afterwards, and the baseline travels with it so the numbers a reader sees never drift.
 * Re-sharing the same round reuses its token, so a link already sent keeps working.
 */
export async function publishRound(
  round: Round,
  baseline: [number, number][],
): Promise<string> {
  const res = await table('rpc/share_round', {
    method: 'POST',
    body: JSON.stringify({ p_round_id: round.id, p_payload: round, p_baseline: baseline }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Could not share that round (${res.status}).`);
  }
  return (await res.json()) as string;
}

export function shareUrl(token: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/s/${token}`;
}

export async function loadSharedRound(token: string): Promise<SharedRound | null> {
  const rows = await anonRpc<
    { payload: Round; baseline: [number, number][]; shared_by: string | null; shared_at: string }[]
  >('get_shared_round', { share_token: token });
  const row = rows?.[0];
  if (!row) return null;
  return {
    round: row.payload,
    baseline: row.baseline,
    sharedBy: row.shared_by,
    sharedAt: row.shared_at,
  };
}
