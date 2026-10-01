import { GREEN_SPEEDS, GREEN_SPEED_LABELS, GREEN_SPEED_STIMP, type GreenSpeed } from '../lib/types';

/** Four bands with their stimp underneath, so the pick means the same thing every round. */
export function GreenSpeedPick({
  value,
  onPick,
}: {
  value: GreenSpeed | undefined;
  onPick: (v: GreenSpeed | undefined) => void;
}) {
  return (
    <div className="gs-pick">
      {GREEN_SPEEDS.map((g) => (
        <button
          key={g}
          type="button"
          aria-pressed={value === g}
          onClick={() => onPick(value === g ? undefined : g)}
        >
          <span className="gs-name">{GREEN_SPEED_LABELS[g]}</span>
          <span className="gs-stimp">{GREEN_SPEED_STIMP[g]}</span>
        </button>
      ))}
    </div>
  );
}
