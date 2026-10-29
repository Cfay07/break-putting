import {
  MIN_TERM,
  breakCost,
  downhillCost,
  makeability,
  type MakeModel,
  type Term,
} from '../lib/makeability';
import type { BreakDir } from '../lib/types';

/**
 * `term` names the coefficient whose sample size this row stands on. Uphill leans on slopeKnown,
 * because uphill is the reference inside the slope-stated group and has no coefficient of its own;
 * downhill leans on the contrast against it.
 */
/**
 * Direction only. Slope is not in this table, because the comparison it offers is against a
 * straight putt and there is no level-ground tag to be straight against: a putt with no slope on
 * it means nobody said, not that the green was flat. Slope gets its own row underneath, as the
 * one contrast the record supports.
 */
const SHAPES: { label: string; dirs: BreakDir[]; term: Term }[] = [
  { label: 'L→R', dirs: ['L→R'], term: 'lr' },
  { label: 'L←R', dirs: ['R→L'], term: 'rl' },
  { label: 'Double break', dirs: ['L→R', 'R→L'], term: 'double' },
];

const pct = (v: number | null) => (v === null ? '--' : `${(v * 100).toFixed(0)}%`);

/**
 * The break half only. Make rate by distance used to live here too, but the By distance table
 * already shows that from real counts, and two tables of the same thing disagreeing by a point
 * is worse than one. Stats renders this only once there are enough tagged putts to mean
 * something, so there is no "not ready yet" state to show.
 */
export function LearnedPanel({ model }: { model: MakeModel }) {
  const six = makeability(model, 6);
  if (six === null) return null;

  const shapes = SHAPES.map((s) => ({
    ...s,
    cost: breakCost(model, 6, s.dirs),
    n: model.taggedBy[s.term],
  })).filter((s) => s.cost !== null);

  return (
    <div>
      <div className="card">
        <div className="shoot-for num">{pct(six)}</div>
        <div className="shoot-cap">of your straight six-footers go in</div>
        <p className="small" style={{ margin: '6px 0 0' }}>
          The flat, straight putt everything below is measured against. A tour player makes about
          65% of these.
        </p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Shape</th>
              <th>Putts</th>
              <th>From 6 ft</th>
              <th>Against straight</th>
            </tr>
          </thead>
          <tbody>
            {shapes.map((s) => (
              <tr key={s.label}>
                <td>{s.label}</td>
                <td className="num">{s.n}</td>
                {s.n >= MIN_TERM ? (
                  <>
                    <td className="num">{pct(makeability(model, 6, s.dirs))}</td>
                    <td className={s.cost! < 0 ? 'num neg' : 'num pos'}>
                      {s.cost! >= 0 ? '+' : ''}
                      {s.cost!.toFixed(0)} pts
                    </td>
                  </>
                ) : (
                  <td className="muted" colSpan={2}>
                    needs {MIN_TERM - s.n} more
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {model.taggedBy.downhill >= MIN_TERM && downhillCost(model, 6) !== null && (
        <div className="stat-row" style={{ marginTop: 8 }}>
          <span className="k">Downhill, against uphill</span>
          <span className={downhillCost(model, 6)! < 0 ? 'v num neg' : 'v num pos'}>
            {downhillCost(model, 6)! >= 0 ? '+' : ''}
            {downhillCost(model, 6)!.toFixed(0)} pts
          </span>
        </div>
      )}
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        Learned from the {model.tagged} putts you tagged a break on. A shape needs {MIN_TERM} of
        its own before it gets a number, and thin ones are pulled toward no effect on purpose, so
        these understate rather than invent.
      </p>
    </div>
  );
}
