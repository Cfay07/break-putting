import { GREEN_SPEEDS, GREEN_SPEED_LABELS, GREEN_SPEED_STIMP, type GreenSpeed } from '../lib/types';

/**
 * A four-step meter. Reads as speed before the label does, stays legible at card size, and
 * carries no colour of its own so it never competes with the putter tag.
 */
export function SpeedBars({ speed, label }: { speed: GreenSpeed; label?: boolean }) {
  const level = GREEN_SPEEDS.indexOf(speed) + 1;
  return (
    <span className="speed" title={`Greens ${GREEN_SPEED_LABELS[speed]}, stimp ${GREEN_SPEED_STIMP[speed]}`}>
      <span className="speed-bars" aria-hidden="true">
        {GREEN_SPEEDS.map((_, i) => (
          <i key={i} className={i < level ? 'on' : undefined} />
        ))}
      </span>
      {label && <span className="speed-word">{GREEN_SPEED_LABELS[speed]}</span>}
      <span className="sr-only">
        Greens {GREEN_SPEED_LABELS[speed]}, stimp {GREEN_SPEED_STIMP[speed]}
      </span>
    </span>
  );
}
