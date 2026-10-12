import { bleedsIn } from './bleed';
import { fmtDateLong, puttSequence } from './format';
import { holeSG } from './sg';
import { BUCKETS, courseLabel, lagSaves, pct, type Stats } from './stats';
import { GREEN_SPEED_STIMP, holeVsPar, holedOut, type Round } from './types';

/**
 * A whole round as one tall image, the way a fantasy app sends a week. The point is one send
 * instead of five screenshots, so everything on the round page is on here: the numbers, every
 * distance band, lag control, where the misses went, and the card hole by hole.
 */
const W = 1080;
const PAD = 72;

const INK = '#14392b';
const INK2 = '#4d6558';
const INK3 = '#8c9a92';
const PAPER = '#f2efe6';
const CARD = '#fbf9f3';
const LINE = 'rgba(20, 57, 43, 0.18)';
const RED = '#a52a1f';
const GOOD = '#1f7a4d';

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

function rule(p: Pen, color = LINE, weight = 2) {
  p.c.strokeStyle = color;
  p.c.lineWidth = weight;
  p.c.beginPath();
  p.c.moveTo(PAD, p.y);
  p.c.lineTo(W - PAD, p.y);
  p.c.stroke();
}

function heading(p: Pen, label: string) {
  p.y += 84;
  text(p, label.toUpperCase(), PAD, 24, 700, INK3, 'left', 4);
  p.y += 20;
  rule(p, INK, 3);
}

function statRow(p: Pen, k: string, v: string, color = INK) {
  p.y += 56;
  text(p, k, PAD, 29, 500, INK2);
  text(p, v, W - PAD, 31, 800, color, 'right');
  p.y += 14;
  rule(p);
  p.y -= 14;
}

/** Gathered once, so the height can be worked out before the canvas is sized. */
function collect(round: Round, stats: Stats, putter?: string) {
  const bleeds = bleedsIn(round);
  const bled = bleeds.reduce((n, b) => n + b.shots, 0);
  const lag = lagSaves([round]);
  const scoring = pct(stats.scoring);
  const p = stats.pattern;

  const numbers: [string, string, string][] = [
    ['Score', round.score != null ? String(round.score) : '--', INK],
    ['Putts', String(stats.totalPutts), INK],
    ['Putts per hole', stats.puttsPerHole.toFixed(2), INK],
    ['1 / 2 / 3+ putts', `${stats.onePutts} / ${stats.twoPutts} / ${stats.threePlus}`, INK],
    ['Make % from 3 to 10 ft', scoring === null ? '--' : `${scoring.toFixed(0)}%`, INK],
    ['Feet of putts holed', String(Math.round(stats.makesTotalFeet)), INK],
  ];
  if (bled > 0) numbers.push(['Shots lost after a mistake', `-${bled}`, RED]);

  const distance = BUCKETS.map((b) => ({ b, t: stats.buckets[b.key] }))
    .filter(({ t }) => t.attempts > 0)
    .map(({ b, t }) => {
      const made = pct(t);
      return [
        b.label,
        `${t.makes}/${t.attempts}`,
        made === null ? '--' : `${made.toFixed(0)}%`,
        t.sgPutts === 0 ? '--' : `${t.sg >= 0 ? '+' : ''}${t.sg.toFixed(2)}`,
      ];
    });

  const lagRows: [string, string][] = [];
  if (lag.lags > 0) {
    lagRows.push(['First putts from 30+ ft', String(lag.lags)]);
    if (stats.avgLeave !== null) {
      lagRows.push([
        'Typical leave',
        `${stats.avgLeave.toFixed(1)} ft${
          stats.avgLeavePct !== null ? ` · ${stats.avgLeavePct.toFixed(0)}% of the putt` : ''
        }`,
      ]);
    }
    lagRows.push([
      'Left yourself 4+ ft',
      `${Math.round((lag.bad / lag.lags) * 100)}% · ${lag.bad} of ${lag.lags}`,
    ]);
    if (lag.avgBadLeave !== null) lagRows.push(['The comeback', `${lag.avgBadLeave.toFixed(1)} ft`]);
    if (lag.bad > 0) {
      lagRows.push([
        'Holed it',
        `${Math.round((lag.saved / lag.bad) * 100)}% · ${lag.saved} of ${lag.bad}`,
      ]);
    }
  }

  const missRows: [string, string][] = [];
  if (p.high + p.low + p.online) {
    missRows.push(['High / low / on line', `${p.high} / ${p.low} / ${p.online}`]);
  }
  if (p.short + p.good + p.long) {
    missRows.push(['Short / good / long', `${p.short} / ${p.good} / ${p.long}`]);
  }
  if (stats.lipOuts) missRows.push(['Lip-outs', String(stats.lipOuts)]);

  const holes = round.holes.filter((h) => h.putts.length || h.strokes !== undefined);
  return { numbers, distance, lagRows, missRows, holes, bleeds, putter };
}

const ROW = 56;
const HOLE_ROW = 50;

export interface CardInput {
  round: Round;
  stats: Stats;
  baseline: [number, number][];
  putter?: string;
}

export function drawRoundSheet({ round, stats, baseline, putter }: CardInput): HTMLCanvasElement {
  const d = collect(round, stats, putter);

  // A canvas cannot be resized once anything is on it, so the height is added up first.
  let h = 300;
  h += 104 + 110 + d.numbers.length * ROW;
  h += 104 + 46 + d.distance.length * ROW;
  if (d.lagRows.length) h += 104 + d.lagRows.length * ROW;
  if (d.missRows.length) h += 104 + d.missRows.length * ROW;
  h += 104 + 46 + d.holes.length * HOLE_ROW + 70;
  h += 130;

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

  p.y += 68;
  text(p, fmtDateLong(round.date), PAD, 46, 800, INK);
  p.y += 42;
  const sub = [
    courseLabel(round),
    putter,
    round.greenSpeed
      ? `${round.greenSpeed} greens, stimp ${GREEN_SPEED_STIMP[round.greenSpeed]}`
      : null,
    round.competitive ? 'competitive' : null,
  ]
    .filter(Boolean)
    .join('  ·  ');
  text(p, sub, PAD, 26, 500, INK2);

  const sg = stats.sg;
  heading(p, 'The numbers');
  p.y += 20;
  c.fillStyle = CARD;
  c.fillRect(PAD, p.y, W - PAD * 2, 110);
  c.strokeStyle = LINE;
  c.lineWidth = 2;
  c.strokeRect(PAD, p.y, W - PAD * 2, 110);
  p.y += 46;
  text(p, 'STROKES GAINED PUTTING', PAD + 26, 23, 600, INK3, 'left', 3);
  p.y += 44;
  text(p, `${sg >= 0 ? '+' : ''}${sg.toFixed(2)}`, PAD + 26, 56, 800, sg >= 0 ? GOOD : RED);
  p.y += 24;

  for (const [k, v, color] of d.numbers) statRow(p, k, v, color);

  heading(p, 'By distance');
  p.y += 42;
  const cols = [PAD, W - PAD - 400, W - PAD - 210, W - PAD];
  text(p, 'DISTANCE', cols[0], 21, 700, INK3, 'left', 2);
  text(p, 'MADE', cols[1], 21, 700, INK3, 'right', 2);
  text(p, '%', cols[2], 21, 700, INK3, 'right', 2);
  text(p, 'SG', cols[3], 21, 700, INK3, 'right', 2);
  for (const row of d.distance) {
    p.y += ROW;
    text(p, row[0], cols[0], 28, 500, INK);
    text(p, row[1], cols[1], 28, 600, INK2, 'right');
    text(p, row[2], cols[2], 28, 700, INK, 'right');
    text(p, row[3], cols[3], 28, 800, row[3].startsWith('-') ? RED : GOOD, 'right');
    p.y += 14;
    rule(p);
    p.y -= 14;
  }

  if (d.lagRows.length) {
    heading(p, 'Lag control');
    for (const [k, v] of d.lagRows) statRow(p, k, v);
  }

  if (d.missRows.length) {
    heading(p, 'Where the misses went');
    for (const [k, v] of d.missRows) statRow(p, k, v);
  }

  heading(p, 'Hole by hole');
  p.y += 42;
  const hc = {
    hole: PAD,
    // "HOLE" is wider than a hole number, so the gap is set by the header and not the value.
    par: PAD + 74,
    seq: PAD + 128,
    score: W - PAD - 190,
    putts: W - PAD - 108,
    sg: W - PAD,
  };
  text(p, 'HOLE', hc.hole, 21, 700, INK3, 'left', 2);
  text(p, 'PAR', hc.par, 21, 700, INK3, 'left', 2);
  text(p, 'PUTTS', hc.seq, 21, 700, INK3, 'left', 2);
  text(p, 'SCORE', hc.score, 21, 700, INK3, 'right', 2);
  text(p, '#', hc.putts, 21, 700, INK3, 'right', 2);
  text(p, 'SG', hc.sg, 21, 700, INK3, 'right', 2);

  const triggers = new Set(d.bleeds.map((b) => b.triggerHole));
  for (const hole of d.holes) {
    p.y += HOLE_ROW;
    const vs = holeVsPar(hole);
    const gained = hole.putts.length
      ? holeSG(baseline, hole.putts.map((x) => x.d), hole.putts.length)
      : null;

    if (hole.putts.length >= 3) {
      c.fillStyle = 'rgba(165, 42, 31, 0.07)';
      c.fillRect(PAD - 18, p.y - 32, W - PAD * 2 + 36, HOLE_ROW - 8);
    }

    text(p, String(hole.hole), hc.hole, 26, 800, INK2);
    text(p, hole.par != null ? String(hole.par) : '', hc.par, 22, 500, INK3);
    const seq = hole.putts.length ? puttSequence(hole.putts) : holedOut(hole) ? 'chipped in' : '--';
    text(p, `${triggers.has(hole.hole) ? '• ' : ''}${seq}`, hc.seq, 25, 500, INK);
    text(
      p,
      hole.strokes != null ? String(hole.strokes) : '',
      hc.score,
      27,
      800,
      vs != null && vs < 0 ? GOOD : INK,
      'right',
    );
    text(p, hole.putts.length ? String(hole.putts.length) : '', hc.putts, 27, 800, INK, 'right');
    if (gained !== null) {
      text(
        p,
        `${gained > 0 ? '+' : ''}${gained.toFixed(2)}`,
        hc.sg,
        23,
        gained <= -0.5 ? 800 : 600,
        gained < 0 ? RED : gained > 0 ? GOOD : INK3,
        'right',
      );
    }
    p.y += 12;
    rule(p);
    p.y -= 12;
  }

  p.y += 70;
  text(p, `${stats.totalPutts} putts`, PAD, 28, 800, INK);
  text(p, `${sg >= 0 ? '+' : ''}${sg.toFixed(2)}`, W - PAD, 28, 800, sg >= 0 ? GOOD : RED, 'right');

  p.y = h - 60;
  text(p, 'break.conorfayard.com', PAD, 25, 600, INK3);
  if (triggers.size) {
    text(p, '•  a putting mistake', W - PAD, 23, 500, INK3, 'right');
  }

  return canvas;
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
