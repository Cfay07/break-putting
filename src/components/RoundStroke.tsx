import { signed } from '../lib/format';
import { usual } from '../lib/roundRanks';
import { puttSG } from '../lib/sg';
import { faultyOf } from '../lib/xp';
import type { Putt, Round } from '../lib/types';
import type { Form } from '../lib/form';
import { FormPanel } from './FormPanel';

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '--');

/**
 * How you hit them this round, from the putts you tagged: clean or not, start line, where on the
 * face, pace, and what the faults cost against the clean ones. Untagged putts say nothing either way.
 */
export function RoundStroke({
  round,
  rounds,
  baseline,
  form = null,
}: {
  round: Round;
  rounds: Round[];
  baseline: [number, number][];
  /** The round's rating, shown first: the stroke counts below are what built half of it. */
  form?: Form | null;
}) {
  const putts = round.holes.flatMap((h) =>
    h.putts.map((p, i) => ({ p, leave: i + 1 < h.putts.length ? h.putts[i + 1].d : null })),
  );
  const judged = putts.filter((x) => x.p.executionAssessed);
  const rating = form && <FormPanel form={form} />;
  if (!judged.length) {
    return (
      <>
        {rating}
        <p className="small muted" style={{ marginTop: rating ? 14 : 0 }}>
          No stroke tags this round. Tag a putt&apos;s line, strike or pace when you log it and this fills in.
        </p>
      </>
    );
  }

  const count = (f: (p: Putt) => boolean) => judged.filter((x) => f(x.p)).length;
  const clean = count((p) => !faultyOf(p));
  const usualClean = usual(round, rounds, baseline, 'stroke');
  const struck = judged.filter((x) => x.p.strike);
  const misses = putts.filter((x) => !x.p.made && x.p.speed);
  const sgOf = (xs: typeof judged) => xs.reduce((a, x) => a + (puttSG(baseline, x.p.d, x.p.made, x.leave) ?? 0), 0);
  const cleanPutts = judged.filter((x) => !faultyOf(x.p));
  const faultPutts = judged.filter((x) => faultyOf(x.p));

  const rows: [string, string][] = [
    ['Pushed', `${count((p) => !!p.push)} of ${judged.length}`],
    ['Pulled', `${count((p) => !!p.pull)} of ${judged.length}`],
    // Counted in "clean" by faultyOf, so it gets a row or the faults would not add up.
    [
      'Misread the break',
      `${count((p) => !!p.wrongWay || (p.brokeAs !== undefined && p.readAs !== undefined && p.brokeAs !== p.readAs))} of ${judged.length}`,
    ],
    ['Decel', String(count((p) => !!p.decel))],
    ['Accel', String(count((p) => !!p.accel))],
    ['Not committed', String(count((p) => !!p.uncommitted))],
    ...(struck.length
      ? ([
          ['Middle', `${struck.filter((x) => x.p.strike === 'centre').length} of ${struck.length}`],
          ['Toe', String(struck.filter((x) => x.p.strike === 'toe').length)],
          ['Heel', String(struck.filter((x) => x.p.strike === 'heel').length)],
        ] as [string, string][])
      : []),
    ...(misses.length
      ? ([
          ['Misses short', `${misses.filter((x) => x.p.speed === 'short').length} of ${misses.length}`],
          ['Misses long', `${misses.filter((x) => x.p.speed === 'long').length} of ${misses.length}`],
        ] as [string, string][])
      : []),
    ['Lipped out', String(putts.filter((x) => x.p.lip).length)],
  ];

  return (
    <>
      {rating}
      <section className="round-stroke" style={rating ? { marginTop: 18 } : undefined}>
        <div className="rp-lead">
          <span className="rp-k">Clean strokes</span>
          <strong>
            {clean} of {judged.length} · {pct(clean, judged.length)}
          </strong>
          <span>
            {usualClean !== null ? `Your usual is ${Math.round(usualClean * 100)}%. ` : ''}
            Clean means no push, pull, decel, accel, toe or heel, you were committed, and the read went the right way.
          </span>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          {rows.map(([k, v]) => (
            <div className="stat-row" key={k}>
              <span className="k">{k}</span>
              <span className="v num">{v}</span>
            </div>
          ))}
        </div>

        {cleanPutts.length > 0 && faultPutts.length > 0 && (
          <p className="rp-hole">
            <b>What the faults cost:</b> clean strokes{' '}
            <span className={sgOf(cleanPutts) >= 0 ? 'pos' : 'neg'}>{signed(sgOf(cleanPutts))}</span>, the{' '}
            {faultPutts.length} with a fault{' '}
            <span className={sgOf(faultPutts) >= 0 ? 'pos' : 'neg'}>{signed(sgOf(faultPutts))}</span> strokes gained.
          </p>
        )}
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          From the {judged.length} of {putts.length} putts you tagged a stroke on.
        </p>
      </section>
    </>
  );
}
