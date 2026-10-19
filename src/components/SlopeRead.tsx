const STOPS = [0, 1, 2, 3, 4, 5];

/** Walks you through it a step at a time, because six bare numbers explain nothing. */
function wording(readAs: number | undefined, playedAs: number | undefined): string {
  // Says out loud that it is skippable. A guessed read looks identical to a real one in the
  // data, so someone who does not put a number on the slope should leave it alone.
  if (readAs === undefined) return 'Tap what you read it as, or skip it if you do not read by number';
  if (playedAs === undefined || playedAs === readAs) {
    return `Read a ${readAs}. Tap again if it played different.`;
  }
  const off = Math.abs(playedAs - readAs);
  const way = playedAs > readAs ? 'under-read' : 'over-read';
  return `Read a ${readAs}, played a ${playedAs}. ${off === 1 ? 'A notch' : `${off} notches`} ${way}.`;
}

/**
 * The read and what it actually played, on one strip. Tapping once says you had it; tapping a
 * second stop draws the gap, so the direction of the arrow is the diagnosis and its length is
 * how far off the read was. Two numbers would make you do the subtraction yourself.
 */
export function SlopeRead({
  readAs,
  playedAs,
  onPick,
}: {
  readAs: number | undefined;
  playedAs: number | undefined;
  onPick: (readAs: number | undefined, playedAs: number | undefined) => void;
}) {
  const actual = playedAs ?? readAs;

  const tap = (n: number) => {
    if (readAs === undefined) return onPick(n, undefined);
    if (n === readAs && playedAs === undefined) return onPick(undefined, undefined);
    if (n === readAs) return onPick(n, undefined);
    onPick(readAs, n);
  };

  const lo = readAs !== undefined && actual !== undefined ? Math.min(readAs, actual) : null;
  const hi = readAs !== undefined && actual !== undefined ? Math.max(readAs, actual) : null;

  return (
    <div>
      <div className="slope-row">
        {STOPS.map((n) => {
          const isRead = n === readAs;
          const isActual = playedAs !== undefined && n === playedAs;
          const between = lo !== null && hi !== null && n > lo && n < hi;
          const cls = [
            'slope-stop',
            isRead ? 'read' : '',
            isActual ? 'actual' : '',
            between ? 'span' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button key={n} type="button" className={cls} aria-pressed={isRead || isActual} onClick={() => tap(n)}>
              {n}
            </button>
          );
        })}
      </div>
      <div className="slope-ends">
        <span>flat</span>
        <span>severe</span>
      </div>
      <p className={readAs === undefined ? 'small slope-read' : 'small slope-read on'}>
        {wording(readAs, playedAs)}
      </p>
    </div>
  );
}
