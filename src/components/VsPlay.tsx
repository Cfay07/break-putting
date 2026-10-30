import { PLAY_NEED, PRACTICE_NEED, windowOf, type DistanceRead } from '../lib/practice';
import { MODE_WORDS } from '../lib/practiceView';

const share = (t: { made: number; attempts: number }) => (t.attempts ? Math.round((t.made / t.attempts) * 100) : 0);

/**
 * Practice and play at the same distance, as two bars that never blend. Either side short of
 * its sample says so in place of a number.
 */
export function VsPlay({ reads }: { reads: DistanceRead[] }) {
  return (
    <div className="vs">
      <div className="vs-legend">
        <span>
          <i className="vs-key here" />
          Practice
        </span>
        <span>
          <i className="vs-key play" />
          Rounds
        </span>
      </div>
      {reads.map((r) => {
        const pOk = r.practice.attempts >= PRACTICE_NEED;
        const cOk = r.play.attempts >= PLAY_NEED;
        return (
          <div key={`${r.mode}${r.d}${r.zoneFt ?? ''}`} className="vs-row">
            <span className="vs-k">
              <strong>{r.d} ft</strong>
              {r.mode !== 'make' && (
                <span className="small muted">{r.zoneFt ? `inside ${r.zoneFt} ft` : MODE_WORDS[r.mode].noun}</span>
              )}
            </span>
            <span className="vs-bars" aria-hidden="true">
              <i className="here" style={{ width: pOk ? `${share(r.practice)}%` : 0 }} />
              <i className="play" style={{ width: cOk ? `${share(r.play)}%` : 0 }} />
            </span>
            <span className="vs-v num">
              <span>
                {pOk ? (
                  <>
                    <b>{share(r.practice)}%</b> of {r.practice.attempts}
                  </>
                ) : (
                  `${r.practice.attempts} ${r.practice.attempts === 1 ? 'ball' : 'balls'}, not yet`
                )}
              </span>
              <span>
                {cOk ? (
                  <>
                    <b>{share(r.play)}%</b> of {r.play.attempts}
                  </>
                ) : (
                  `${r.play.attempts} ${r.play.attempts === 1 ? 'putt' : 'putts'}, not yet`
                )}
              </span>
            </span>
          </div>
        );
      })}
      <p className="small muted vs-note">
        Rounds means your course putts within a foot of each distance
        {reads.some((r) => windowOf(r.d) > 1) ? ', or a tenth of it from 15 ft out,' : ''} with the putter
        you use now.
      </p>
    </div>
  );
}
