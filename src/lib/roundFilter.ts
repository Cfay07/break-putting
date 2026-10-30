import { fmtDate } from './format';
import type { GreenSpeed, Putter, Round } from './types';

/** Every way Stats can narrow the rounds. Each part is optional and they all apply together. */
export interface RoundFilter {
  kind: 'all' | 'competitive' | 'casual';
  putterId?: string;
  greens?: GreenSpeed;
  /** Inclusive ISO dates. */
  from?: string;
  to?: string;
}

export const NO_FILTER: RoundFilter = { kind: 'all' };

export function applyFilter(rounds: Round[], f: RoundFilter): Round[] {
  return rounds.filter(
    (r) =>
      r.finished &&
      (f.kind === 'all' || !!r.competitive === (f.kind === 'competitive')) &&
      (!f.putterId || r.putterId === f.putterId) &&
      (!f.greens || r.greenSpeed === f.greens) &&
      (!f.from || r.date >= f.from) &&
      (!f.to || r.date <= f.to),
  );
}

export function isFiltered(f: RoundFilter): boolean {
  return f.kind !== 'all' || !!f.putterId || !!f.greens || !!f.from || !!f.to;
}

const GREEN_WORD: Record<GreenSpeed, string> = { slow: 'Slow', medium: 'Medium', fast: 'Fast', glass: 'Glass' };

export function dateRangeText(f: Pick<RoundFilter, 'from' | 'to'>): string | null {
  if (f.from && f.to) return `${fmtDate(f.from)} to ${fmtDate(f.to)}`;
  if (f.from) return `Since ${fmtDate(f.from)}`;
  if (f.to) return `Up to ${fmtDate(f.to)}`;
  return null;
}

/** The button's words: what is on, in the order it narrows. */
export function filterLabel(f: RoundFilter, putters: Putter[]): string {
  const parts = [
    f.putterId ? (putters.find((p) => p.id === f.putterId)?.name ?? 'One putter') : null,
    f.kind === 'competitive' ? 'Competitive' : f.kind === 'casual' ? 'Casual' : null,
    f.greens ? `${GREEN_WORD[f.greens]} greens` : null,
    dateRangeText(f),
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'All rounds';
}

/** A date some days back from an ISO date, for the quick ranges. */
export function daysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
