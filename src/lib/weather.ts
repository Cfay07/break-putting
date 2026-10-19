/**
 * Rain on the day of a round, from Open-Meteo's archive. Free and keyless, and town resolution
 * is plenty: rainfall does not change meaningfully across a golf course.
 *
 * Recorded only. It never adjusts strokes gained or expected putts, because nobody knows what a
 * wet green is worth yet and inventing a number would make the whole stat incomparable to tour,
 * to DECADE and to a teammate. Once there are enough wet rounds the cost can be learned from
 * them instead of guessed.
 */
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';

export async function rainOn(date: string, lat: number, lon: number): Promise<number | null> {
  const url =
    `${ARCHIVE}?latitude=${lat}&longitude=${lon}` +
    `&start_date=${date}&end_date=${date}&daily=precipitation_sum&timezone=auto`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { daily?: { precipitation_sum?: (number | null)[] } };
    const mm = data.daily?.precipitation_sum?.[0];
    return typeof mm === 'number' ? mm : null;
  } catch {
    return null;
  }
}

/** Anything under a couple of tenths is dew, not weather. */
export const RAIN_FLOOR = 0.2;

export function rainWords(mm: number): string {
  if (mm < RAIN_FLOOR) return 'dry';
  if (mm < 2) return `${mm.toFixed(1)} mm, light`;
  if (mm < 10) return `${mm.toFixed(1)} mm, wet`;
  return `${mm.toFixed(0)} mm, soaked`;
}
