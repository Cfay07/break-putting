import { fmtDateLong, signed } from './format';
import type { Moment } from './moments';
import { pngFile } from './shareCard';
import { roundSG } from './sg';
import type { Round } from './types';

/** A story-sized picture of one moment, for Instagram or a group chat. */
const W = 1080;
const H = 1920;
const PAD = 84;
const GREEN = '#14392b';
const FAINT = '#1d4a38';
const PAPER = '#f2efe6';
const MUTED = '#a9c2b5';
const ORANGE = '#e8935f';

const font = (w: number, s: number) => `${w} ${s}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;

function wrap(c: CanvasRenderingContext2D, s: string, maxW: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawMoment(m: Moment, round: Round, baseline: [number, number][]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d')!;
  c.fillStyle = GREEN;
  c.fillRect(0, 0, W, H);
  c.textBaseline = 'alphabetic';

  c.fillStyle = PAPER;
  c.font = font(900, 72);
  c.fillText('BREAK!', PAD, 150);
  c.font = font(700, 34);
  c.fillStyle = MUTED;
  c.textAlign = 'right';
  c.fillText(fmtDateLong(round.date).toUpperCase(), W - PAD, 146);
  c.textAlign = 'left';
  c.fillStyle = PAPER;
  c.fillRect(PAD, 182, W - PAD * 2, 5);

  let y = 300;
  const chip = (m.tag ?? m.label).toUpperCase();
  c.font = font(800, 36);
  const cw = c.measureText(chip).width + 56;
  c.fillStyle = m.low ? PAPER : ORANGE;
  c.beginPath();
  c.roundRect(PAD, y - 56, cw, 80, 40);
  c.fill();
  c.fillStyle = GREEN;
  c.fillText(chip, PAD + 28, y - 4);
  c.fillStyle = MUTED;
  c.font = font(800, 36);
  c.textAlign = 'right';
  c.fillText(m.odds.toUpperCase(), W - PAD, y - 4);
  c.textAlign = 'left';

  y += 80;
  c.font = font(900, 420);
  const num = c.measureText(m.big);
  const numH = num.actualBoundingBoxAscent;
  y += numH;
  c.fillStyle = PAPER;
  c.fillText(m.big, PAD - 10, y);
  if (m.unit) {
    c.font = font(900, m.unit.length > 6 ? 84 : 140);
    c.fillStyle = MUTED;
    const ux = PAD + num.width + 16;
    if (ux + c.measureText(m.unit).width < W - PAD) c.fillText(m.unit, ux, y);
    else {
      y += 110;
      c.fillText(m.unit, PAD, y);
    }
  }

  y += 110;
  c.font = font(700, 54);
  c.fillStyle = PAPER;
  for (const line of wrap(c, m.line, W - PAD * 2)) {
    c.fillText(line, PAD, y);
    y += 72;
  }

  if (m.viz?.t === 'line') {
    const top = y + 30;
    c.fillStyle = FAINT;
    c.beginPath();
    c.ellipse(W / 2, top + 190, 520, 190, 0, 0, Math.PI * 2);
    c.fill();
    const l = m.viz.dirs.includes('L→R');
    const r = m.viz.dirs.includes('R→L');
    const sx = r && !l ? 760 : !l && !r ? 540 : 320;
    const ex = r && !l ? 300 : !l && !r ? 540 : 780;
    c.strokeStyle = PAPER;
    c.lineWidth = 9;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(sx, top + 320);
    if (l && r) {
      c.bezierCurveTo(120, top + 250, 700, top + 260, 560, top + 190);
      c.bezierCurveTo(440, top + 130, 700, top + 60, ex, top + 80);
    } else if (l || r) {
      c.bezierCurveTo(sx + (l ? -120 : 120), top + 140, (sx + ex) / 2, top + 70, ex, top + 80);
    } else {
      c.lineTo(ex, top + 80);
    }
    c.stroke();
    c.fillStyle = PAPER;
    c.beginPath();
    c.arc(sx, top + 320, 18, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#0d2a1f';
    c.beginPath();
    c.arc(ex, top + 80, 30, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = ORANGE;
    c.beginPath();
    c.arc(ex, top + 80, 13, 0, Math.PI * 2);
    c.fill();
  }

  const putts = round.holes.reduce((n, h) => n + h.putts.length, 0);
  const foot: [string, string, string][] = [
    [round.score !== undefined ? String(round.score) : String(round.holes.reduce((n, h) => n + (h.strokes ?? 0), 0) || '--'), 'score', PAPER],
    [String(putts), 'putts', PAPER],
    [signed(roundSG(round, baseline)), 'strokes gained putting', ORANGE],
  ];
  const fy = H - 300;
  c.fillStyle = 'rgba(242,239,230,.22)';
  c.fillRect(PAD, fy - 30, W - PAD * 2, 3);
  const colW = (W - PAD * 2) / 3;
  foot.forEach(([v, l, col], i) => {
    c.fillStyle = col;
    c.font = font(900, 96);
    c.fillText(v, PAD + colW * i, fy + 90);
    c.fillStyle = MUTED;
    c.font = font(600, 30);
    c.fillText(l, PAD + colW * i, fy + 136);
  });
  if (round.course) {
    c.fillStyle = MUTED;
    c.font = font(600, 34);
    c.fillText(round.course, PAD, H - 80);
  }
  return canvas;
}

/** Share sheet where the phone has one, a download where it does not. */
export async function shareMoment(m: Moment, round: Round, baseline: [number, number][]) {
  const canvas = drawMoment(m, round, baseline);
  const file = pngFile(canvas, `break-${round.date}-${m.kind}.png`);
  const payload = { files: [file], title: `${m.label}, ${fmtDateLong(round.date)}` };
  if (navigator.canShare?.(payload)) {
    try {
      await navigator.share(payload);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') throw e;
    }
    return;
  }
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = file.name;
  a.click();
}
