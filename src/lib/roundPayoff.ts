import { carryText, type Carry } from './carry';
import { habitsOf, type Habit } from './habits';
import { sliceSince } from './pinpoint';
import { readError } from './readError';
import { breakDirsOf, type Putt, type Round, type Surface } from './types';

const isTagged = (p: Putt) =>
  breakDirsOf(p).length > 0 ||
  p.readAs !== undefined ||
  !!(p.push || p.pull || p.lip || p.decel || p.accel || p.strike || p.speed || p.missSide);

/** What the tags in one round said, biggest first. Plain counts: one round proves nothing. */
export function roundTags(round: Round): { tagged: number; putts: number; lines: string[]; showed: Set<Habit['key']> } {
  const putts = round.holes.flatMap((h) => h.putts);
  const count = (f: (p: Putt) => boolean) => putts.filter(f).length;
  const reads = readError([round]);
  const push = count((p) => !p.made && !!p.push);
  const pull = count((p) => !p.made && !!p.pull);
  const lips = count((p) => !p.made && !!p.lip);
  const off = count((p) => p.strike === 'toe' || p.strike === 'heel');
  const struck = count((p) => !!p.strike);
  const decel = count((p) => !p.made && !!p.decel);
  const misread = reads.under + reads.over + reads.wrong;
  const rows: [number, string][] = [
    [misread, `Reads: right on ${reads.hadIt} of ${reads.judged}, ${reads.under} under, ${reads.over} over${reads.wrong ? `, ${reads.wrong} the wrong way` : ''}.`],
    [push + pull, `Start line: ${push} pushed, ${pull} pulled.`],
    [lips, `${lips} lipped out.`],
    [off, `${off} of ${struck} strikes off the middle.`],
    [decel, `${decel} quit on.`],
  ];
  const showed = new Set<Habit['key']>();
  if (misread) showed.add('read');
  if (push + pull) showed.add('start');
  if (lips) showed.add('lip');
  if (off) showed.add('strike');
  if (decel) showed.add('decel');
  return {
    showed,
    tagged: count(isTagged),
    putts: putts.length,
    lines: rows
      .filter(([n]) => n > 0)
      .sort((a, b) => b[0] - a[0])
      .slice(0, 3)
      .map(([, line]) => line),
  };
}

export interface RoundPayoff {
  tags: ReturnType<typeof roundTags>;
  /** Findings this round's tags took past their minimum. */
  found: Habit[];
  /** A pattern you already had that this round added to. */
  still: Habit | null;
  /** What you have been working on, as this round played it. */
  work: { label: string; made: number; attempts: number; text: string }[];
}

export function roundPayoff(round: Round, scoped: Round[], carry: Carry[], surface: Surface): RoundPayoff {
  const inScope = scoped.some((r) => r.id === round.id);
  const before = scoped.filter((r) => r.id !== round.id && r.date <= round.date);
  const had = new Set(habitsOf(before, surface).map((h) => h.title));
  const after = inScope ? habitsOf([...before, round], surface) : [];
  const found = after.filter((h) => !had.has(h.title));
  const tags = roundTags(round);
  // A read pattern only counts as showing up if this round got that side wrong that way.
  const sides = readError([round]).sides;
  const showedHere = (h: Habit) =>
    h.read ? (sides.find((x) => x.key === h.read!.side)?.[h.read.way] ?? 0) > 0 : tags.showed.has(h.key);
  const still = after.find((h) => had.has(h.title) && showedHere(h)) ?? null;
  const work = inScope
    ? carry
        .filter((c) => round.date >= c.started)
        .map((c) => {
          const t = sliceSince([round], c.zone, c.cond, '').after;
          return { label: c.label, made: t.made, attempts: t.attempts, text: carryText(c) };
        })
        .filter((w) => w.attempts > 0)
        .slice(0, 2)
    : [];
  return { tags, found, still, work };
}
