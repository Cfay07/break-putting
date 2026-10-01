import { MIN_TAGGED, MIN_TERM, breakCost, makeability, type MakeModel } from '../lib/makeability';
import type { BreakDir } from '../lib/types';

const RUNGS = [3, 6, 10, 20, 30];

const SHAPES: { label: string; dirs: BreakDir[]; term: 'lr' | 'rl' | 'double' | 'uphill' | 'downhill' }[] = [
  { label: 'L→R', dirs: ['L→R'], term: 'lr' },
  { label: 'L←R', dirs: ['R→L'], term: 'rl' },
  { label: 'Double break', dirs: ['L→R', 'R→L'], term: 'double' },
  { label: 'Uphill', dirs: ['uphill'], term: 'uphill' },
  { label: 'Downhill', dirs: ['downhill'], term: 'downhill' },
];

const pct = (v: number | null) => (v === null ? '--' : `${(v * 100).toFixed(0)}%`);

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
        <div className="shoot-cap">of your six-footers go in</div>
        <p className="small" style={{ margin: '6px 0 0' }}>
          Your own make rate, worked out from all {model.n} putts you have logged. A tour player
          makes about 65% from six feet. This number moves every time you add a round.
        </p>
      </div>

      <div className="field-label">What you make, by distance</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Distance</th>
              <th>You hole it</th>
            </tr>
          </thead>
          <tbody>
            {RUNGS.map((d) => (
              <tr key={d}>
                <td>{d} ft</td>
                <td className="num">{pct(makeability(model, d))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        These come from one curve through all your putts at once, not from counting each distance
        on its own. That is why they still read sensibly at distances you have rarely faced.
      </p>

      <div className="field-label">What the break costs you</div>
      {model.ready ? (
        <>
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
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            Learned from the {model.tagged} putts you tagged a break on. A shape needs{' '}
            {MIN_TERM} of its own before it gets a number, and thin ones are pulled toward no
            effect on purpose, so these understate rather than invent. Tag more and they sharpen.
          </p>
        </>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          Still off. It needs {MIN_TAGGED} putts with a break tagged and has {model.tagged}. Until
          then every putt is priced on distance alone. Tag the break on putts you hole as well as
          the ones you miss, or the model only ever sees the misses and reads every shape as hard.
        </p>
      )}
    </div>
  );
}
