import type { BreakDir } from '../lib/types';

const STOPS = [
  { n: 1, label: 'Slight', bend: 5 },
  { n: 2, label: 'Some', bend: 13 },
  { n: 3, label: 'Lots', bend: 23 },
  { n: 4, label: 'Severe', bend: 34 },
] as const;

const WORD: Record<number, string> = { 1: 'slight', 2: 'some', 3: 'lots of', 4: 'severe' };

function wording(
  readAs: number | undefined,
  brokeAs: number | undefined,
  wrongWay: boolean,
  double: boolean,
): string {
  if (wrongWay && readAs !== undefined) {
    return `Read ${WORD[readAs]} break the other way. It turned back on you.`;
  }
  if (readAs === undefined) {
    return double
      ? 'It turns both ways, so rate the break over the last few feet, the one that decides it'
      : 'Tap how the break looked before you hit it';
  }
  if (brokeAs === undefined || brokeAs === readAs) {
    return `Read ${WORD[readAs]} break. Tap again if it moved more or less.`;
  }
  const off = Math.abs(brokeAs - readAs);
  const way = brokeAs > readAs ? 'under-read' : 'over-read';
  return `Read ${WORD[readAs]}, moved ${WORD[brokeAs]}. ${off === 1 ? 'A notch' : `${off} notches`} ${way}.`;
}

/**
 * A ball path, not a number scale. A numeric read only means something to someone who puts a
 * number on the slope before putting, and that locks out everyone who does not.
 *
 * The ball sits at the bottom and the hole at the top, both on x=0, so the four stops line up
 * and only the width of the bow changes. The bow goes to the high side, away from the way the
 * putt turns: a left to right putt is started left of the hole and falls back right into it.
 *
 * A quadratic peaks at half its control offset, so a bend of 34 reaches 17 either side. The
 * viewBox runs to 20 so the widest one clears its own stroke instead of being cut off.
 */
function Curve({ bend, dir, double, on }: { bend: number; dir: BreakDir | undefined; double: boolean; on: boolean }) {
  // A double breaker is an S, and only the bend at the hole is being rated, so the low bend is
  // held constant and the high one grows. The four stops then differ in exactly the thing the
  // scale is asking about.
  const d = double
    ? `M 0 32.5 C -9 25 ${bend} 15 0 9.5`
    : `M 0 32.5 Q ${dir === 'L→R' ? -bend : bend} 19 0 9.5`;
  return (
    <svg width="40" height="40" viewBox="-20 0 40 40" aria-hidden="true">
      <circle cx="0" cy="6" r="3" fill="none" stroke="currentColor" strokeWidth="1.3" opacity={on ? 1 : 0.5} />
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={on ? 2.6 : 2}
        strokeLinecap="round"
        opacity={on ? 1 : 0.5}
      />
      <circle cx="0" cy="35" r="2.4" fill="currentColor" opacity={on ? 1 : 0.5} />
    </svg>
  );
}

export function ReadBreak({
  dirs,
  readAs,
  brokeAs,
  wrongWay,
  onPick,
}: {
  dirs: BreakDir[];
  readAs: number | undefined;
  brokeAs: number | undefined;
  wrongWay: boolean;
  onPick: (
    readAs: number | undefined,
    brokeAs: number | undefined,
    wrongWay: boolean,
  ) => void;
}) {
  // A double breaker turns both ways, so there is no single side to bow it to: it gets an S.
  const lr = dirs.includes('L→R');
  const rl = dirs.includes('R→L');
  const double = lr && rl;
  const dir = double ? undefined : lr ? 'L→R' : 'R→L';

  const actual = brokeAs ?? readAs;
  const lo = readAs !== undefined && actual !== undefined ? Math.min(readAs, actual) : null;
  const hi = readAs !== undefined && actual !== undefined ? Math.max(readAs, actual) : null;

  const tap = (n: number) => {
    if (readAs === undefined) return onPick(n, undefined, false);
    // Tapping the read again clears it, so a mis-tap is one more tap to undo.
    if (n === readAs && brokeAs === undefined && !wrongWay) return onPick(undefined, undefined, false);
    if (n === readAs) return onPick(n, undefined, false);
    onPick(readAs, n, false);
  };

  // Only ever the second answer: it says what the putt did, not what was seen.
  const tapWrongWay = () => onPick(readAs, undefined, !wrongWay);

  return (
    <div>
      <div className="brk-row">
        {STOPS.map((s) => {
          const isRead = s.n === readAs;
          const isActual = brokeAs !== undefined && s.n === brokeAs;
          const between = lo !== null && hi !== null && s.n > lo && s.n < hi;
          const cls = ['brk-stop', isRead ? 'read' : '', isActual ? 'actual' : '', between ? 'span' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={s.n}
              type="button"
              className={cls}
              aria-pressed={isRead || isActual}
              aria-label={s.label}
              onClick={() => tap(s.n)}
            >
              <Curve bend={s.bend} dir={dir} double={double} on={(isRead || isActual) && !wrongWay} />
              <span className="brk-label">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* The line that says what to do comes before the control it unlocks. The other way round
          read as a broken button: the instruction to pick a read sat underneath the thing that
          was greyed out waiting for one. */}
      <p className={readAs === undefined ? 'small brk-read' : 'small brk-read on'}>
        {wording(readAs, brokeAs, wrongWay, double)}
      </p>

      {/* A complete misread is not a bigger version of reading too little, so it sits apart
          from the scale rather than becoming a fifth stop on it. Always drawn so it can be
          found, inert until there is a read for it to contradict. */}
      <button
        type="button"
        className={wrongWay ? 'brk-wrong on' : 'brk-wrong'}
        aria-pressed={wrongWay}
        disabled={readAs === undefined}
        onClick={tapWrongWay}
      >
        {readAs === undefined ? 'Pick your read first' : 'It broke the other way'}
      </button>
    </div>
  );
}
