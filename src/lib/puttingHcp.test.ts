import { describe, expect, it } from 'vitest';
import { hcpText, puttingHcp } from './puttingHcp';
import type { Hole, Round } from './types';

const BASE: [number, number][] = [[1, 1], [5, 1.5], [20, 2], [60, 2.5]];

const rnd = (id: string, date: string, putts: number, extra: Partial<Round> = {}, threes = 18) =>
  ({
    id, label: id, date, putterId: 'p', holeCount: 18, finished: true,
    holes: Array.from({ length: 18 }, (_, i): Hole => {
      const n = i < threes ? putts : 2;
      return { hole: i + 1, par: 4, strokes: 4, putts: Array.from({ length: n }, (_, k) => ({ d: k === 0 ? 20 : 2, made: k === n - 1 })) };
    }),
    ...extra,
  }) as Round;

describe('putting handicap', () => {
  it('reads tour putting as a +6 and a stroke worse as scratch', () => {
    const tour = ['01', '02', '03', '04', '05'].map((d) => rnd(d, `2026-10-${d}`, 2));
    expect(hcpText(puttingHcp(tour, BASE)!.hcp)).toBe('+6');
    const scratch = ['01', '02', '03', '04', '05'].map((d) => rnd(d, `2026-10-${d}`, 3, {}, 1));
    expect(hcpText(puttingHcp(scratch, BASE)!.hcp)).toBe('0');
  });

  it('waits for five real rounds', () => {
    const rounds = ['01', '02', '03', '04'].map((d) => rnd(d, `2026-10-${d}`, 2));
    rounds.push(rnd('p', '2026-10-05', 2, { practice: { surface: 'indoor' } } as Partial<Round>));
    expect(puttingHcp(rounds, BASE)).toBeNull();
  });

  it('caps the ends and writes plus handicaps with a plus', () => {
    expect(hcpText(-2.4)).toBe('+2');
    expect(hcpText(44)).toBe('30+');
  });

  it('puts the good day below the bad day', () => {
    const rounds = ['01', '02', '03', '04', '05', '06'].map((d, i) => rnd(d, `2026-10-${d}`, 3, {}, i % 2 ? 1 : 3));
    const h = puttingHcp(rounds, BASE)!;
    expect(h.good).toBeLessThan(h.hcp);
    expect(h.bad).toBeGreaterThan(h.hcp);
  });
});
