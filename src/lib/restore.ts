import type { Round } from './types';

const dayKey = (r: Round) => `${r.date}|${r.holeCount}`;

/**
 * Pairs each round in a backup file with the round it is a copy of on this device. Ids match
 * first. A round whose id changed still pairs on its date and hole count, but only when that
 * day holds one such round on each side: a 36-hole day has two, and guessing there loses one.
 */
export function matchRounds(here: Round[], file: Round[]): Map<string, string> {
  const pairs = new Map<string, string>();
  const hereIds = new Set(here.map((r) => r.id));
  for (const r of file) if (hereIds.has(r.id)) pairs.set(r.id, r.id);

  const taken = new Set(pairs.values());
  const loose = (rs: Round[], skip: (r: Round) => boolean) => {
    const byDay = new Map<string, Round[]>();
    for (const r of rs) if (!skip(r)) byDay.set(dayKey(r), [...(byDay.get(dayKey(r)) ?? []), r]);
    return byDay;
  };
  const fileDays = loose(file, (r) => pairs.has(r.id));
  const hereDays = loose(here, (r) => taken.has(r.id));
  for (const [day, rs] of fileDays) {
    const mine = hereDays.get(day);
    if (rs.length === 1 && mine?.length === 1) pairs.set(rs[0]!.id, mine[0]!.id);
  }
  return pairs;
}

export interface RestorePlan {
  fresh: Round[];
  /** Rounds on this device the file never mentions. */
  kept: Round[];
}

export function planRestore(here: Round[], file: Round[]): RestorePlan {
  const pairs = matchRounds(here, file);
  const covered = new Set(pairs.values());
  return { fresh: file.filter((r) => !pairs.has(r.id)), kept: here.filter((r) => !covered.has(r.id)) };
}
