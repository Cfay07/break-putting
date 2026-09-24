import type { Hole, Putt } from './types';

export interface ParseResult {
  holes: Hole[];
  errors: string[];
  notes: string[];
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

function distanceIn(segment: string): number | null {
  const digits = segment.match(/\d+/);
  if (digits) return Number(digits[0]);
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b`).test(segment)) return n;
  }
  return null;
}

const UNIT = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:feet|foot|ft)\b/gi;

/**
 * A comma usually separates putts, but not always. Parentheses are the other tell: two tagged
 * distances jammed into one comma segment ("44 feet (high) 12 feet (high)") are two putts, while a
 * bare second number is part of the same note ("32 feet high and 12 feet past").
 */
function splitEntries(segment: string): string[] {
  const hits = [...segment.matchAll(UNIT)];
  const parens = segment.match(/\([^)]*\)/g)?.length ?? 0;
  if (hits.length < 2 || parens < hits.length) return [segment];
  return hits.map((hit, i) =>
    segment.slice(hit.index ?? 0, i + 1 < hits.length ? hits[i + 1].index : segment.length),
  );
}

function tagsIn(segment: string): Partial<Putt> {
  const s = segment.toLowerCase();
  const t: Partial<Putt> = {};
  if (/\bhigh\b/.test(s)) t.missSide = 'high';
  else if (/\blow\b/.test(s)) t.missSide = 'low';
  else if (/\bon ?line\b/.test(s)) t.missSide = 'online';
  if (/\bshort\b/.test(s)) t.speed = 'short';
  else if (/\b(long|past)\b/.test(s)) t.speed = 'long';
  if (/\blip/.test(s)) t.lip = true;
  if (/\bpush/.test(s)) t.push = true;
  if (/\bpull/.test(s)) t.pull = true;
  return t;
}

function tagged(p: Partial<Putt>): boolean {
  return !!(p.missSide || p.speed || p.lip || p.push || p.pull);
}

/** Reads the running score written after the pipe: "E", "+7", "-2". */
function runningScore(after: string | undefined): number | null {
  if (after === undefined) return null;
  const s = after.trim().toLowerCase();
  if (!s) return null;
  if (s === 'e' || s === 'even') return 0;
  const m = s.match(/^([+-]?)(\d+)$/);
  if (!m) return null;
  return m[1] === '-' ? -Number(m[2]) : Number(m[2]);
}

/**
 * Reads a round written the way Conor writes it:
 *   1: 8 feet (lip) (high), 1 foot | E
 *   12: 22 feet (high&short), 2 feet (high and pushed), 1 foot | +1
 *   9: 32 feet high and 12 feet past, 12 feet low lip, 4 feet missed high, one foot
 *
 * Hole number, then one comma-separated entry per putt in play order. The first number in an
 * entry is the distance; words anywhere in it (high, low, on line, short, long, past, lip, push,
 * pull) become tags. Anything after a "|" is the running score, which turns into the hole's
 * result against par and is what lets the app work out greens in regulation.
 *
 * Two rules cover how the tap-in gets written, or does not:
 * - A tagged last entry inside 2 feet is a note about the putt before it, so the tags move back
 *   and the short one counts as holed.
 * - A tagged last entry from further out means the tap-in went unwritten, so one is added.
 */
export function parsePaste(text: string, holeCount: number): ParseResult {
  const errors: string[] = [];
  const notes: string[] = [];
  const holes: Hole[] = Array.from({ length: holeCount }, (_, i) => ({ hole: i + 1, putts: [] }));

  let previousScore = 0;

  for (const raw of text.split('\n')) {
    const [beforePipe, afterPipe] = raw.split('|');
    const line = beforePipe.trim();
    if (!line) continue;

    const head = line.match(/^(\d+)\s*[:.)\-]\s*(.+)$/);
    if (!head) {
      errors.push(`Could not read "${raw.trim()}". Start the line with the hole number and a colon.`);
      continue;
    }

    const hole = Number(head[1]);
    if (hole < 1 || hole > holeCount) {
      errors.push(`Hole ${hole} is outside a ${holeCount}-hole round.`);
      continue;
    }

    const putts: Putt[] = [];
    let bad = false;
    const entries = head[2]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .flatMap(splitEntries);

    for (const segment of entries) {
      const d = distanceIn(segment);
      if (d === null || d < 1 || d > 120) {
        errors.push(`Hole ${hole}: could not read a distance in "${segment}".`);
        bad = true;
        break;
      }
      putts.push({ d, made: false, ...tagsIn(segment) });
    }
    if (bad || !putts.length) continue;

    const last = putts[putts.length - 1];
    if (!tagged(last)) {
      last.made = true;
    } else if (last.d <= 2 && putts.length > 1) {
      const prev = putts[putts.length - 2];
      prev.missSide = prev.missSide ?? last.missSide;
      prev.speed = prev.speed ?? last.speed;
      prev.lip = prev.lip || last.lip;
      prev.push = prev.push || last.push;
      prev.pull = prev.pull || last.pull;
          putts[putts.length - 1] = { d: last.d, made: true };
      notes.push(`Hole ${hole}: read the note on the ${last.d}-footer as a note on the ${prev.d}-footer.`);
    } else {
      putts.push({ d: 1, made: true });
      notes.push(`Hole ${hole}: your last putt from ${last.d} ft is tagged as a miss, so a 1-foot tap-in was added after it.`);
    }

    const running = runningScore(afterPipe);
    const vsPar = running === null ? undefined : running - previousScore;
    if (running !== null) previousScore = running;

    holes[hole - 1] = { hole, putts, vsPar };
  }

  return { holes, errors, notes };
}
