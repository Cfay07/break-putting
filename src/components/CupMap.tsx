import { CUP_ANGLES, CUP_ENTRIES, type CupEntry } from '../lib/types';

const R = 34;
const at = (deg: number) => [50 + R * Math.cos((deg * Math.PI) / 180), 50 - R * Math.sin((deg * Math.PI) / 180)];

/**
 * Where your makes went in, drawn on the same cup you tapped them into.
 *
 * The input and the readout are the same picture on purpose: nothing to learn twice, and the
 * shape of the pattern is the whole point. Dots grow with the count rather than being labelled,
 * because eight numbers round a circle is a table pretending to be a diagram.
 */
export function CupMap({
  counts,
  unsure = 0,
}: {
  counts: Partial<Record<CupEntry, number>>;
  unsure?: number;
}) {
  const seen = CUP_ENTRIES.map((e) => counts[e] ?? 0);
  const total = seen.reduce((s, n) => s + n, 0);
  const most = Math.max(1, ...seen);
  const front = counts.front ?? 0;

  return (
    <div className="cupmap">
      <svg viewBox="0 0 100 100" className="cupmap-svg" role="img" aria-label="Where your makes entered">
        <circle cx="50" cy="50" r="34" className="cup-rim" />
        <path d="M 50 99 L 50 90" className="cup-approach" />
        {CUP_ENTRIES.map((e) => {
          const [x, y] = at(CUP_ANGLES[e]);
          const n = counts[e] ?? 0;
          // Area with the count, not radius, so four putts does not look like sixteen.
          const r = n ? 3.5 + Math.sqrt(n / most) * 6 : 2;
          return (
            <g key={e}>
              <circle cx={x} cy={y} r={r} className={n ? 'cupmap-dot on' : 'cupmap-dot'} />
              {n > 0 && (
                <text x={x} y={y + 2.6} className="cupmap-n" textAnchor="middle">
                  {n}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="cupmap-side">
        <p className="cupmap-lead">
          <b>{total ? Math.round((front / total) * 100) : 0}%</b> straight through the front
        </p>
        <p className="cupmap-note">
          {total} make{total === 1 ? '' : 's'} logged
          {unsure > 0 ? `, ${unsure} you did not see` : ''}.
          {total > 0 && front / total < 0.4
            ? ' Mostly edges. Those are the ones that stop dropping.'
            : ''}
        </p>
      </div>
    </div>
  );
}

/** Count entry points over a set of holes. */
export function cupCounts(holes: { putts: { made: boolean; cupEntry?: CupEntry }[] }[]) {
  const counts: Partial<Record<CupEntry, number>> = {};
  let unsure = 0;
  let total = 0;
  for (const h of holes) {
    for (const p of h.putts) {
      if (!p.made || !p.cupEntry) continue;
      if (p.cupEntry === 'unsure') {
        unsure += 1;
        continue;
      }
      counts[p.cupEntry] = (counts[p.cupEntry] ?? 0) + 1;
      total += 1;
    }
  }
  return { counts, unsure, total };
}
