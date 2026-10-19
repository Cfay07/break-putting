const STOPS = [
  { n: 1, label: 'Slight', bend: 5 },
  { n: 2, label: 'Some', bend: 13 },
  { n: 3, label: 'Lots', bend: 23 },
  { n: 4, label: 'Severe', bend: 34 },
] as const;

const WORD: Record<number, string> = { 1: 'slight', 2: 'some', 3: 'lots of', 4: 'severe' };

function wording(readAs: number | undefined, brokeAs: number | undefined): string {
  if (readAs === undefined) return 'Tap how the break looked before you hit it';
  if (brokeAs === undefined || brokeAs === readAs) {
    return `Read ${WORD[readAs]} break. Tap again if it moved more or less.`;
  }
  const off = Math.abs(brokeAs - readAs);
  const way = brokeAs > readAs ? 'under-read' : 'over-read';
  return `Read ${WORD[readAs]}, moved ${WORD[brokeAs]}. ${off === 1 ? 'A notch' : `${off} notches`} ${way}.`;
}

/**
 * Curves rather than a number scale. A numeric read only means something to someone who puts a
 * number on the slope before putting, and that locks out everyone who does not. A shape is a
 * thing you watched.
 */
function Curve({ bend, on }: { bend: number; on: boolean }) {
  return (
    <svg width="32" height="40" viewBox="0 0 32 40" aria-hidden="true">
      <path
        d={`M 16 36 Q ${16 + bend} 20 16 4`}
        fill="none"
        stroke="currentColor"
        strokeWidth={on ? 2.6 : 2}
        strokeLinecap="round"
        opacity={on ? 1 : 0.5}
      />
      <circle cx="16" cy="36" r="2.8" fill="currentColor" opacity={on ? 1 : 0.5} />
    </svg>
  );
}

export function ReadBreak({
  readAs,
  brokeAs,
  onPick,
}: {
  readAs: number | undefined;
  brokeAs: number | undefined;
  onPick: (readAs: number | undefined, brokeAs: number | undefined) => void;
}) {
  const actual = brokeAs ?? readAs;
  const lo = readAs !== undefined && actual !== undefined ? Math.min(readAs, actual) : null;
  const hi = readAs !== undefined && actual !== undefined ? Math.max(readAs, actual) : null;

  const tap = (n: number) => {
    if (readAs === undefined) return onPick(n, undefined);
    // Tapping the read again clears it, so a mis-tap is one more tap to undo.
    if (n === readAs && brokeAs === undefined) return onPick(undefined, undefined);
    if (n === readAs) return onPick(n, undefined);
    onPick(readAs, n);
  };

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
              <Curve bend={s.bend} on={isRead || isActual} />
              <span className="brk-label">{s.label}</span>
            </button>
          );
        })}
      </div>
      <p className={readAs === undefined ? 'small brk-read' : 'small brk-read on'}>
        {wording(readAs, brokeAs)}
      </p>
    </div>
  );
}
