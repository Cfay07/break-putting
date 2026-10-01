import { pct, type SpeedSplit } from '../lib/stats';
import { SpeedBars } from './SpeedBars';

/** A band needs this many tagged misses before its tendency is worth printing. */
const MIN_TAGGED = 8;
/** And this many lag putts before an average leave means anything. */
const MIN_LAG = 5;

const signed = (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));

/**
 * One block per band rather than one wide table. Eight columns do not fit a phone, and the
 * question here is not "which number is biggest" but "does this band behave differently",
 * which reads better stacked.
 */
export function SpeedPanel({ splits }: { splits: SpeedSplit[] }) {
  return (
    <div>
      {splits.map((g) => {
        const scoringPct = pct(g.scoring);
        const high = g.sided >= MIN_TAGGED ? Math.round((g.high / g.sided) * 100) : null;
        const short = g.paced >= MIN_TAGGED ? Math.round((g.short / g.paced) * 100) : null;

        return (
          <div className="speed-band" key={g.speed}>
            <div className="speed-band-head">
              <SpeedBars speed={g.speed} label />
              <span className="small muted">
                {g.rounds} {g.rounds === 1 ? 'round' : 'rounds'}
              </span>
            </div>

            <div className="band-grid num">
              <span className="band-cell">
                <span className="tiny">SG</span>
                <span className={g.sg >= 0 ? 'val pos' : 'val neg'}>{signed(g.sg)}</span>
              </span>
              <span className="band-cell">
                <span className="tiny">Putts</span>
                <span className="val">{g.putts.toFixed(1)}</span>
              </span>
              <span className="band-cell">
                <span className="tiny">3-putts</span>
                <span className={g.threePlus >= 2 ? 'val neg' : 'val'}>{g.threePlus.toFixed(1)}</span>
              </span>
              <span className="band-cell">
                <span className="tiny">3-10 ft</span>
                <span className="val">{scoringPct === null ? '--' : `${scoringPct.toFixed(0)}%`}</span>
              </span>
            </div>

            <p className="small band-read">
              {high === null && short === null ? (
                <span className="muted">
                  Not enough tagged misses here yet to say where they go.
                </span>
              ) : (
                <>
                  {high !== null && (
                    <>
                      {/* Always state the majority side, so the number and the word agree. */}
                      <strong>{high >= 50 ? high : 100 - high}%</strong> of misses finish{' '}
                      {high >= 50 ? 'above' : 'below'} the hole
                    </>
                  )}
                  {high !== null && short !== null && ' · '}
                  {short !== null && (
                    <>
                      <strong>{short >= 50 ? short : 100 - short}%</strong> finish{' '}
                      {short >= 50 ? 'short' : 'long'}
                    </>
                  )}
                  {g.lagAttempts >= MIN_LAG && g.avgLeave !== null && (
                    <> · lag leaves {g.avgLeave.toFixed(1)} ft</>
                  )}
                </>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}
