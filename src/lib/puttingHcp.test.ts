import { describe, expect, it } from 'vitest';
import { hcpMove, hcpText, puttingHcp } from './puttingHcp';
import type { Hole, Round } from './types';

const BASE: [number, number][] = [[1, 1], [5, 1.5], [20, 2], [60, 2.5]];

/** Two putts from 20 feet everywhere is tour average; each extra three-putt is a stroke lost. */
const rnd = (id: string, date: string, threes: number, extra: Partial<Round> = {}) =>
  ({
    id, label: id, date, putterId: 'p', holeCount: 18, finished: true,
    holes: Array.from({ length: 18 }, (_, i): Hole => {
      const n = i < threes ? 3 : 2;
      return { hole: i + 1, par: 4, strokes: 4, putts: Array.from({ length: n }, (_, k) => ({ d: k === 0 ? 20 : 2, made: k === n - 1 })) };
    }),
    ...extra,
  }) as Round;

const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);

describe('putting handicap', () => {
  it('reads tour putting as a +6 and a stroke worse as scratch', () => {
    expect(hcpText(puttingHcp(days(5).map((d) => rnd(d, d, 0)), BASE)!.hcp)).toBe('+6.0');
    expect(hcpText(puttingHcp(days(5).map((d) => rnd(d, d, 1)), BASE)!.hcp)).toBe('0.0');
  });

  it('waits for five real rounds', () => {
    const rounds = days(4).map((d) => rnd(d, d, 1));
    rounds.push(rnd('p', '2026-10-05', 1, { practice: { surface: 'indoor' } } as Partial<Round>));
    expect(puttingHcp(rounds, BASE)).toBeNull();
  });

  it('counts the best 4 of the last 12', () => {
    const rounds = days(16).map((d, i) => rnd(d, d, i % 3));
    const h = puttingHcp(rounds, BASE)!;
    expect(h.rounds).toHaveLength(12);
    expect(h.counting).toBe(4);
    expect(h.rounds.filter((r) => r.counts)).toHaveLength(4);
    expect(h.rounds[0].date).toBe('2026-10-16');
    expect(h.nextOut?.date).toBe('2026-10-05');
  });

  it('says what a round did to the handicap', () => {
    const rounds = days(6).map((d, i) => rnd(d, d, i === 5 ? 0 : 2));
    const m = hcpMove(rounds, rounds[5], (rs) => puttingHcp(rs, BASE))!;
    expect(hcpText(m.before!.hcp)).toBe('6.0');
    expect(hcpText(m.after.hcp)).toBe('0.0');
    expect(m.counts).toBe(true);
  });

  it('counts fewer when there are fewer rounds', () => {
    expect(puttingHcp(days(5).map((d) => rnd(d, d, 1)), BASE)!.counting).toBe(1);
    expect(puttingHcp(days(9).map((d) => rnd(d, d, 1)), BASE)!.counting).toBe(3);
  });

  it('writes plus handicaps with a plus and caps the top', () => {
    expect(hcpText(-2.44)).toBe('+2.4');
    expect(hcpText(3.06)).toBe('3.1');
    expect(hcpText(-0.02)).toBe('0.0');
    expect(hcpText(44)).toBe('30+');
  });
});

describe('nine-hole rounds', () => {
  it('pairs two nines into one round and holds a lone nine back', () => {
    const nine = (d: string, threes: number) => {
      const r = rnd(d, d, threes);
      return { ...r, holeCount: 9, holes: r.holes.slice(0, 9) } as Round;
    };
    const rounds = [...days(4).map((d) => rnd(d, d, 1)), nine('2026-10-10', 0), nine('2026-10-11', 2), nine('2026-10-12', 0)];
    const h = puttingHcp(rounds, BASE)!;
    expect(h.rounds).toHaveLength(5);
    expect(h.rounds[0]).toMatchObject({ date: '2026-10-11', nines: true });
    expect(hcpText(h.rounds[0].hcp)).toBe('6.0');
  });
});
