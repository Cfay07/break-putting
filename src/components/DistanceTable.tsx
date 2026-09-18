import { signed } from '../lib/format';
import { BUCKETS, pct, type Stats } from '../lib/stats';

export function DistanceTable({ stats, rounds }: { stats: Stats; rounds?: number }) {
  const perRound = rounds && rounds > 1 ? rounds : null;
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
                  <td className={t.sgPutts === 0 ? '' : t.sg >= 0 ? 'pos' : 'neg'}>
                    {t.sgPutts === 0 ? '--' : signed(t.sg / perRound, 2)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
