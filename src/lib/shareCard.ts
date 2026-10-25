import { bleedsIn } from './bleed';
import { fmtDateLong, puttSequence } from './format';
import { insights } from './insights';
import { holeSG } from './sg';
import { BUCKETS, courseLabel, lagSaves, pct, readBias, type Stats } from './stats';
import {
  BREAK_BUCKETS,
  BREAK_BUCKET_LABELS,
  GREEN_SPEED_STIMP,
  holeVsPar,
  holedOut,
  type Round,
} from './types';

/**
 * A whole round as one tall image, the way a fantasy app sends a week. One send instead of five
 * screenshots, so every section on the round page is here: the numbers, every distance band, lag
 * control, the miss patterns and what they mean, how the putt broke, what to work on, the card
 * hole by hole, and which holes bled.
 */
const W = 1080;
const PAD = 72;
const INNER = W - PAD * 2;

const INK = '#14392b';
const INK2 = '#4d6558';
const INK3 = '#8c9a92';
const PAPER = '#f2efe6';
const CARD = '#fbf9f3';
const LINE = 'rgba(20, 57, 43, 0.18)';
const RED = '#a52a1f';
const GOOD = '#1f7a4d';

const ROW = 54;
const HOLE_ROW = 48;
const HEAD = 100;
const LEAD = 38;

const FONT = (w: number, s: number) =>
  `${w} ${s}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;

interface Pen {
  c: CanvasRenderingContext2D;
  y: number;
}

function text(
  p: Pen,
  s: string,
  x: number,
  size: number,
  weight: number,
  color: string,
  align: CanvasTextAlign = 'left',
  track = 0,
) {
  const { c } = p;
  c.fillStyle = color;
  c.font = FONT(weight, size);
  c.textBaseline = 'alphabetic';
  if (!track) {
    c.textAlign = align;
    c.fillText(s, x, p.y);
    return;
  }
  // Canvas letter-spacing is not everywhere yet, so tracked labels go a glyph at a time.
  c.textAlign = 'left';
  const chars = [...s];
  const width = chars.reduce((n, ch) => n + c.measureText(ch).width + track, -track);
  let cx = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
  for (const ch of chars) {
    c.fillText(ch, cx, p.y);
    cx += c.measureText(ch).width + track;
  }
}

function wrapLines(
  c: CanvasRenderingContext2D,
  s: string,
  maxW: number,
  size: number,
  weight: number,
): string[] {
  c.font = FONT(weight, size);
  const out: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width > maxW && line) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

function paragraph(p: Pen, lines: string[], size: number, weight: number, color: string) {
  for (const line of lines) {
    p.y += LEAD;
    text(p, line, PAD, size, weight, color);
  }
}

function rule(p: Pen, color = LINE, weight = 2) {
  p.c.strokeStyle = color;
  p.c.lineWidth = weight;
  p.c.beginPath();
  p.c.moveTo(PAD, p.y);
  p.c.lineTo(W - PAD, p.y);
  p.c.stroke();
}

function heading(p: Pen, label: string) {
  p.y += 80;
  text(p, label.toUpperCase(), PAD, 24, 700, INK3, 'left', 4);
  p.y += 20;
  rule(p, INK, 3);
}

function statRow(p: Pen, k: string, v: string, color = INK) {
  p.y += ROW;
  text(p, k, PAD, 28, 500, INK2);
  text(p, v, W - PAD, 30, 800, color, 'right');
  p.y += 13;
  rule(p);
  p.y -= 13;
}

type Cell = { t: string; color?: string; weight?: number };
type Col = { label: string; x: number; align: CanvasTextAlign };

function tableHead(p: Pen, cols: Col[]) {
  p.y += 42;
  for (const col of cols) text(p, col.label, col.x, 20, 700, INK3, col.align, 2);
}

function tableRow(p: Pen, cols: Col[], cells: Cell[], shade = false) {
  p.y += ROW;
  if (shade) {
    p.c.fillStyle = 'rgba(165, 42, 31, 0.07)';
    p.c.fillRect(PAD - 18, p.y - 34, INNER + 36, ROW - 8);
  }
  cells.forEach((cell, i) => {
    const col = cols[i];
    text(p, cell.t, col.x, 27, cell.weight ?? 500, cell.color ?? INK, col.align);
  });
  p.y += 13;
  rule(p);
  p.y -= 13;
}

const signed2 = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;
const share = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : '--');

export interface CardInput {
  round: Round;
  stats: Stats;
  baseline: [number, number][];
  putter?: string;
}

/** A throwaway context, so wrapped text can be measured before the real canvas is sized. */
function measurer(): CanvasRenderingContext2D {
  const c = document.createElement('canvas').getContext('2d')!;
  return c;
}

export function drawRoundSheet({ round, stats, baseline, putter }: CardInput): HTMLCanvasElement {
  const m = measurer();
  const s = stats;
  const p0 = s.pattern;
  const bleeds = bleedsIn(round);
  const bled = bleeds.reduce((n, b) => n + b.shots, 0);
  const lag = lagSaves([round]);
  const bias = readBias(p0, 1);
  const cards = insights(s, { rounds: 1, taggedRounds: 1 });
  const holes = round.holes.filter((h) => h.putts.length || h.strokes !== undefined);

  const scoring = pct(s.scoring);
  const numbers: [string, string, string][] = [
    ['Score', round.score != null ? String(round.score) : '--', INK],
    ['Putts', String(s.totalPutts), INK],
    ['Putts per hole', s.puttsPerHole.toFixed(1), INK],
    ['1 / 2 / 3+ putts', `${s.onePutts} / ${s.twoPutts} / ${s.threePlus}`, INK],
  ];
  if (s.threePuttHoles.length) {
    numbers.push(['Three-putt holes', s.threePuttHoles.map((h) => `#${h}`).join(' '), RED]);
  }
  numbers.push(['Make % from 3 to 10 ft', scoring === null ? '--' : `${scoring.toFixed(0)}%`, INK]);
  numbers.push(['Feet of putts holed', String(Math.round(s.makesTotalFeet)), INK]);
  if (s.scoredHoles) {
    numbers.push(['Greens in regulation', `${s.gir} of ${s.scoredHoles} scored`, INK]);
  }
  if (bled > 0) numbers.push(['Shots lost after a mistake', `-${bled}`, RED]);

  const distance = BUCKETS.map((b) => ({ b, t: s.buckets[b.key] })).filter(
    ({ t }) => t.attempts > 0,
  );

  const lagRows: [string, string][] = [];
  if (lag.lags > 0) {
    lagRows.push(['First putts from 30+ ft', String(lag.lags)]);
    if (s.avgLeave !== null) {
      lagRows.push([
        'Typical leave',
        `${s.avgLeave.toFixed(1)} ft${
          s.avgLeavePct !== null ? ` · ${s.avgLeavePct.toFixed(0)}% of the putt` : ''
        }`,
      ]);
    }
    lagRows.push([
      'Left yourself 4+ ft',
      `${share(lag.bad, lag.lags)} · ${lag.bad} of ${lag.lags}`,
    ]);
    if (lag.avgBadLeave !== null) lagRows.push(['The comeback', `${lag.avgBadLeave.toFixed(1)} ft`]);
    if (lag.bad > 0) {
      lagRows.push(['Holed it', `${share(lag.saved, lag.bad)} · ${lag.saved} of ${lag.bad}`]);
    }
  }

  const sidedAll = p0.high + p0.low + p0.online;
  const pacedAll = p0.short + p0.good + p0.long;
  const missRows: [string, string][] = [];
  if (sidedAll) {
    missRows.push([
      'High / low / on line',
      `${p0.high} / ${p0.low} / ${p0.online}  ·  ${share(p0.high, sidedAll)} / ${share(
        p0.low,
        sidedAll,
      )} / ${share(p0.online, sidedAll)}`,
    ]);
  }
  if (pacedAll) {
    missRows.push([
      'Short / good / long',
      `${p0.short} / ${p0.good} / ${p0.long}  ·  ${share(p0.short, pacedAll)} / ${share(
        p0.good,
        pacedAll,
      )} / ${share(p0.long, pacedAll)}`,
    ]);
  }
  if (p0.push || p0.pull) missRows.push(['Pushed / pulled', `${p0.push} / ${p0.pull}`]);
  if (p0.decel || p0.accel) missRows.push(['Decel / accel', `${p0.decel} / ${p0.accel}`]);
  missRows.push(['Lip-outs', String(s.lipOuts)]);

  const biasText = biasSentence(bias);
  const biasLines = biasText ? wrapLines(m, biasText, INNER, 27, 500) : [];

  const breakRows = [
    ...BREAK_BUCKETS.map((b) => ({ label: BREAK_BUCKET_LABELS[b], t: p0.byBreak[b] })),
    { label: 'Uphill', t: p0.uphill },
    { label: 'Downhill', t: p0.downhill },
  ].filter(({ t }) => t.attempts > 0);

  const sideRows = BUCKETS.map((b) => ({ b, t: p0.byBucket[b.key] })).filter(
    ({ t }) => t.high + t.low + t.online > 0,
  );

  const insightBlocks = cards.map((card) => ({
    title: card.title,
    detail: wrapLines(m, card.detail, INNER, 26, 500),
    drill: wrapLines(m, `Drill. ${card.drill}`, INNER, 24, 500),
  }));

  const bleedLines = bleeds.length
    ? wrapLines(
        m,
        `• is the mistake, · a hole it bled into. ${bleeds
          .map((b) => `Hole ${b.triggerHole}, ${b.why}, ${b.shots} shot${b.shots === 1 ? '' : 's'}`)
          .join('. ')}.`,
        INNER,
        24,
        500,
      )
    : [];

  const bands =
    round.holeCount > 9
      ? [
          { label: 'Out', from: 1, to: 9 },
          { label: 'In', from: 10, to: 18 },
          { label: 'Total', from: 1, to: round.holeCount },
        ]
      : [{ label: 'Total', from: 1, to: round.holeCount }];

  // A canvas cannot be resized once anything is on it, so the height is added up first.
  let h = 300;
  h += HEAD + 110 + numbers.length * ROW;
  h += HEAD + 42 + (distance.length + 1) * ROW;
  if (lagRows.length) h += HEAD + lagRows.length * ROW;
  h += HEAD + missRows.length * ROW + biasLines.length * LEAD + (biasLines.length ? 16 : 0);
  if (breakRows.length) h += HEAD + 42 + breakRows.length * ROW;
  if (sideRows.length) h += HEAD + 42 + sideRows.length * ROW;
  for (const b of insightBlocks) h += 60 + b.detail.length * LEAD + b.drill.length * LEAD + 16;
  if (insightBlocks.length) h += HEAD;
  h += HEAD + 42 + (holes.length + bands.length) * HOLE_ROW;
  if (bleedLines.length) h += 24 + bleedLines.length * LEAD;
  h += 120;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = h;
  const c = canvas.getContext('2d')!;
  const p: Pen = { c, y: 0 };

  c.fillStyle = PAPER;
  c.fillRect(0, 0, W, h);

  p.y = 128;
  text(p, 'BREAK!', PAD, 58, 900, INK);
  text(p, 'PUTTING', W - PAD, 24, 600, INK3, 'right', 4);
  p.y += 26;
  rule(p, INK, 4);

  p.y += 66;
  text(p, fmtDateLong(round.date), PAD, 46, 800, INK);
  p.y += 42;
  text(
    p,
    [
      courseLabel(round),
      putter,
      round.greenSpeed
        ? `${round.greenSpeed} greens, stimp ${GREEN_SPEED_STIMP[round.greenSpeed]}`
        : null,
      round.competitive ? 'competitive' : null,
    ]
      .filter(Boolean)
      .join('  ·  '),
    PAD,
    26,
    500,
    INK2,
  );

  heading(p, 'The numbers');
  p.y += 20;
  c.fillStyle = CARD;
  c.fillRect(PAD, p.y, INNER, 110);
  c.strokeStyle = LINE;
  c.lineWidth = 2;
  c.strokeRect(PAD, p.y, INNER, 110);
  p.y += 44;
  text(p, 'STROKES GAINED PUTTING', PAD + 26, 23, 600, INK3, 'left', 3);
  p.y += 46;
  text(p, signed2(s.sg), PAD + 26, 56, 800, s.sg >= 0 ? GOOD : RED);
  p.y += 20;
  for (const [k, v, color] of numbers) statRow(p, k, v, color);

  heading(p, 'By distance');
  const dCols: Col[] = [
    { label: 'DISTANCE', x: PAD, align: 'left' },
    { label: 'MADE', x: W - PAD - 400, align: 'right' },
    { label: '%', x: W - PAD - 210, align: 'right' },
    { label: 'SG', x: W - PAD, align: 'right' },
  ];
  tableHead(p, dCols);
  for (const { b, t } of distance) {
    const made = pct(t);
    tableRow(p, dCols, [
      { t: b.label },
      { t: `${t.makes}/${t.attempts}`, color: INK2, weight: 600 },
      { t: made === null ? '--' : `${made.toFixed(0)}%`, weight: 700 },
      {
        t: t.sgPutts === 0 ? '--' : signed2(t.sg),
        color: t.sgPutts === 0 ? INK3 : t.sg >= 0 ? GOOD : RED,
        weight: 800,
      },
    ]);
  }
  tableRow(p, dCols, [
    { t: 'Total', weight: 800 },
    { t: `${s.totalPutts - s.missedPutts}/${s.totalPutts}`, color: INK2, weight: 700 },
    { t: '', weight: 700 },
    { t: signed2(s.sg), color: s.sg >= 0 ? GOOD : RED, weight: 800 },
  ]);

  if (lagRows.length) {
    heading(p, 'Lag control');
    for (const [k, v] of lagRows) statRow(p, k, v);
  }

  heading(p, 'Miss patterns');
  for (const [k, v] of missRows) statRow(p, k, v);
  if (biasLines.length) {
    p.y += 16;
    paragraph(p, biasLines, 27, 500, INK2);
  }

  if (breakRows.length) {
    heading(p, 'How the putt broke');
    const bCols: Col[] = [
      { label: 'BREAK', x: PAD, align: 'left' },
      { label: 'PUTTS', x: W - PAD - 480, align: 'right' },
      { label: 'AVG FT', x: W - PAD - 340, align: 'right' },
      { label: 'MADE', x: W - PAD - 190, align: 'right' },
      { label: 'HIGH', x: W - PAD - 90, align: 'right' },
      { label: 'LOW', x: W - PAD, align: 'right' },
    ];
    tableHead(p, bCols);
    for (const { label, t } of breakRows) {
      tableRow(p, bCols, [
        { t: label },
        { t: String(t.attempts), color: INK2, weight: 600 },
        { t: t.attempts ? (t.feet / t.attempts).toFixed(0) : '--', color: INK2, weight: 600 },
        { t: `${t.makes}/${t.attempts}`, weight: 700 },
        { t: t.high ? String(t.high) : '--', color: t.high ? INK : INK3, weight: 600 },
        { t: t.low ? String(t.low) : '--', color: t.low ? INK : INK3, weight: 600 },
      ]);
    }
  }

  if (sideRows.length) {
    heading(p, 'Miss side by distance');
    const sCols: Col[] = [
      { label: 'DISTANCE', x: PAD, align: 'left' },
      { label: 'HIGH', x: W - PAD - 320, align: 'right' },
      { label: 'LOW', x: W - PAD - 160, align: 'right' },
      { label: 'ON LINE', x: W - PAD, align: 'right' },
    ];
    tableHead(p, sCols);
    for (const { b, t } of sideRows) {
      tableRow(p, sCols, [
        { t: b.label },
        { t: t.high ? String(t.high) : '--', color: t.high ? INK : INK3, weight: 700 },
        { t: t.low ? String(t.low) : '--', color: t.low ? INK : INK3, weight: 700 },
        { t: t.online ? String(t.online) : '--', color: t.online ? INK : INK3, weight: 700 },
      ]);
    }
  }

  if (insightBlocks.length) {
    heading(p, 'What to work on');
    for (const b of insightBlocks) {
      p.y += 60;
      text(p, b.title, PAD, 30, 800, INK);
      paragraph(p, b.detail, 26, 500, INK2);
      paragraph(p, b.drill, 24, 500, INK3);
      p.y += 16;
    }
  }

  heading(p, 'Hole by hole');
  const hCols: Col[] = [
    { label: 'HOLE', x: PAD, align: 'left' },
    { label: 'PAR', x: PAD + 74, align: 'left' },
    { label: 'PUTTS', x: PAD + 128, align: 'left' },
    { label: 'SCORE', x: W - PAD - 250, align: 'right' },
    { label: '+/-', x: W - PAD - 165, align: 'right' },
    { label: '#', x: W - PAD - 95, align: 'right' },
    { label: 'SG', x: W - PAD, align: 'right' },
  ];
  tableHead(p, hCols);

  const triggers = new Set(bleeds.map((b) => b.triggerHole));
  const bledInto = new Set(bleeds.flatMap((b) => b.holes));
  let carried = 0;
  for (const hole of holes) {
    const vs = holeVsPar(hole);
    if (vs !== undefined) carried += vs;
    const gained = hole.putts.length
      ? holeSG(baseline, hole.putts.map((x) => x.d), hole.putts.length)
      : null;
    const mark = triggers.has(hole.hole) ? '• ' : bledInto.has(hole.hole) ? '· ' : '';
    const seq = hole.putts.length ? puttSequence(hole.putts) : holedOut(hole) ? 'chipped in' : '--';

    tableRow(
      p,
      hCols,
      [
        { t: String(hole.hole), weight: 800, color: INK2 },
        { t: hole.par != null ? String(hole.par) : '', color: INK3 },
        { t: `${mark}${seq}` },
        {
          t: hole.strokes != null ? String(hole.strokes) : '',
          weight: 800,
          color: vs != null && vs < 0 ? GOOD : INK,
        },
        {
          t: vs === undefined ? '' : carried === 0 ? 'E' : carried > 0 ? `+${carried}` : String(carried),
          color: carried < 0 ? GOOD : INK3,
          weight: 600,
        },
        { t: hole.putts.length ? String(hole.putts.length) : '', weight: 800 },
        {
          t: gained === null ? '' : signed2(gained),
          weight: gained !== null && gained <= -0.5 ? 800 : 600,
          color: gained === null ? INK3 : gained < 0 ? RED : gained > 0 ? GOOD : INK3,
        },
      ],
      hole.putts.length >= 3,
    );
  }

  for (const band of bands) {
    const inBand = holes.filter((x) => x.hole >= band.from && x.hole <= band.to);
    const par = inBand.reduce((n, x) => n + (x.strokes !== undefined ? x.par ?? 0 : 0), 0);
    const strokes = inBand.reduce((n, x) => n + (x.strokes ?? 0), 0);
    const putts = inBand.reduce((n, x) => n + x.putts.length, 0);
    const rel = inBand.reduce((n, x) => n + (holeVsPar(x) ?? 0), 0);
    const bandSg = inBand.reduce(
      (n, x) =>
        n + (x.putts.length ? holeSG(baseline, x.putts.map((q) => q.d), x.putts.length) : 0),
      0,
    );
    p.y += HOLE_ROW;
    c.fillStyle = band.label === 'Total' ? '#e9e5d9' : '#efece2';
    c.fillRect(PAD - 18, p.y - 32, INNER + 36, HOLE_ROW - 6);
    text(p, String(par || ''), PAD + 74, 24, 700, INK3);
    text(p, band.label, PAD + 128, 26, 800, INK2);
    text(p, String(strokes || ''), W - PAD - 250, 27, 800, INK, 'right');
    text(p, rel === 0 ? 'E' : rel > 0 ? `+${rel}` : String(rel), W - PAD - 165, 24, 700, rel < 0 ? GOOD : INK3, 'right');
    text(p, String(putts || ''), W - PAD - 95, 27, 800, INK, 'right');
    text(p, signed2(bandSg), W - PAD, 24, 800, bandSg >= 0 ? GOOD : RED, 'right');
  }

  if (bleedLines.length) {
    p.y += 24;
    paragraph(p, bleedLines, 24, 500, INK3);
  }

  p.y += 56;
  text(p, 'break.conorfayard.com', PAD, 25, 600, INK3);

  return canvas;
}

function biasSentence(b: ReturnType<typeof readBias>): string {
  const sided = b.high + b.low;
  if (!sided) return '';
  if (b.verdict === 'stroke' || b.verdict === 'thin') {
    return b.onlineShare !== null && b.online > 0
      ? `Misses split ${b.high} high and ${b.low} low, close to even, and ${b.online} were dead on line. The read was right and the speed was wrong.`
      : `Misses split ${b.high} high and ${b.low} low, close to even.`;
  }
  const side = b.side === 'high' ? 'high' : 'low';
  const hedge = b.verdict === 'leaning' ? 'leaning' : 'reading';
  return `${Math.round(b.lean * 100)}% of sided misses finished ${side}, so the read is ${hedge} ${side} off ${sided} misses.`;
}

/**
 * Synchronous on purpose. iOS drops the user gesture if anything is awaited before share is
 * called, and canvas.toBlob is a callback, so the PNG is decoded out of a data URL instead.
 */
export function pngFile(canvas: HTMLCanvasElement, name: string): File {
  const url = canvas.toDataURL('image/png');
  const binary = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: 'image/png' });
}
