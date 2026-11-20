import { signed } from '../lib/format';
import type { GroupLine } from '../lib/situations';

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '--');

/**
 * Groups side by side, one column each, the same rows every time: how much there is to go on,
 * then strokes gained, putts, three-putts, short putts, and what the greens hit and missed turned into.
 */
export function CompareTable({ lines, unit = 'rounds' }: { lines: GroupLine[]; unit?: 'rounds' | 'holes' }) {
  const rows: { k: string; v: (l: GroupLine) => string; tone?: (l: GroupLine) => string | undefined }[] = [
    { k: unit === 'rounds' ? 'Rounds' : 'Holes', v: (l) => String(unit === 'rounds' ? l.rounds : l.holes) },
    {
      k: 'Gained per 18',
      v: (l) => (l.sg === null ? '--' : signed(l.sg, 1)),
      tone: (l) => (l.sg === null ? undefined : l.sg >= 0 ? 'pos' : 'neg'),
    },
    { k: 'Putts per 18', v: (l) => (l.putts === null ? '--' : l.putts.toFixed(1)) },
    { k: '3-putts per 18', v: (l) => (l.threes === null ? '--' : l.threes.toFixed(1)) },
    { k: '3 to 10 ft', v: (l) => pct(l.short.made, l.short.tried) },
    { k: 'Birdies from greens', v: (l) => pct(l.conv.birdies, l.conv.greens) },
    { k: 'Pars saved', v: (l) => pct(l.conv.saves, l.conv.missed) },
  ];
  return (
    <div className="table-wrap">
      <table className="compare">
        <thead>
          <tr>
            <th />
            {lines.map((l) => (
              <th key={l.label}>{l.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td>{r.k}</td>
              {lines.map((l) => (
                <td key={l.label} className={['num', r.tone?.(l)].filter(Boolean).join(' ')}>
                  {r.v(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Many groups, few numbers: one row per group, so five stretches of a round fit a phone. Per hole,
 * not per 18: a single hole scaled to a round read as if that hole cost seven strokes.
 */
export function CompareRows({ lines }: { lines: GroupLine[] }) {
  return (
    <div className="table-wrap">
      <table className="compare">
        <thead>
          <tr>
            <th />
            <th>Gained</th>
            <th>3-putts</th>
            <th>3–10 ft</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.label}>
              <td>
                {l.label}
                <small className="compare-n">
                  {l.rounds} {l.rounds === 1 ? 'round' : 'rounds'}
                </small>
              </td>
              <td className={l.sg === null ? 'num' : l.sg >= 0 ? 'num pos' : 'num neg'}>
                {l.sg === null ? '--' : signed(l.sg / 18, 2)}
              </td>
              <td className="num">{l.threes === null ? '--' : `${Math.round((l.threes / 18) * 100)}%`}</td>
              <td className="num">{pct(l.short.made, l.short.tried)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
