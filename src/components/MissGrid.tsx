import type { MissSide, Speed } from '../lib/types';

const SIDES: MissSide[] = ['high', 'online', 'low'];
const SPEEDS: Speed[] = ['short', 'good', 'long'];

const SIDE_LABEL: Record<MissSide, string> = { high: 'High', online: 'On line', low: 'Low' };
const SPEED_LABEL: Record<Speed, string> = { short: 'Short', good: 'Good', long: 'Long' };

/** Plain English for the cell you picked, so the grid never has to be decoded. */
function readout(side: MissSide | undefined, speed: Speed | undefined): string {
  if (!side || !speed) return 'Tap where it finished';
  if (side === 'online') {
    return speed === 'good' ? 'Dead on line, right speed. A lip-out.' : `On line but ${speed}`;
  }
  if (speed === 'good') return `${SIDE_LABEL[side]} side, right speed`;
  return `${SIDE_LABEL[side]} and ${speed}`;
}

/**
 * One tap instead of two. Side and speed were separate pickers, which cost two taps on every
 * missed putt and hid the thing that actually diagnoses a miss: the combination. High and short
 * is a bad read, high and long is too much pace through the break, and neither picker said so
 * on its own.
 *
 * Laid out the way the putt finished. High above the hole, low below, short on the left and
 * long on the right.
 */
export function MissGrid({
  side,
  speed,
  onPick,
}: {
  side: MissSide | undefined;
  speed: Speed | undefined;
  onPick: (side: MissSide | undefined, speed: Speed | undefined) => void;
}) {
  return (
    <div>
      <div className="miss-grid">
        <span />
        {SPEEDS.map((sp) => (
          <span key={sp} className="mg-head">
            {SPEED_LABEL[sp]}
          </span>
        ))}

        {SIDES.map((sd) => (
          <Row key={sd} side={sd} speed={speed} selected={side} onPick={onPick} />
        ))}
      </div>
      <p className={side && speed ? 'small mg-read on' : 'small mg-read'}>{readout(side, speed)}</p>
    </div>
  );
}

function Row({
  side,
  speed,
  selected,
  onPick,
}: {
  side: MissSide;
  speed: Speed | undefined;
  selected: MissSide | undefined;
  onPick: (side: MissSide | undefined, speed: Speed | undefined) => void;
}) {
  return (
    <>
      <span className="mg-side">{SIDE_LABEL[side]}</span>
      {SPEEDS.map((sp) => {
        const on = selected === side && speed === sp;
        return (
          <button
            key={sp}
            type="button"
            className={on ? 'mg-cell on' : 'mg-cell'}
            aria-pressed={on}
            aria-label={`${SIDE_LABEL[side]} and ${SPEED_LABEL[sp]}`}
            onClick={() => (on ? onPick(undefined, undefined) : onPick(side, sp))}
          />
        );
      })}
    </>
  );
}
