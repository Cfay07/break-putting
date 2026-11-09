/**
 * A putting metronome. One stroke is three beats: start back, top, impact. The backstroke takes
 * `ratio` times as long as the through stroke, so a 2 to 1 rhythm at 1.0 s is 0.67 s back and
 * 0.33 s through. The stroke time stays the same at every length: only the length changes.
 */
export interface TempoSettings {
  /** Seconds from start back to impact. */
  stroke: number;
  /** Backstroke time over through-stroke time. */
  ratio: number;
  /** Seconds from one stroke's start to the next, so there is time to set up the next ball. */
  every: number;
  sound: boolean;
  /** Android only: the phone buzzes each beat, so it works from a pocket with no sound at all. */
  buzz: boolean;
  /** Every third stroke plays silent, so the rhythm has to come from you. */
  fade: boolean;
}

export const TEMPO_DEFAULTS: TempoSettings = { stroke: 1.0, ratio: 2, every: 6, sound: true, buzz: false, fade: false };

const KEY = 'break.tempo';

export function loadTempo(): TempoSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...TEMPO_DEFAULTS, ...(JSON.parse(raw) as Partial<TempoSettings>) } : TEMPO_DEFAULTS;
  } catch {
    return TEMPO_DEFAULTS;
  }
}

export function saveTempo(t: TempoSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    // Private mode: the settings just do not stick.
  }
}

export const canBuzz = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

export type Beat = 'start' | 'top' | 'impact';

/** When each beat lands, in seconds from the start of the stroke. */
export function beatTimes(t: Pick<TempoSettings, 'stroke' | 'ratio'>): [number, number, number] {
  const back = (t.stroke * t.ratio) / (t.ratio + 1);
  return [0, back, t.stroke];
}

export const isSilent = (t: Pick<TempoSettings, 'fade'>, stroke: number) => t.fade && stroke % 3 === 2;

/** A soft woodblock: a short sine with a fast decay. Quiet on purpose, other people are putting. */
function tick(ctx: AudioContext, at: number, beat: Beat) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = beat === 'impact' ? 520 : 880;
  const peak = beat === 'impact' ? 0.22 : 0.14;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.09);
}

const BUZZ: Record<Beat, number> = { start: 25, top: 25, impact: 60 };

/**
 * Beats are scheduled on the audio clock a little ahead of time, which keeps them on time to the
 * millisecond even when the page is busy. A timer only decides what to schedule next.
 */
export function startTempo(settings: TempoSettings, onBeat: (beat: Beat, stroke: number, silent: boolean) => void) {
  const ctx = new AudioContext();
  const times = beatTimes(settings);
  const beats: Beat[] = ['start', 'top', 'impact'];
  let stroke = 0;
  let next = ctx.currentTime + 0.4;
  const timers: number[] = [];

  const schedule = () => {
    while (next < ctx.currentTime + 0.3) {
      const silent = isSilent(settings, stroke);
      const n = stroke;
      times.forEach((offset, i) => {
        const at = next + offset;
        if (settings.sound && !silent) tick(ctx, at, beats[i]);
        const wait = Math.max(0, (at - ctx.currentTime) * 1000);
        timers.push(
          window.setTimeout(() => {
            if (settings.buzz && !silent && canBuzz()) navigator.vibrate(BUZZ[beats[i]]);
            onBeat(beats[i], n, silent);
          }, wait),
        );
        if (timers.length > 60) timers.splice(0, timers.length - 60);
      });
      stroke++;
      next += settings.every;
    }
  };
  schedule();
  const loop = window.setInterval(schedule, 50);

  return () => {
    window.clearInterval(loop);
    timers.forEach((t) => window.clearTimeout(t));
    void ctx.close();
  };
}
