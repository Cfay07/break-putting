import type { Line } from './pdfText';
import type { DrillDef, OnMiss, SessionDef, Station, Surface } from './types';

/**
 * Turns a practice sheet into sessions and drills.
 *
 * Nothing here is trusted blindly. Every block comes back with the text it was read from, and a
 * block whose scoring could not be worked out is marked unread rather than guessed at, so the
 * person importing sees exactly what needs their call before anything is saved.
 */

export interface ImportBlock {
  minutes?: number;
  text: string;
  drill: DrillDef;
  /** False when the scoring could not be read and the drill is only a placeholder. */
  read: boolean;
}

export interface ImportSession {
  name: string;
  blocks: ImportBlock[];
}

const TIME = /^(\d+)\s*(?:-\s*(\d+)\s*)?(?:minutes?|mins?)\b\W*(.*)$/i;
const HEADER = /^(?!.*\bdrill\b).{2,60}\b(practice|putting)\s*$/i;
const KNOWN_OPENER = new RegExp(
  [
    'lucky 13', 'semi-circle', 'speed drill', '\\d+ foot gate drill', 'mirror and tee', 'decade speed',
    'northwestern', 'two putt from', '3, 4, 5, 6', '3, 6, 9', 'partner', 'make \\d+ putts in a row',
    'mission impossible', 'ladder drill', '2 putt drill', 'all \\d+ footers', 'chip and putt',
    'using the mirror', 'range work', 'chipping drill 1', 'putting drill 1', 'how many did you make',
    'head to head', 'ist head', 'game \\d', 'competitive putting game', '\\(use \\d balls\\)',
    '\\d+ footers - make', '5 player', 'behind pets', 'lag putting', '3 gates', 'wrap up', 'eam speed',
    'knock out', '\\d+ foot drill', 'pping', 'chipping\\.?$',
  ].map((s) => `^${s}`).join('|'),
  'i',
);
/**
 * A line that names a drill near its start. Case matters here: a wrapped line starting in lower
 * case ("partner from the other...") is the middle of a sentence, never a new drill.
 */
const GENERIC_OPENER =
  /^(?!(?:You|Do|If|Now|Then|The|This|THIS|Same|Set|Gate drill set up|Putting Drill [2-9]|Chipping drill [2-9])\b|\d\))(?!.*\b[Dd]rill\b.*\b[Dd]rill\b)[A-Z0-9(](?:\S+\s+){0,4}\S*\b(?:[Dd]rill|DRILL|[Gg]ame|[Cc]ompetition)\b/;

const opensKnown = (desc: string) => (/^[^a-z]/.test(desc) || /^pping\b/.test(desc)) && KNOWN_OPENER.test(desc);

/** Lines that start like the middle of an explanation, never a new drill. */
const LEADS_ON = /^(?:You|Do|If|Now|Then|The|This|THIS|Same|Set|Gate drill set up|Putting Drill [2-9]|Chipping drill [2-9]|\d\))\b/;

interface Row {
  minutes?: number;
  header?: string;
  desc?: string;
  answers: string[];
}

/** A time label, and whatever text shares its cell. "90 Minutes of Putting" is a name, not a time. */
function splitTime(s: string): { minutes: number; rest: string } | null {
  if (HEADER.test(s)) return null;
  const m = s.match(TIME);
  if (!m) return null;
  return { minutes: Math.max(Number(m[1]), m[2] ? Number(m[2]) : 0), rest: m[3].replace(/^of\s+/i, '').trim() };
}

interface Columns {
  /** Left of this is the time column: times, and labels like "Game 1" that are not drills. */
  time: number;
  /** Right of this are the boxes a player fills in. */
  answers: number;
}

/**
 * Where the columns sit, read off the page rather than assumed. The description column starts
 * with the long lines; the answer column is where most rows' second piece starts. Pasted text
 * has neither, so all of it is description.
 */
function columnsOf(lines: Line[]): Columns {
  const long = lines.flat().filter((c) => c.s.length >= 40).map((c) => c.x);
  const time = long.length ? Math.min(...long) - 8 : -Infinity;
  const seconds = lines
    .map((l) => l.filter((c) => c.x >= time && !splitTime(c.s)))
    .filter((l) => l.length > 1)
    .map((l) => l[1].x)
    .sort((a, b) => a - b);
  if (!seconds.length) return { time, answers: Infinity };
  const median = seconds[seconds.length >> 1];
  return { time, answers: Math.min(...seconds.filter((x) => x >= median - 40)) - 4 };
}

function rowsOf(lines: Line[]): Row[] {
  const col = columnsOf(lines);
  return lines.map((line) => {
    const row: Row = { answers: [] };
    const desc: string[] = [];
    for (const c of line) {
      if (c.x >= col.answers) {
        row.answers.push(c.s);
        continue;
      }
      const t = splitTime(c.s);
      if (t) {
        row.minutes = t.minutes;
        if (t.rest) desc.push(t.rest);
        continue;
      }
      if (c.x < col.time) continue;
      desc.push(c.s);
    }
    if (desc.length === 1 && HEADER.test(desc[0])) row.header = desc[0];
    else if (desc.length) row.desc = desc.join(' ');
    return row;
  });
}

interface RawBlock {
  minutes?: number;
  desc: string[];
  answers: string[];
}

function blocksOf(rows: Row[]): { name: string; blocks: RawBlock[] }[] {
  const sessions: { name: string; blocks: RawBlock[] }[] = [];
  let session: { name: string; blocks: RawBlock[] } | null = null;
  let block: RawBlock | null = null;
  let pendingAnswers: string[] = [];
  let pendingMinutes: number | undefined;

  const open = (desc: string, minutes?: number) => {
    if (!session) {
      session = { name: 'Imported practice', blocks: [] };
      sessions.push(session);
    }
    block = { minutes: minutes ?? pendingMinutes, desc: [desc], answers: pendingAnswers };
    session.blocks.push(block);
    pendingAnswers = [];
    pendingMinutes = undefined;
  };

  for (const row of rows) {
    if (row.header) {
      session = { name: row.header, blocks: [] };
      sessions.push(session);
      block = null;
      pendingAnswers = [...row.answers];
      pendingMinutes = row.minutes;
      continue;
    }
    if (row.desc) {
      const current = block as RawBlock | null;
      const named =
        opensKnown(row.desc) ||
        GENERIC_OPENER.test(row.desc) ||
        (/^[A-Z(]/.test(row.desc) && !LEADS_ON.test(row.desc) && RECOGNIZERS.some((r) => r.test.test(row.desc!)));
      // A title above the first session ("Outside Putting Drills") is not a drill.
      if (!session && !named) continue;
      const opens =
        !current ||
        named ||
        (row.minutes !== undefined && current.minutes !== undefined && /^[A-Z(]/.test(row.desc));
      if (opens) {
        open(row.desc, row.minutes);
      } else {
        current!.desc.push(row.desc);
        current!.answers.push(...pendingAnswers);
        pendingAnswers = [];
        if (row.minutes !== undefined && current!.minutes === undefined) current!.minutes = row.minutes;
      }
      (block as RawBlock | null)?.answers.push(...row.answers);
      continue;
    }
    // A row with no description belongs to the block above if that block is still missing the
    // piece, and otherwise waits for the next one: sheets centre labels vertically in a cell.
    const current = block as RawBlock | null;
    if (row.minutes !== undefined) {
      if (current && current.minutes === undefined) current.minutes = row.minutes;
      else pendingMinutes = row.minutes;
    }
    // Answer boxes are centred in their cell too, so a row of them that turns up once this block
    // already has its own is more likely the next block's.
    if (row.answers.length) {
      if (current && !pendingMinutes && !current.answers.length) current.answers.push(...row.answers);
      else pendingAnswers.push(...row.answers);
    }
  }
  return sessions.filter((s) => s.blocks.length);
}

/* ---------- reading one block ---------- */

const PUTTING: Surface[] = ['indoor', 'green'];

type Read = Partial<DrillDef> & Pick<DrillDef, 'name' | 'scoring' | 'stations'>;

const num = (s: string) => Number(s);

function ladderFrom(text: string): Station[] {
  // "3 in a row from 3", "2 out of 3 from 9", "1 out of 3 from 15"
  const out: Station[] = [];
  for (const m of text.matchAll(/(\d+)\s*(?:in a row|out of (\d+))\s*from\s*(\d+)/gi)) {
    const need = num(m[1]);
    out.push({ d: num(m[3]), balls: m[2] ? num(m[2]) : need, need });
  }
  return out;
}

function countPairs(text: string): Station[] {
  // "20 putts at 4 feet", "9 putts at 12 feet", "15 from 2 ft", "10 putts from 10 feet"
  const out: Station[] = [];
  for (const m of text.matchAll(/(\d+)\s*(?:putts?\s*)?(?:at|from)\s*(\d+)\s*(?:feet|foot|ft)\b/gi)) {
    out.push({ d: num(m[2]), balls: num(m[1]) });
  }
  return out;
}

const RECOGNIZERS: { test: RegExp; read: (text: string, answers: string) => Read | null }[] = [
  {
    test: /lucky 13/i,
    read: (t) => ({ name: 'Lucky 13', scoring: 'ladder', onMiss: 'end', stations: ladderFrom(t) }),
  },
  {
    test: /mission impossible/i,
    read: (t) => {
      const stations = [...t.matchAll(/(\d+)\s*at\s*(\d+)/gi)].map((m) => ({ d: num(m[2]), balls: num(m[1]), need: num(m[1]) }));
      const back = Number(t.match(/go back to (\d+)/i)?.[1]);
      const cp = stations.findIndex((s) => s.d === back);
      return { name: 'Mission Impossible', scoring: 'ladder', onMiss: 'checkpoint', checkpoints: cp > 0 ? [0, cp] : [0], stations };
    },
  },
  {
    test: /northwestern pressure/i,
    read: (t) => ({
      name: 'Northwestern Pressure',
      scoring: 'ladder',
      onMiss: 'restart',
      limit: Number(t.match(/(\d+)\s*mins/i)?.[1]) || undefined,
      stations: [...t.matchAll(/(\d+)\s*tees?\s*at\s*(\d+)\s*ft\s*-\s*make\s*(\d+)/gi)].map((m) => ({
        d: num(m[2]),
        balls: num(m[3]),
        need: num(m[3]),
      })),
    }),
  },
  {
    test: /3, 4, 5, 6,? drill/i,
    read: (t) => ({
      name: '3, 4, 5, 6 Drill',
      scoring: 'ladder',
      onMiss: 'stay',
      limit: Number(t.match(/succeed in (\d+)\s*minutes/i)?.[1]) || undefined,
      stations: [...t.matchAll(/(\d+)\s*putts from (\d+) feet[^.]*?must make (?:all (\d+)|at least (\d+)|at (\d+)|(two|\d+) in a row)/gi)].map(
        (m) => {
          const need = m[3] ?? m[4] ?? m[5];
          return { d: num(m[2]), balls: num(m[1]), need: need ? num(need) : m[6] === 'two' ? 2 : num(m[6]) };
        },
      ),
    }),
  },
  {
    test: /3, 6, 9 progression/i,
    read: (t) => ({
      name: '3, 6, 9 Progression',
      scoring: 'ladder',
      onMiss: 'end',
      stations: [...t.matchAll(/(\d+)@(\d+)/g)].map((m) => ({ d: num(m[2]), balls: num(m[1]), need: num(m[1]) })),
    }),
  },
  {
    test: /^2 putt drill/i,
    read: (t) => ({
      name: '2 putt ladder',
      scoring: 'ladder',
      onMiss: 'back',
      stations: [...t.matchAll(/\b(\d+)\s*feet\b/gi)].map((m) => ({ d: num(m[1]), balls: 1, need: 1, mode: 'twoputt' as const })),
    }),
  },
  {
    test: /using the mirror/i,
    read: () => ({
      name: 'Mirror ladder',
      scoring: 'ladder',
      onMiss: 'stay',
      stations: Array.from({ length: 10 }, (_, i) => ({ d: 2 + i * 2, balls: 1, need: 1 })),
    }),
  },
  {
    test: /partner ladder drill/i,
    read: () => ({
      name: 'Partner ladder',
      scoring: 'ladder',
      onMiss: 'end',
      stations: Array.from({ length: 12 }, (_, i) => ({ d: i + 1, balls: 1, need: 1 })),
    }),
  },
  {
    test: /^putting drill 1/i,
    read: () => ({
      name: 'Putting drills 1 to 5',
      scoring: 'ladder',
      onMiss: 'stay',
      stations: [
        { d: 3, balls: 10, need: 10 },
        { d: 5, balls: 10, need: 8 },
        { d: 7, balls: 10, need: 7 },
        { d: 9, balls: 10, need: 5 },
        { d: 11, balls: 1, need: 1 },
        { d: 13, balls: 1, need: 1 },
        { d: 15, balls: 1, need: 1 },
      ],
    }),
  },
  {
    test: /semi-circle/i,
    read: (_t, a) => {
      const rows = [...a.matchAll(/(\d+(?:\/\d+)+)\s*ft\s*\(\s*(made|need)/gi)];
      const stations = rows.flatMap((m) =>
        m[1].split('/').map((d) => ({ d: num(d), balls: 3, mode: m[2].toLowerCase() === 'made' ? ('make' as const) : ('twoputt' as const) })),
      );
      stations.sort((x, y) => (x.mode === y.mode ? x.d - y.d : x.mode === 'make' ? -1 : 1));
      return { name: 'Semi-Circle Drill', scoring: 'count', stations };
    },
  },
  {
    test: /speed drill from/i,
    read: (_t, a) => {
      const stations = [...a.matchAll(/(\d+)\s*balls?\s*(uphill|downhill)\s*from\s*(\d+)\s*ft/gi)].map((m) => ({
        d: num(m[3]),
        balls: num(m[1]),
        mode: 'zone' as const,
        zoneFt: 1.5,
        label: m[2][0].toUpperCase() + m[2].slice(1).toLowerCase(),
      }));
      const ds = [...new Set(stations.map((s) => s.d))].join('/');
      return { name: `Speed drill ${ds}`, scoring: 'count', stations };
    },
  },
  {
    test: /10 foot gate drill - three different directions/i,
    read: () => ({
      name: 'Gate drill 10, three directions',
      scoring: 'count',
      stations: ['Straight', 'Left to right', 'Right to left'].map((label) => ({ d: 10, balls: 10, label })),
    }),
  },
  {
    test: /\d+ foot gate drill/i,
    read: (t) => {
      const ds = [...t.matchAll(/(\d+) foot gate drill/gi)].map((m) => num(m[1]));
      return { name: `Gate drill ${ds.join('/')}`, scoring: 'count', stations: ds.map((d) => ({ d, balls: 10 })) };
    },
  },
  {
    test: /two putt from (\d+)\/(\d+)\/(\d+)/i,
    read: (t) => {
      const ds = t.match(/two putt from ([\d/]+)/i)![1].split('/').map(num);
      return { name: `Two-putt ${ds.join('/')}`, scoring: 'count', stations: ds.map((d) => ({ d, balls: 1, mode: 'twoputt' as const })) };
    },
  },
  {
    test: /two putt (\d+) times from (\d+) feet/i,
    read: (t) => {
      const m = t.match(/two putt (\d+) times from (\d+) feet/i)!;
      return { name: `Two-putt from ${m[2]}`, scoring: 'count', stations: [{ d: num(m[2]), balls: num(m[1]), mode: 'twoputt' }] };
    },
  },
  {
    test: /decade speed putting drill 1/i,
    read: () => ({
      name: 'DECADE speed drill 1',
      scoring: 'count',
      stations: [
        { d: 10, balls: 8, mode: 'zone', zoneFt: 0.5 },
        { d: 15, balls: 8, mode: 'zone', zoneFt: 0.75 },
        { d: 20, balls: 8, mode: 'zone', zoneFt: 1 },
      ],
    }),
  },
  {
    test: /earn the c/i,
    read: (t) => ({
      name: 'Earn the C',
      scoring: 'count',
      stations: [...t.matchAll(/(\d+)\s*feet\s*-\s*(\d+)\s*putts/gi)].map((m) => ({ d: num(m[1]), balls: num(m[2]), mode: 'zone' as const, zoneFt: 1.25 })),
    }),
  },
  {
    test: /decade speed putting drill 3/i,
    read: (t) => ({
      name: 'DECADE speed drill 3',
      scoring: 'count',
      stations: [...new Set([...t.matchAll(/(?:tee|more) at (\d+)/gi)].map((m) => num(m[1])))].map((d) => ({ d, balls: 3, mode: 'zone' as const, zoneFt: 1.5 })),
    }),
  },
  {
    test: /ladder drill from 3 directions/i,
    read: (t) => {
      const ds = (t.match(/(\d+(?:\/\d+)+)\s*ft/)?.[1] ?? '2/4/6/8/10').split('/').map(num);
      return { name: 'Ladder, three directions', scoring: 'count', stations: ds.map((d) => ({ d, balls: 3 })) };
    },
  },
  {
    test: /all (\d+) footers/i,
    read: (t) => {
      const d = num(t.match(/all (\d+) footers/i)![1]);
      const balls = Number(t.match(/(\d+) putts each/i)?.[1]) || 6;
      const labels = t
        .split(/\b\d\)\s*/)
        .slice(1)
        .map((p) => p.split(/,|\s+(?:right|left|looking|eyes|mirror)\b[^,]*?- how/i)[0].replace(/\s+(only )?$/, '').trim())
        .filter(Boolean)
        .slice(0, 6);
      const handOf = (label: string) => (/left hand/i.test(label) ? 'left' : /right hand/i.test(label) ? 'right' : undefined);
      return {
        name: `${d} footers, five ways`,
        scoring: 'count',
        stations: (labels.length ? labels : ['Normal']).map((label) => {
          const hand = handOf(label);
          return hand ? { d, balls, label, hand } : { d, balls, label };
        }),
      };
    },
  },
  {
    test: /make (\d+) putts in a row from (\d+) feet|(\d+) footers - make (\d+) in a row|make (\d+), three foot putts, in a row|(\d+) (?:foot|feet|ft) drill\b[^.]*?make (\d+) in a row/i,
    read: (t) => {
      const plain = t.match(/make (\d+) putts in a row from (\d+) feet/i);
      const footers = t.match(/(\d+) footers - make (\d+) in a row/i);
      const wrap = t.match(/make (\d+), three foot putts, in a row/i);
      const foot = t.match(/(\d+) (?:foot|feet|ft) drill\b[^.]*?make (\d+) in a row/i);
      if (!plain && !footers && !wrap && !foot) return null;
      const [target, d] = plain
        ? [num(plain[1]), num(plain[2])]
        : footers
          ? [num(footers[2]), num(footers[1])]
          : foot
            ? [num(foot[2]), num(foot[1])]
            : [num(wrap![1]), 3];
      const limit = Number(t.match(/(?:succeed in|unless) (\d+) minutes/i)?.[1]) || undefined;
      return { name: `${target} in a row from ${d}`, scoring: 'streak', target, limit, stations: [{ d, balls: 0 }] };
    },
  },
  {
    test: /partner (\d+) footers.*?(\d+) in a row/i,
    read: (t) => {
      const m = t.match(/partner (\d+) footers.*?(\d+) in a row/i)!;
      return { name: `Partner ${m[1]} footers, ${m[2]} in a row`, scoring: 'streak', target: num(m[2]), stations: [{ d: num(m[1]), balls: 0 }] };
    },
  },
  {
    test: /partner gate (\d+) footers/i,
    read: (t) => {
      const d = num(t.match(/partner gate (\d+) footers/i)![1]);
      const four = /four in a row/i.test(t);
      return {
        name: `Partner gate ${d} footers`,
        scoring: 'streak',
        target: four ? 4 : undefined,
        limit: Number(t.match(/timer to (\d+)/i)?.[1]) || undefined,
        stations: [{ d, balls: 0 }],
      };
    },
  },
  {
    test: /putter length lag/i,
    read: (t) => ({
      name: 'Partner putter-length lag',
      scoring: 'streak',
      limit: Number(t.match(/timer to (\d+)/i)?.[1]) || undefined,
      stations: [{ d: 0, balls: 0, mode: 'zone', zoneFt: 3 }],
    }),
  },
  {
    test: /mirror and tee gates|gate putting|how many did you make\?/i,
    read: (t) => {
      const stations = countPairs(t);
      if (!stations.length) return null;
      const name = /mirror/i.test(t) ? 'Mirror and tee gates' : /gate putting/i.test(t) ? 'Gate putting 4 to 16' : '35 short putts';
      return { name, scoring: 'count', stations };
    },
  },
  {
    test: /3 gates, play the break/i,
    read: () => ({ name: '3 gates, play the break', scoring: 'count', stations: [6, 9, 12].map((d) => ({ d, balls: 6 })) }),
  },
  {
    test: /head to head|competitive putting game|\bgame \d\b|lag putting competition|knock out|up and down game/i,
    read: (t) => ({
      name: t.match(/(spiral out|two putt knock out|knock out chipping|up and down game|up 5)/i)?.[1] ?? 'Head to head',
      scoring: 'game',
      stations: [],
      putting: !/chipping/i.test(t),
    }),
  },
  {
    test: /chip and putt|up and down drill/i,
    read: (t) => ({
      name: 'Chip and putt',
      scoring: 'count',
      stations: [{ d: 0, balls: Number(t.match(/(\d+) chips/i)?.[1]) || 18, label: 'Up and down' }],
      putting: false,
    }),
  },
  {
    test: /chipping/i,
    read: (_t, a) => {
      const clubs = [...a.matchAll(/(9 iron|58\/60 degree|gap wedge)/gi)].map((m) => m[1]);
      return {
        name: 'Chipping',
        scoring: 'count',
        stations: (clubs.length ? clubs : ['Chips']).map((label) => ({ d: 0, balls: 10, label })),
        putting: false,
      };
    },
  },
  {
    test: /range work|behind pets|5 player|eam speed|^pping|^chipping\.?$/i,
    read: (t) => {
      const name = /range work/i.test(t)
        ? 'Range work'
        : /behind pets/i.test(t)
          ? 'Short game boxes'
          : /5 player/i.test(t)
            ? '5 player gates'
            : /eam speed/i.test(t)
              ? 'Team speed drill'
              : 'Chipping targets';
      return { name, scoring: 'done', stations: [], putting: /5 player|eam speed/i.test(t) };
    },
  },
];

function nameFrom(desc: string): string {
  const head = desc.split(/[.:(]|\s-\s/)[0].trim();
  return head.length > 44 ? `${head.slice(0, 41).trim()}...` : head;
}

/** Reads one block. Unknown wording still yields something, marked unread, never a guess. */
export function readBlock(desc: string, answers = ''): { read: boolean; def: Read } {
  const text = desc.replace(/\s+/g, ' ');
  for (const r of RECOGNIZERS) {
    if (!r.test.test(text) && !r.test.test(answers)) continue;
    const def = r.read(`${text} ${answers}`, answers);
    if (def && (def.scoring === 'game' || def.scoring === 'done' || def.stations.length)) return { read: true, def };
  }
  const pairs = countPairs(text);
  if (pairs.length) return { read: true, def: { name: nameFrom(text), scoring: 'count', stations: pairs } };
  const ladder = ladderFrom(text);
  if (ladder.length) return { read: true, def: { name: nameFrom(text), scoring: 'ladder', onMiss: 'end' as OnMiss, stations: ladder } };
  return { read: false, def: { name: nameFrom(text), scoring: 'done', stations: [] } };
}

function signature(d: Read): string {
  return JSON.stringify([d.name, d.scoring, d.stations, d.onMiss, d.target, d.limit]);
}

export interface ImportResult {
  sessions: ImportSession[];
  drills: DrillDef[];
  unread: number;
}

/**
 * The whole sheet. A drill used in five sessions comes back once and is referenced five times,
 * so its history is one history.
 */
export function readSheet(lines: Line[], newId: () => string): ImportResult {
  const bySig = new Map<string, DrillDef>();
  let unread = 0;
  const sessions = blocksOf(rowsOf(lines)).map((s) => ({
    name: s.name,
    blocks: s.blocks.map((b) => {
      const text = b.desc.join(' ');
      const { read, def } = readBlock(text, b.answers.join(' '));
      if (!read) unread++;
      const sig = signature(def);
      let drill = read ? bySig.get(sig) : undefined;
      if (!drill) {
        drill = {
          id: newId(),
          how: text,
          surfaces: PUTTING,
          putting: true,
          source: 'import',
          ...(/\bpartner\b|\bhe then\b|5 player|as a group|everyone/i.test(text) ? { partner: true } : {}),
          ...def,
        };
        if (read) bySig.set(sig, drill);
      }
      return { minutes: b.minutes, text, drill, read };
    }),
  }));
  const drills = [...new Map(sessions.flatMap((s) => s.blocks.map((b) => [b.drill.id, b.drill] as const))).values()];
  return { sessions, drills, unread };
}

export function sessionsFrom(result: ImportResult, newId: () => string): SessionDef[] {
  return result.sessions.map((s) => ({
    id: newId(),
    name: s.name,
    source: 'import',
    blocks: s.blocks.map((b) => ({ drill: b.drill.id, minutes: b.minutes })),
  }));
}
