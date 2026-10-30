import { sample, signedFor } from '../lib/sample';
import type { ConditionSplit, ConditionSplits } from '../lib/conditions';

function Table({ title, rows }: { title: string; rows: ConditionSplit[] }) {
  if (!rows.length) return null;
  const best = Math.max(...rows.map((r) => r.sgPerRound));
  return (
    <>
      <div className="field-label">{title}</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Greens</th>
              <th>Rounds</th>
              <th>Putts</th>
              <th>3-10 ft</th>
              <th>SG</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="num">{r.rounds}</td>
                <td className="num">{r.puttsPerRound.toFixed(1)}</td>
                <td className="num">{r.scoringPct === null ? '--' : `${r.scoringPct.toFixed(0)}%`}</td>
                <td className={r.sgPerRound === best ? 'num pos' : 'num neg'}>
                  {signedFor(r.sgPerRound, sample(r.rounds, 5, 'rounds'))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ConditionPanel({ splits }: { splits: ConditionSplits }) {
  const any = splits.aeration.length || splits.surface.length;
  const { tagged } = splits;

  if (!any) {
    const some = tagged.aeration + tagged.surface;
    return (
      <p className="small muted">
        {some
          ? `Tagged on ${some} round${some === 1 ? '' : 's'} so far. Two on each side before a split is worth drawing.`
          : 'Nothing tagged yet. Conditions live on the green speed sheet of a round.'}
      </p>
    );
  }

  return (
    <>
      <Table title="Aeration" rows={splits.aeration} />
      <Table title="How true it rolled" rows={splits.surface} />
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        Per eighteen holes. None of this changes strokes gained or expected putts, and it should
        not be read as proof yet: a handful of rounds either side moves a long way on one bad day.
        It is here so the cost can eventually be read off real rounds instead of guessed at.
      </p>
    </>
  );
}
