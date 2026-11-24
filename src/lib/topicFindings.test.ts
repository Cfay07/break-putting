import { describe, expect, it } from 'vitest';
import {
  birdieStory,
  birdieVsPar,
  compareRates,
  greensFor,
  greensStory,
  putterPair,
  putterStory,
  speedLines,
  timingStory,
} from './topicFindings';
import type { GroupLine } from './situations';
import type { GreenSpeed, Hole, Putt, Putter, Round } from './types';

const putt = (d: number, made: boolean) => ({ d, made }) as Putt;
const P = (id: string, name: string) => ({ id, name, active: true, retired: false }) as Putter;

/** A round of holes that each have one putt of `d` feet, made on the first `makes` holes. */
function round(id: string, date: string, putterId: string, d: number, makes: number, greenSpeed?: GreenSpeed): Round {
  const holes: Hole[] = Array.from({ length: 10 }, (_, i) => ({
    hole: i + 1,
    putts: i < makes ? [putt(d, true)] : [putt(d, false), putt(1, true)],
  }));
  return { id, date, putterId, finished: true, greenSpeed, holes } as unknown as Round;
}

describe('compareRates', () => {
  it('says nothing under the putt minimum', () => {
    expect(compareRates({ made: 9, tried: 10 }, { made: 1, tried: 10 }).verdict).toBe('none');
  });
  it('calls a big gap and leans on a middling one', () => {
    expect(compareRates({ made: 80, tried: 100 }, { made: 40, tried: 100 })).toEqual({
      verdict: 'clear',
      better: true,
    });
    expect(compareRates({ made: 29, tried: 56 }, { made: 58, tried: 86 })).toEqual({ verdict: 'lean', better: false });
    expect(compareRates({ made: 50, tried: 100 }, { made: 51, tried: 100 }).verdict).toBe('none');
  });
});

describe('by putter', () => {
  const rounds = [
    ...Array.from({ length: 4 }, (_, i) => round(`a${i}`, `2026-0${i + 1}-01`, 'a', 4, 3)),
    ...Array.from({ length: 4 }, (_, i) => round(`b${i}`, `2026-0${i + 5}-01`, 'b', 4, 8)),
  ];
  it('compares the two putters oldest first and names the change', () => {
    const pair = putterPair(rounds, [P('b', 'Cobra'), P('a', 'Old')])!;
    expect(pair.map((l) => l.putter.id)).toEqual(['a', 'b']);
    expect(putterStory(pair)).toBe('The Cobra is the change. From 3 to 5 ft you went from 30% to 80%.');
  });
  it('says there is not enough rather than no difference when putts are few', () => {
    const few = putterPair(
      [round('a', '2026-01-01', 'a', 4, 3), round('b', '2026-02-01', 'b', 4, 8)],
      [P('a', 'Old'), P('b', 'Cobra')],
    )!;
    expect(putterStory(few)).toBe('Not enough 3 to 5 ft putts with both the Old and the Cobra to compare yet.');
  });
  it('has nothing to compare when filtered to one putter', () => {
    expect(putterPair(rounds.slice(0, 4), [P('a', 'Old'), P('b', 'Cobra')])).toBeNull();
  });
});

describe('greens', () => {
  it('reads one putter only and names the worst speed against the best', () => {
    const rounds = [
      ...[0, 1, 2].map((i) => round(`m${i}`, '2026-05-01', 'b', 5, 8, 'medium')),
      ...[0, 1, 2].map((i) => round(`f${i}`, '2026-05-02', 'b', 5, 3, 'fast')),
      round('other', '2026-05-03', 'a', 5, 0, 'medium'),
    ];
    const lines = speedLines(rounds, 'b');
    expect(lines.map((l) => [l.speed, l.short.tried])).toEqual([
      ['medium', 30],
      ['fast', 30],
    ]);
    expect(greensStory(lines, 'Cobra')).toBe(
      'With the Cobra, you make 30% from 3 to 10 ft on fast greens against 80% on medium ones.',
    );
  });
});

describe('when in the round', () => {
  const line = (label: string, made: number, tried: number) => ({ label, short: { made, tried } }) as GroupLine;
  it('leans without calling it when the gap is not sure', () => {
    expect(timingStory([line('First 3 holes', 36, 62), line('Last 3 holes', 23, 52)])).toBe(
      "No clear change across a round. Short putts lean worse on the last 3 holes, 44% against 58% on the first 3, but that's not enough putts to call yet.",
    );
  });
});

describe('birdie vs par', () => {
  /** Par 4s. A birdie putt is the third stroke, a par putt the fourth. */
  const hole = (n: number, d: number, made: boolean, forBirdie: boolean, comeback = false): Hole => {
    const putts = made ? [putt(d, true)] : comeback ? [putt(d, false), putt(6, true)] : [putt(d, false), putt(1, true)];
    return { hole: n, par: 4, strokes: (forBirdie ? 2 : 3) + putts.length, putts };
  };
  const r = (id: string, putterId: string, holes: Hole[]) =>
    ({ id, date: '2026-05-01', putterId, finished: true, holes }) as unknown as Round;

  it('judges birdie putts against par putts by the same putter from the same lengths', () => {
    const rounds = [
      r('1', 'b', [
        ...Array.from({ length: 20 }, (_, i) => hole(i + 1, 4, i < 10, true)),
        ...Array.from({ length: 20 }, (_, i) => hole(i + 21, 4, i < 10, false)),
      ]),
      r(
        '2',
        'b',
        Array.from({ length: 12 }, (_, i) => hole(i + 1, 4, i < 6, true)),
      ),
    ];
    const b = birdieVsPar(rounds);
    expect(b.tried).toBe(32);
    expect(b.holed).toBe(16);
    expect(b.expected).toBeCloseTo(16);
    expect(birdieStory(b)).toMatch(/^No clear gap yet\. You holed 16 of 32/);
  });

  it('counts only the first putt, so a comebacker never counts as a par putt', () => {
    const b = birdieVsPar([r('1', 'b', [hole(1, 12, false, true, true)])]);
    expect(b.bands.find((x) => x.label === '6 to 8 ft')).toBeUndefined();
  });

  it('skips birdie putts with too few par putts from that length to judge against', () => {
    const b = birdieVsPar([
      r(
        '1',
        'b',
        Array.from({ length: 40 }, (_, i) => hole(i + 1, 20, false, true)),
      ),
    ]);
    expect(b.tried).toBe(0);
    expect(birdieStory(b)).toBe('Shows at 30 birdie putts with a fair par comparison. You have 0.');
  });
});

describe('after a putter switch', () => {
  it('reads the putter you use now as soon as it has enough, not the one with the most rounds', () => {
    const old = [0, 1, 2, 3].flatMap((i) => [
      round(`om${i}`, `2026-05-0${i + 1}`, 'old', 5, 5, 'medium'),
      round(`of${i}`, `2026-05-1${i}`, 'old', 5, 5, 'fast'),
    ]);
    const now = [round('nm', '2026-06-01', 'new', 5, 5, 'medium'), round('nf', '2026-06-02', 'new', 5, 5, 'fast')];
    const putters = [P('old', 'Cobra'), P('new', 'Spider')];
    expect(greensFor(old, putters)).toMatchObject({ current: true, putter: { id: 'old' } });
    expect(greensFor([...old, ...now], putters)).toMatchObject({ current: true, putter: { id: 'new' } });
    expect(greensFor([...old, round('n1', '2026-06-01', 'new', 5, 5, 'medium')], putters)).toMatchObject({
      current: false,
      putter: { id: 'old' },
    });
  });
});
