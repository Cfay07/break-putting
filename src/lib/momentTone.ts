/**
 * Each kind of moment wears its own color from the app's palette, so a swipe through them reads
 * as different things. The share image uses the same colors as the card it came from.
 */
export type Tone = 'green' | 'clay' | 'paper' | 'slate';

const BY_KIND: Record<string, Tone> = {
  ace: 'green',
  albatross: 'green',
  eagle: 'green',
  longshot: 'green',
  chipIn: 'green',
  fewest: 'clay',
  noThree: 'green',
  perfect: 'paper',
  bestRound: 'slate',
  clean: 'clay',
  onePutts: 'paper',
  streak: 'paper',
  gotAway: 'paper',
  lag: 'slate',
};

export const toneOf = (kind: string): Tone => BY_KIND[kind] ?? 'green';

export const TONE_COLORS: Record<Tone, { bg: string; ink: string; muted: string; accent: string; pillInk: string; surface: string; cup: string }> = {
  green: { bg: '#14392b', ink: '#f2efe6', muted: '#a9c2b5', accent: '#e8935f', pillInk: '#14392b', surface: '#1d4a38', cup: '#0d2a1f' },
  clay: { bg: '#8f4523', ink: '#f7ece4', muted: '#f1c9b0', accent: '#f7ece4', pillInk: '#8f4523', surface: '#9e522e', cup: '#5e2a12' },
  paper: { bg: '#fbf9f3', ink: '#14392b', muted: '#5f7268', accent: '#b5603a', pillInk: '#ffffff', surface: '#eeebe1', cup: '#14392b' },
  slate: { bg: '#24363f', ink: '#eef1ef', muted: '#a8b9c0', accent: '#e8935f', pillInk: '#14392b', surface: '#2e4550', cup: '#141f25' },
};
