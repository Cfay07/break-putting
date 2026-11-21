import { formBand, formStory, type Form, type Tally } from '../lib/form';
import { LAG_FROM } from '../lib/stats';
import { FormVenn } from './FormVenn';

const share = (t: Tally) => (t.of ? Math.round((t.right / t.of) * 100) : null);

const ROWS: { key: keyof Form['parts']; label: string }[] = [
  { key: 'read', label: 'Read it right' },
  { key: 'strike', label: 'Middle of the face' },
  { key: 'line', label: 'On line' },
  { key: 'pace', label: 'Right pace' },
  { key: 'lag', label: 'Lag inside 10%' },
  { key: 'commit', label: 'Committed' },
  { key: 'lip', label: 'Lipped out' },
];

/**
 * The rating of a round. Two halves, how you hit them and how they finished, and a line when they
 * disagree, because a round can gain strokes off a bad stroke and lose them off a good one. Then
 * what built the number, since a score nobody can take apart is a score nobody trusts.
 */
export function FormPanel({ form }: { form: Form }) {
  const band = formBand(form.score);
  const story = formStory(form);
  return (
    <>
      <div className="card">
        <div className="form-hero">
          <span className="form-big" style={{ color: band.ink }}>
            {form.score.toFixed(1)}
          </span>
          <span className="small muted">
            Form, out of 10
            {form.process === null && ' · from the result alone'}
          </span>
        </div>
        {story && <p className={story.better ? 'form-story pos' : 'form-story neg'}>{story.line}</p>}

        <div className="stat-row">
          <span className="k">
            How you hit them
            <span className="small muted"> · from your tags</span>
          </span>
          <span className="v num">{form.process === null ? '--' : form.process.toFixed(1)}</span>
        </div>
        <div className="stat-row">
          <span className="k">
            How they finished
            <span className="small muted"> · strokes gained</span>
          </span>
          <span className="v num">{form.outcome.toFixed(1)}</span>
        </div>
      </div>

      {form.process === null ? (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          Only {form.tagged} putt{form.tagged === 1 ? '' : 's'} carried a read or a strike, so this is strokes gained on
          a 0 to 10 scale. Tag the read and the strike as you play and the other half appears.
        </p>
      ) : (
        <>
          <div className="field-label">What built it</div>
          <div className="card">
            {ROWS.map(({ key, label }) => {
              const t = form.parts[key];
              const pct = share(t);
              if (!t.of) return null;
              return (
                <div className="stat-row" key={key}>
                  <span className="k">{label}</span>
                  <span className={pct !== null && pct < 50 ? 'v num neg' : 'v num'}>
                    {key === 'lip' ? t.right : `${pct}%`}
                    <span className="small muted"> · {key === 'lip' ? 'putts' : `${t.right} of ${t.of}`}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <FormVenn venn={form.venn} />
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            Form is the average of the two halves. How you hit them is the share of what you controlled that you got
            right: the read, the middle of the face, the start line, pace (a miss that finished within a tenth of the
            putt, or 2 ft, with no decel or accel), lags from {LAG_FROM}+ ft inside 10%, and commitment. How they
            finished is strokes gained, which only sees whether it dropped.
          </p>
        </>
      )}
    </>
  );
}
