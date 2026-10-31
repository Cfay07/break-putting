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
export function roundTags(round: Round) {
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
  const shortLips = count((p) => !p.made && !!p.lip && p.d >= 3 && p.d <= 10);
  const rows: { key: Habit['key']; n: number; line: string }[] = [
    {
      key: 'read',
      n: misread,
      line: `Reads: right on ${reads.hadIt} of ${reads.judged}, ${reads.under} under, ${reads.over} over${reads.wrong ? `, ${reads.wrong} the wrong way` : ''}.`,
    },
    { key: 'start', n: push + pull, line: `Start line: ${push} pushed, ${pull} pulled.` },
    { key: 'lip', n: lips, line: `${lips} lipped out.` },
    { key: 'strike', n: off, line: `${off} of ${struck} strikes off the middle.` },
    { key: 'decel', n: decel, line: `${decel} quit on.` },
  ];
  const sorted = rows.filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
  return {
    tagged: count(isTagged),
    putts: putts.length,
    rows: sorted,
    lines: sorted.slice(0, 3).map((r) => r.line),
    /** This round alone, in the words of each habit, or nothing when it did not come up. */
    here: {
      start: push + pull ? `${push} pushed, ${pull} pulled` : null,
      lip: shortLips ? `${shortLips} lipped out from 3 to 10 ft` : null,
      strike: off ? `${off} of ${struck} strikes off the middle` : null,
      decel: decel ? `${decel} quit on` : null,
    },
  };
}

/** One pattern as a round played it: this round's count first, the running total kept apart. */
export interface HabitLine {
  title: string;
  round: string | null;
  total: string | null;
  detail: string;
}

export interface RoundPayoff {
  tags: ReturnType<typeof roundTags>;
  /** Findings this round's tags took past their minimum. */
  found: HabitLine[];
  /** A pattern you already had that this round added to. */
  still: HabitLine | null;
  /** This round's tags, less whatever the pattern lines already said. */
  lines: string[];
  /** What you have been working on, as this round played it. */
  work: { label: string; made: number; attempts: number; text: string }[];
}

export function roundPayoff(round: Round, scoped: Round[], carry: Carry[], surface: Surface): RoundPayoff {
  const inScope = scoped.some((r) => r.id === round.id);
  const before = scoped.filter((r) => r.id !== round.id && r.date <= round.date);
  const had = new Set(habitsOf(before, surface).map((h) => h.title));
  const after = inScope ? habitsOf([...before, round], surface) : [];
  const tags = roundTags(round);
  const sides = readError([round]).sides;
  const hereFor = (h: Habit): string | null => {
    if (h.read) {
      const side = sides.find((x) => x.key === h.read!.side);
      const n = side?.[h.read.way] ?? 0;
      return side && n ? `${n} of ${side.putts} ${h.read.side === 'lr' ? 'left-to-right' : 'right-to-left'} reads ${h.read.way}` : null;
    }
    return h.key === 'read' || h.key === 'bleed' ? null : tags.here[h.key];
  };
  const lineOf = (h: Habit): HabitLine => ({ title: h.title, round: hereFor(h), total: h.total ?? null, detail: h.detail });
  const found = after.filter((h) => !had.has(h.title)).map(lineOf);
  const stillHabit = after.find((h) => had.has(h.title) && hereFor(h));
  const still = stillHabit ? lineOf(stillHabit) : null;
  // Said once: a pattern line already gave this round's count for its own key.
  const spoken = new Set(after.filter((h) => !h.read && hereFor(h) && (!had.has(h.title) || h === stillHabit)).map((h) => h.key));
  const lines = tags.rows.filter((r) => !spoken.has(r.key)).slice(0, 3).map((r) => r.line);
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
  return { tags, found, still, lines, work };
}
