import { BackLink } from '../components/BackLink';
import { VsPlay } from '../components/VsPlay';
import { biggestGap, practiceVsPlay } from '../lib/practice';
import { usePractice } from '../lib/usePractice';
import { SURFACE_LABELS, type Surface } from '../lib/types';

const SURFACES: Surface[] = ['indoor', 'green'];

/**
 * Every distance you have practiced, next to the same distance on the course. Indoor and green
 * stay apart: a mat reads higher, and averaging it with grass would hide that.
 */
export function Distances() {
  const { state, scoped } = usePractice();
  const parts = SURFACES.map((s) => ({
    s,
    reads: practiceVsPlay(
      state.practice.filter((x) => x.surface === s),
      scoped.rounds,
    ).filter((r) => r.practice.attempts > 0),
  })).filter((p) => p.reads.length);

  return (
    <div>
      <div className="page-top">
        <BackLink />
      </div>
      <h1 className="page-title">Practice against play</h1>
      <p className="small muted" style={{ margin: '2px 0 0' }}>
        Every drill's balls pooled by distance. The number to watch is the gap closing.
      </p>
      {parts.map(({ s, reads }) => {
        const gap = biggestGap(reads);
        return (
          <div key={s}>
            <h2>{SURFACE_LABELS[s]}</h2>
            <VsPlay reads={reads} />
            {gap && gap.gap! >= 10 && (
              <p className="small" style={{ marginTop: 8 }}>
                Biggest gap: {gap.d} ft, {Math.round(gap.gap!)} points.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
