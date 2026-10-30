import { signed } from '../lib/format';
import { isLagZone, type Zone } from '../lib/types';
import { confidenceOf } from '../lib/sample';
import type { ZoneRead } from '../lib/practice';

/**
 * Strokes a round by distance, drawn from a zero line so a zone that gains and one that loses
 * read in opposite directions. Each row is a button: tapping it puts that zone on the card above.
 */
export function ZoneBars({
  zones,
  on,
  onPick,
}: {
  zones: ZoneRead[];
  on: Zone | null;
  onPick: (z: Zone) => void;
}) {
  const readable = zones.filter((z) => confidenceOf(z.sample) !== 'waiting');
  const lose = Math.max(0, ...readable.map((z) => -z.sgPerRound));
  const gain = Math.max(0, ...readable.map((z) => z.sgPerRound));
  const span = lose + gain || 1;
  const zero = (lose / span) * 100;

  return (
    <div className="zone-bars">
      {zones.map((z) => {
        const waiting = confidenceOf(z.sample) === 'waiting';
        const w = waiting ? 0 : (Math.abs(z.sgPerRound) / span) * 100;
        const left = z.sgPerRound < 0 ? zero - w : zero;
        return (
          <button
            key={z.zone}
            className={`zone-row${on === z.zone ? ' on' : ''}${waiting ? ' waiting' : ''}`}
            onClick={() => onPick(z.zone)}
            aria-pressed={on === z.zone}
          >
            <span className="zone-k">{z.label}</span>
            <span className="zone-track">
              <i className="zone-zero" style={{ left: `${zero}%` }} />
              <i
                className={z.sgPerRound < 0 ? 'zone-fill lose' : 'zone-fill gain'}
                style={{ left: `${left}%`, width: `${w}%` }}
              />
            </span>
            <span className="zone-v num">{waiting ? '' : signed(z.sgPerRound)}</span>
            <span className="zone-n">
              {z.attempts} putts
              {!waiting && z.attempts
                ? isLagZone(z.zone)
                  ? z.leave !== null
                    ? ` · leaves ${z.leave.toFixed(1)} ft · ${z.threePutts} three-putts`
                    : ''
                  : ` · ${Math.round((z.makes / z.attempts) * 100)}% holed, scratch ${Math.round((z.scratchMakes / z.attempts) * 100)}%`
                : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
