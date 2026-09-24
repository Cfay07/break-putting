import { BUCKETS, MIN_TAGGED_ROUNDS, readBias, type ReadBias, type Stats } from '../lib/stats';
import { BREAK_BUCKETS, BREAK_BUCKET_LABELS } from '../lib/types';
import { Split } from './Bar';
import { TendencyDial } from './TendencyDial';

function readVerdict(r: ReadBias): string {
  const sided = r.high + r.low;
  const lead = r.side === 'low' ? `${r.low} of ${sided} finish below the hole` : `${r.high} of ${sided} finish above the hole`;
  const cause =
    r.side === 'low'
      ? 'not playing enough break'
      : 'playing too much break, or hitting them hard enough to take the break out';

  if (r.verdict === 'thin') {
    return sided === 0
      ? 'No break-side misses tagged yet.'
      : `Only ${sided} misses have a side on them. Tag a few more rounds before reading into it.`;
  }
  if (r.verdict === 'leaning') {
    // The putts clear the noise line, but they come from too few rounds to call it a habit:
    // one day's greens can push every miss the same way.
    return `${lead}, which leans toward ${cause}. That is only ${r.rounds} round${r.rounds === 1 ? '' : 's'} of tagging though, and one day's greens can push every miss the same way. Tag ${MIN_TAGGED_ROUNDS - r.rounds} more and this becomes a real read.`;
  }
  if (r.verdict === 'read') {
    return `${lead}, across ${r.rounds} rounds. That is a read and aim problem: you are ${cause}.`;
  }
  return `Your misses split ${r.high} high and ${r.low} low, close enough to even. The read is not the problem, the stroke is.`;
}

export function PatternPanel({ stats, taggedRounds = 1 }: { stats: Stats; taggedRounds?: number }) {
  const p = stats.pattern;
  const bias = readBias(p, taggedRounds);
  const paceTotal = p.short + p.long;
  // Imported rounds carry no tags, so this section can be a fraction of the page's sample.
  const coverage = stats.missedPutts ? p.tagged / stats.missedPutts : 0;
  const breakTagged = p.breakMakes + p.breakMisses;
  // A make rate needs both halves tagged. With misses only it reads 0% however well you putt.
  const MIN_SIDE = 5;
  const rateIsReal = p.breakMakes >= MIN_SIDE && p.breakMisses >= MIN_SIDE;

  return (
    <div>
      {stats.missedPutts > 0 && coverage < 0.8 && (
        <p className="small muted" style={{ margin: '0 0 10px' }}>
          Everything below comes from the {p.tagged} missed putts you tagged a side on, out of{' '}
          {stats.missedPutts} you missed. Imported rounds carry no tags, so this is a smaller
          sample than the rest of the page.
        </p>
      )}
      <TendencyDial high={p.high} low={p.low} short={p.short} long={p.long} />
      {paceTotal >= 1 && (
        <p className="small" style={{ marginTop: 0 }}>
          {p.short >= p.long ? p.short : p.long} of {paceTotal} pace misses were{' '}
          {p.short >= p.long ? 'short' : 'long'}.
        </p>
      )}

      <div className="field-label">Read bias</div>
      <p className="small" style={{ margin: '0 0 8px' }}>
        {readVerdict(bias)}
        {bias.verdict !== 'thin' && bias.onlineShare !== null && bias.onlineShare >= 0.3
          ? ` ${p.online} of your misses were dead on line, so the read was right and the speed was wrong.`
          : ''}
      </p>
      <Split
        parts={[
          { label: 'High', count: p.high, color: '#14392b' },
          { label: 'Low', count: p.low, color: '#4d6558' },
          { label: 'On line', count: p.online, color: '#b5603a' },
        ]}
      />

      <div className="field-label">Pace bias</div>
      <Split
        parts={[
          { label: 'Short', count: p.short, color: '#a52a1f' },
          { label: 'Good', count: p.good, color: '#1f7a4d' },
          { label: 'Long', count: p.long, color: '#b5603a' },
        ]}
      />

      <div className="field-label">Stroke</div>
      <div className="card">
        <div className="stat-row">
          <span className="k">Pushed / pulled</span>
          <span className="v num">
            {p.push} / {p.pull}
          </span>
        </div>
        <div className="stat-row">
          <span className="k">Lip-outs</span>
          <span className={p.lip >= 3 ? 'v num neg' : 'v num'}>{p.lip}</span>
        </div>
      </div>

      {breakTagged >= 10 && (
        <>
          <div className="field-label">How the putt broke</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Break</th>
                  {rateIsReal && <th>Made</th>}
                  {rateIsReal && <th>%</th>}
                  <th>Putts</th>
                  <th>High</th>
                  <th>Low</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...BREAK_BUCKETS.map((b) => [BREAK_BUCKET_LABELS[b], p.byBreak[b]] as const),
                  ['Uphill', p.uphill] as const,
                  ['Downhill', p.downhill] as const,
                ].map(([label, t]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    {rateIsReal && <td>{t.attempts ? `${t.makes}/${t.attempts}` : '--'}</td>}
                    {rateIsReal && (
                      <td>{t.attempts ? `${((t.makes / t.attempts) * 100).toFixed(0)}%` : '--'}</td>
                    )}
                    <td>{t.attempts || '--'}</td>
                    <td>{t.high || '--'}</td>
                    <td>{t.low || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            A double breaker counts once, in its own row, so every tagged putt sits in exactly one
            of the top four. Uphill and downhill are a separate axis and overlap with them.
            {!rateIsReal
              ? ` No make rate yet: you have tagged ${p.breakMisses} miss${p.breakMisses === 1 ? '' : 'es'} and ${p.breakMakes} make${p.breakMakes === 1 ? '' : 's'}. Tag the break on putts you hole too, or the rate can only ever read zero.`
              : ''}
          </p>
        </>
      )}

      <div className="field-label">Miss side by distance</div>
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Distance</th>
            <th>High</th>
            <th>Low</th>
            <th>On line</th>
          </tr>
        </thead>
        <tbody>
          {BUCKETS.map((b) => {
            const row = p.byBucket[b.key];
            return (
              <tr key={b.key}>
                <td>{b.label}</td>
                <td>{row.high || '--'}</td>
                <td>{row.low || '--'}</td>
                <td>{row.online || '--'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
