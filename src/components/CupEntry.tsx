import { CUP_ANGLES, CUP_ENTRIES, CUP_LABELS, type CupEntry as Entry } from '../lib/types';

const R = 34; // dots straddle the rim itself: the entry point is where the ball crossed it
const at = (deg: number) => [50 + R * Math.cos((deg * Math.PI) / 180), 50 - R * Math.sin((deg * Math.PI) / 180)];

/**
 * Where a holed putt crossed the rim. The make-side twin of the miss grid: a miss has always
 * been asked where it finished and a make was asked nothing, so holed putts ended the record
 * rather than adding to it.
 *
 * Drawn from the player's view with the ball below the hole, because six o'clock has to be the
 * side the ball came from or left and right mean a different thing on every putt. The dashed
 * stub is the putt coming in, and it is the only thing fixing that orientation.
 *
 * No centre target. A ball crosses the rim somewhere, so the centre-cut putt is the front door,
 * not a ninth option floating in the middle of the hole.
 */
export function CupEntry({
  value,
  onPick,
}: {
  value: Entry | undefined;
  onPick: (entry: Entry | undefined) => void;
}) {
  const pick = (e: Entry) => onPick(value === e ? undefined : e);

  return (
    <div className="cup-wrap">
      <svg viewBox="0 0 100 100" className="cup-svg" role="group" aria-label="Where it went in">
        <circle cx="50" cy="50" r="34" className="cup-rim" />
        <path d="M 50 99 L 50 90" className="cup-approach" />
        {CUP_ENTRIES.map((e) => {
          const [x, y] = at(CUP_ANGLES[e]);
          return (
            <g key={e}>
              <circle cx={x} cy={y} r={5} className={value === e ? 'cup-dot on' : 'cup-dot'} />
              <circle
                cx={x}
                cy={y}
                r={11}
                className="cup-hit"
                role="button"
                tabIndex={0}
                aria-label={CUP_LABELS[e]}
                aria-pressed={value === e}
                onClick={() => pick(e)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    pick(e);
                  }
                }}
              />
            </g>
          );
        })}
      </svg>

      <div className="cup-side">
        <p className="cup-read">{value ? CUP_LABELS[value] : 'Tap where it went in'}</p>
        <button
          type="button"
          className={value === 'unsure' ? 'chip chip-sel' : 'chip'}
          aria-pressed={value === 'unsure'}
          onClick={() => pick('unsure')}
        >
          Didn't see it
        </button>
      </div>
    </div>
  );
}
