import { formBand, type Form, type Tally } from '../lib/form';

const share = (t: Tally) => (t.of ? Math.round((t.right / t.of) * 100) : null);

const ROWS: { key: keyof Form['parts']; label: string; note: string }[] = [
  { key: 'read', label: 'Read it right', note: 'the turn, and how much of it' },
  { key: 'strike', label: 'Caught the middle', note: 'not the toe or the heel' },
  { key: 'line', label: 'Started it on line', note: 'no push, no pull' },
  { key: 'pace', label: 'Right pace', note: 'not short, not running out' },
  { key: 'lip', label: 'Lipped out', note: 'everything right, no reward' },
];

/**
 * What built the number. A score nobody can take apart is a score nobody trusts, and the parts
 * are the useful half anyway: the total says how the round went, the rows say what to go and
 * practise.
 */
export function FormPanel({ form }: { form: Form }) {
  const band = formBand(form.score);
  return (
    <>
      <div className="card">
        <div className="form-hero">
          <span className="form-big" style={{ color: band.ink }}>
            {form.score.toFixed(1)}
          </span>
          <span className="small muted">
            out of 10
            {form.process === null && ' · from the outcome alone'}
          </span>
        </div>

        <div className="stat-row">
          <span className="k">
            Execution
            <span className="small muted"> · reads, strikes, line, pace</span>
          </span>
          <span className="v num" style={{ color: band.ink }}>
            {form.process === null ? '--' : form.process.toFixed(1)}
          </span>
        </div>
        <div className="stat-row">
          <span className="k">
            Result
            <span className="small muted"> · strokes gained, on this scale</span>
          </span>
          <span className="v num">{form.outcome.toFixed(1)}</span>
        </div>
      </div>

      {form.process === null ? (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          Only {form.tagged} putt{form.tagged === 1 ? '' : 's'} carried a read or a strike this
          round, so this is strokes gained on a nought to ten scale and nothing more. Tag the read
          and the strike as you play and the other half appears.
        </p>
      ) : (
        <>
          <div className="field-label">What built it</div>
          <div className="card">
            {ROWS.map(({ key, label, note }) => {
              const t = form.parts[key];
              const pct = share(t);
              if (!t.of) return null;
              return (
                <div className="stat-row" key={key}>
                  <span className="k">
                    {label}
                    <span className="small muted"> · {note}</span>
                  </span>
                  <span className={pct !== null && pct < 50 ? 'v num neg' : 'v num'}>
                    {key === 'lip' ? t.right : `${pct}%`}
                    <span className="small muted"> · {t.right}/{t.of}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            Form is execution and result averaged. Execution is the rows above: the share of
            what you controlled that you got right. Lip-outs only ever add, because a putt that
            caught the hole and stayed out was a good one that went unpaid, and that is the thing
            strokes gained cannot see.
          </p>
        </>
      )}
    </>
  );
}
