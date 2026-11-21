import type { ReactNode } from 'react';
import type { Tally } from '../lib/topicFindings';

export interface TallyRow {
  label: ReactNode;
  cells: (Tally | string)[];
  /** Colour one cell by index: green when it is the better number, red when worse. */
  tone?: (string | undefined)[];
}

const cell = (c: Tally | string) =>
  typeof c === 'string' ? (
    c
  ) : c.tried ? (
    <>
      {Math.round((c.made / c.tried) * 100)}%
      <small className="compare-n">
        {c.made}/{c.tried}
      </small>
    </>
  ) : (
    '--'
  );

/** Rows of make rates side by side, each with the count it came from, so no share hides its size. */
export function TallyTable({ heads, rows }: { heads: string[]; rows: TallyRow[] }) {
  return (
    <div className="table-wrap">
      <table className="tally-table">
        <thead>
          <tr>
            <th />
            {heads.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.label}</td>
              {r.cells.map((c, j) => (
                <td key={j} className={['num', r.tone?.[j]].filter(Boolean).join(' ')}>
                  {cell(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Green for the better of two make rates and red for the worse, only when the gap is clear. */
export function tonePair(a: Tally, b: Tally, clear: boolean): (string | undefined)[] {
  if (!clear || !a.tried || !b.tried) return [];
  const better = a.made / a.tried > b.made / b.tried;
  return better ? ['pos', 'neg'] : ['neg', 'pos'];
}
