import type { HoleRow } from '../lib/dial';

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '--');

/** "+0.3", "−0.2", "E". */
const toPar = (v: number) => (Math.abs(v) < 0.05 ? 'E' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`);
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`;

function Cell({ n, of }: { n: number; of: number }) {
  return <td className={n ? 'num' : 'num zero'}>{pct(n, of)}</td>;
}

/** Hole by hole: how you score on each hole against its par, what the putter did there, and the total. */
export function HoleCard({ rows, mixed }: { rows: HoleRow[]; mixed: boolean }) {
  const eagles = rows.some((r) => r.eagle > 0);
  const sum = (f: (r: HoleRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const played = sum((r) => r.played);
  const sgRows = rows.filter((r) => r.sg !== null);
  const longest = Math.max(...rows.map((r) => r.longestMake ?? 0));
  const tone = (v: number) => (v < -0.05 ? 'num pos' : v > 0.05 ? 'num neg' : 'num');
  return (
    <div className="table-wrap">
      <table className="tally-table hole-card">
        <thead>
          <tr>
            <th>Hole</th>
            <th>To par</th>
            {eagles && <th>Eagle</th>}
            <th>Bird</th>
            <th>Par</th>
            <th>Bog</th>
            <th>Dbl+</th>
            <th>SG</th>
            <th>Long</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.hole}>
              <td>
                {r.hole}
                <small className="hc-par">{r.samePar ? `Par ${r.par}` : `${r.played} played`}</small>
              </td>
              <td className={tone(r.toPar)}>{toPar(r.toPar)}</td>
              {eagles && <td className={r.eagle ? 'num pos' : 'num zero'}>{r.eagle || ''}</td>}
              <Cell n={r.birdie} of={r.played} />
              <Cell n={r.pars} of={r.played} />
              <Cell n={r.bogey} of={r.played} />
              <Cell n={r.double} of={r.played} />
              <td className={r.sg === null ? 'num' : r.sg >= 0 ? 'num pos' : 'num neg'}>
                {r.sg === null ? '--' : signed(r.sg)}
              </td>
              <td className="num">{r.longestMake === null ? '--' : r.longestMake}</td>
            </tr>
          ))}
          <tr className="hc-total">
            <td>
              Total
              <small className="hc-par">{mixed ? 'all courses' : 'a round'}</small>
            </td>
            <td className={tone(sum((r) => r.toPar))}>{toPar(sum((r) => r.toPar))}</td>
            {eagles && <td className="num">{sum((r) => r.eagle)}</td>}
            <Cell n={sum((r) => r.birdie)} of={played} />
            <Cell n={sum((r) => r.pars)} of={played} />
            <Cell n={sum((r) => r.bogey)} of={played} />
            <Cell n={sum((r) => r.double)} of={played} />
            <td className={sum((r) => r.sg ?? 0) >= 0 ? 'num pos' : 'num neg'}>
              {sgRows.length ? signed(sum((r) => r.sg ?? 0)) : '--'}
            </td>
            <td className="num">{longest || '--'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
