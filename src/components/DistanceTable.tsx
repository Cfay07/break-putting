import { signed } from '../lib/format';
import { BUCKETS, pct, type Stats } from '../lib/stats';

export function DistanceTable({
  stats,
  rounds,
  sgPerRound,
}: {
  stats: Stats;
  rounds?: number;
  /** Per-round strokes gained with nine-hole rounds doubled, matching the Averages card. */
  sgPerRound?: Record<string, number | null>;
}) {
  const perRound = rounds && rounds > 1 && sgPerRound ? sgPerRound : null;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Distance</th>
            <th>Made</th>
            <th>%</th>
            <th>SG</th>
            {perRound && <th>SG/rd</th>}
          </tr>
        </thead>
        <tbody>
          {BUCKETS.map((b) => {
            const t = stats.buckets[b.key];
            const p = pct(t);
            return (
              <tr key={b.key}>
                <td>{b.label}</td>
                <td>{t.attempts ? `${t.makes}/${t.attempts}` : '--'}</td>
                <td>{p === null ? '--' : `${p.toFixed(0)}%`}</td>
                <td className={t.sgPutts === 0 ? '' : t.sg >= 0 ? 'pos' : 'neg'}>
                  {t.sgPutts === 0 ? '--' : signed(t.sg, 2)}
                </td>
                {perRound && (
                  <td className={(perRound[b.key] ?? 0) >= 0 ? 'pos' : 'neg'}>
                    {perRound[b.key] === null || perRound[b.key] === undefined
                      ? '--'
                      : signed(perRound[b.key]!, 2)}
                  </td>
                )}
              </tr>
            );
          })}
          <tr className="dist-total">
            <td>Total</td>
            <td>
              {stats.totalPutts
                ? `${BUCKETS.reduce((n, b) => n + stats.buckets[b.key].makes, 0)}/${stats.totalPutts}`
                : '--'}
            </td>
            <td />
            <td className={stats.sg >= 0 ? 'pos' : 'neg'}>{signed(stats.sg, 2)}</td>
            {perRound && (
              <td>
                {signed(
                  BUCKETS.reduce((n, b) => n + (perRound[b.key] ?? 0), 0),
                  2,
                )}
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
