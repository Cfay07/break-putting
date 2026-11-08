import { useMemo, useState } from 'react';
import { fmtDate, signed } from '../lib/format';
import { courseLabel, overall, pct, roundScale, roundStats, type Stats as S } from '../lib/stats';
import type { Round } from '../lib/types';

const AVG = '__avg__';

interface Side {
  label: string;
  putts: number | null;
  three: number | null;
  scoring: number | null;
  sg: number | null;
  gir: number | null;
}

function sideFromStats(label: string, s: S, scale = 1): Side {
  return {
    label,
    putts: s.totalPutts * scale,
    three: s.threePlus * scale,
    scoring: pct(s.scoring),
    sg: s.sg * scale,
    gir: s.scoredHoles ? s.gir * scale : null,
  };
}

const ROWS: {
  k: string;
  get: (s: Side) => number | null;
  lowerBetter: boolean;
  fmt: (v: number) => string;
  dfmt: (v: number) => string;
}[] = [
  { k: 'Putts', get: (s) => s.putts, lowerBetter: true, fmt: (v) => v.toFixed(1), dfmt: (v) => v.toFixed(1) },
  { k: '3-putts', get: (s) => s.three, lowerBetter: true, fmt: (v) => v.toFixed(1), dfmt: (v) => v.toFixed(1) },
  {
    k: 'Make % from 3 to 10 ft',
    get: (s) => s.scoring,
    lowerBetter: false,
    fmt: (v) => `${v.toFixed(0)}%`,
    dfmt: (v) => `${v.toFixed(0)}%`,
  },
  { k: 'Strokes gained', get: (s) => s.sg, lowerBetter: false, fmt: (v) => signed(v), dfmt: (v) => v.toFixed(1) },
  { k: 'Greens hit', get: (s) => s.gir, lowerBetter: false, fmt: (v) => v.toFixed(1), dfmt: (v) => v.toFixed(1) },
];

/** Rounds arrive newest first, the way the list shows them. */
export function CompareRounds({ rounds, baseline }: { rounds: Round[]; baseline: [number, number][] }) {
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState(AVG);
  const o = useMemo(() => overall(rounds, baseline), [rounds, baseline]);

  if (rounds.length < 2) return null;

  const left = rounds.find((r) => r.id === leftId) ?? rounds[0];
  const rightRound = rightId === AVG ? null : rounds.find((r) => r.id === rightId);
  const leftSide = sideFromStats(fmtDate(left.date), roundStats(left, baseline), roundScale(left));
  const rightSide: Side = rightRound
    ? sideFromStats(fmtDate(rightRound.date), roundStats(rightRound, baseline), roundScale(rightRound))
    : {
        label: `Average of ${o.rounds}`,
        putts: o.puttsPerRound,
        three: o.threePuttsPerRound,
        scoring: o.scoringPct,
        sg: o.sgPerRound,
        gir: o.girPerRound,
      };
  const anyShort = rounds.some((r) => roundScale(r) > 1);
  const options = rounds.map((r) => (
    <option key={r.id} value={r.id}>
      {fmtDate(r.date)} · {courseLabel(r)}
    </option>
  ));

  return (
    <>
      <h2>Compare two rounds</h2>
      <div style={{ display: 'flex', gap: 10 }}>
        <select value={left.id} onChange={(e) => setLeftId(e.target.value)} aria-label="left round">
          {options}
        </select>
        <select value={rightId} onChange={(e) => setRightId(e.target.value)} aria-label="right round">
          <option value={AVG}>My average</option>
          {options}
        </select>
      </div>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>{leftSide.label}</th>
              <th>{rightSide.label}</th>
              <th>Diff</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const a = row.get(leftSide);
              const b = row.get(rightSide);
              if (a === null || b === null) return null;
              const delta = a - b;
              const better = row.lowerBetter ? delta < 0 : delta > 0;
              const flat = Math.abs(delta) < 0.005;
              return (
                <tr key={row.k}>
                  <td>{row.k}</td>
                  <td>{row.fmt(a)}</td>
                  <td>{row.fmt(b)}</td>
                  <td className={flat ? '' : better ? 'pos' : 'neg'}>
                    {flat ? '=' : `${delta > 0 ? '▲' : '▼'} ${row.dfmt(Math.abs(delta))}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {anyShort && (
        <p className="small muted" style={{ marginTop: 6 }}>
          A short round is scaled up on both sides here, so the comparison is like for like.
        </p>
      )}
    </>
  );
}
