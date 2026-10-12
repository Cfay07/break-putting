import { fmtDateLong } from './format';
import { courseLabel, pct, type Stats } from './stats';
import { GREEN_SPEED_STIMP, type Round } from './types';

/**
 * A round as a square image, so sharing one is not a screenshot of a phone. A screenshot carries
 * the browser chrome, the nav bar and whatever was cut off at the fold; this carries the numbers
 * and nothing else.
 */
const S = 1080;
const PAD = 72;

const INK = '#14392b';
const INK2 = '#4d6558';
const INK3 = '#8c9a92';
const PAPER = '#f2efe6';
const CARD = '#fbf9f3';
const LINE = 'rgba(20, 57, 43, 0.14)';
const RED = '#a52a1f';
const GOOD = '#1f7a4d';

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function text(
  c: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  weight: number,
  color: string,
  align: CanvasTextAlign = 'left',
  track = 0,
) {
  c.fillStyle = color;
  c.textAlign = track ? 'left' : align;
  c.textBaseline = 'alphabetic';
  c.font = `${weight} ${size}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  if (!track) {
    c.fillText(s, x, y);
    return;
  }
  // Canvas has no letter-spacing everywhere yet, so the tracked labels are drawn a glyph at a time.
  const chars = [...s];
  const width = chars.reduce((n, ch) => n + c.measureText(ch).width + track, -track);
  let cx = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
  for (const ch of chars) {
    c.fillText(ch, cx, y);
    cx += c.measureText(ch).width + track;
  }
}

/** Shrink a string until it fits, rather than letting it run off the card. */
function fitted(c: CanvasRenderingContext2D, s: string, max: number, size: number, weight: number) {
  let n = size;
  for (;;) {
    c.font = `${weight} ${n}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
    if (c.measureText(s).width <= max || n <= 18) return n;
    n -= 2;
  }
}

export interface CardInput {
  round: Round;
  stats: Stats;
  putter?: string;
  bled: number;
}

export function drawRoundCard({ round, stats, putter, bled }: CardInput): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const c = canvas.getContext('2d')!;

  c.fillStyle = PAPER;
  c.fillRect(0, 0, S, S);

  text(c, 'BREAK!', PAD, 132, 58, 900, INK);
  text(c, 'PUTTING', S - PAD, 128, 24, 600, INK3, 'right', 4);
  c.fillStyle = INK;
  c.fillRect(PAD, 156, S - PAD * 2, 4);

  const dateSize = fitted(c, fmtDateLong(round.date), S - PAD * 2, 50, 800);
  text(c, fmtDateLong(round.date), PAD, 240, dateSize, 800, INK);

  const where = courseLabel(round);
  if (where) {
    const n = fitted(c, where, S - PAD * 2, 30, 500);
    text(c, where, PAD, 286, n, 500, INK2);
  }

  // The two numbers anyone actually wants to see.
  const top = 330;
  const hero = 250;
  c.fillStyle = CARD;
  roundRect(c, PAD, top, S - PAD * 2, hero, 20);
  c.fill();
  c.strokeStyle = LINE;
  c.lineWidth = 2;
  c.stroke();

  const half = (S - PAD * 2) / 2;
  const sg = stats.sg;
  text(c, 'SCORE', PAD + half / 2, top + 62, 24, 600, INK3, 'center', 4);
  text(c, round.score != null ? String(round.score) : '--', PAD + half / 2, top + 182, 108, 800, INK, 'center');
  text(c, 'STROKES GAINED', PAD + half + half / 2, top + 62, 24, 600, INK3, 'center', 4);
  text(
    c,
    `${sg >= 0 ? '+' : ''}${sg.toFixed(2)}`,
    PAD + half + half / 2,
    top + 182,
    108,
    800,
    sg >= 0 ? GOOD : RED,
    'center',
  );

  c.strokeStyle = LINE;
  c.beginPath();
  c.moveTo(S / 2, top + 40);
  c.lineTo(S / 2, top + hero - 40);
  c.stroke();

  const scoring = pct(stats.scoring);
  const cells: [string, string, string][] = [
    ['PUTTS', String(stats.totalPutts), INK],
    ['3-PUTTS', String(stats.threePlus), stats.threePlus ? RED : INK],
    ['1-PUTTS', String(stats.onePutts), INK],
    ['3-10 FT', scoring === null ? '--' : `${scoring.toFixed(0)}%`, INK],
  ];
  const cw = (S - PAD * 2) / cells.length;
  cells.forEach(([label, value, color], i) => {
    const x = PAD + cw * i + cw / 2;
    text(c, label, x, 690, 22, 600, INK3, 'center', 3);
    text(c, value, x, 770, 68, 800, color, 'center');
  });

  c.strokeStyle = LINE;
  c.beginPath();
  c.moveTo(PAD, 830);
  c.lineTo(S - PAD, 830);
  c.stroke();

  const notes = [
    putter,
    round.greenSpeed ? `${round.greenSpeed} greens, stimp ${GREEN_SPEED_STIMP[round.greenSpeed]}` : null,
    round.competitive ? 'competitive' : null,
  ].filter(Boolean) as string[];
  if (notes.length) {
    const line = notes.join('  ·  ');
    text(c, line, PAD, 890, fitted(c, line, S - PAD * 2, 28, 500), 500, INK2);
  }

  if (bled > 0) {
    text(c, `${bled} shot${bled === 1 ? '' : 's'} lost after a putting mistake`, PAD, 940, 28, 700, RED);
  }

  text(c, 'break.conorfayard.com', PAD, S - 70, 26, 600, INK3);

  return canvas;
}

export type ShareResult = 'shared' | 'saved' | 'cancelled';

export async function shareRoundCard(input: CardInput): Promise<ShareResult> {
  const canvas = drawRoundCard(input);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('Could not draw the card.');

  const file = new File([blob], `break-${input.round.date}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      // Dismissing the sheet throws, and that is not a failure worth reporting.
      if ((e as Error).name === 'AbortError') return 'cancelled';
      throw e;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}
