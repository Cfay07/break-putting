import { useEffect, useRef } from 'react';
import { fmtDate } from '../lib/format';
import { MIN_STRIKE, type StrikeRow } from '../lib/stats';

const ORDER: StrikeRow['key'][] = ['heel', 'centre', 'toe'];
const pct = (n: number, of: number) => Math.round((n / of) * 100);

/** One line on where you strike it and what that says, in counts until a strike has enough putts. */
function strikeStory(rows: StrikeRow[], rounds: number): string {
  const total = rows.reduce((n, r) => n + r.putts, 0);
  const mid = rows.find((r) => r.key === 'centre');
  const off = rows.filter((r) => r.key !== 'centre');
  const parts = [
    `${pct(mid?.putts ?? 0, total)}% off the middle of the face, from ${total} tagged putts in ${rounds} ${rounds === 1 ? 'round' : 'rounds'}.`,
  ];
  const paced = mid ? mid.short + mid.long + mid.pace : 0;
  // A middle strike that still finishes short is the read or the pace, not the contact.
  if (mid && paced >= 10 && mid.short >= mid.long * 2)
    parts.push(
      `Your misses off the middle finished short ${mid.short} times and long ${mid.long}, so it isn't contact leaving them short.`,
    );
  const thin = off.filter((r) => r.putts < MIN_STRIKE);
  if (thin.length)
    parts.push(
      `${thin.map((r) => `${r.label} ${r.putts}`).join(', ')}: too few to say what an off-centre strike costs you yet.`,
    );
  return parts.join(' ');
}

/**
 * Strike against what the ball did. The face bar and the miss counts read at any sample; Holed
 * against Usual waits for twenty putts a strike, because raw make rates off a handful of short toe
 * putts once made the toe look better than the middle.
 */
export function StrikePanel({
  rows,
  byRound,
}: {
  rows: StrikeRow[];
  byRound: { id: string; date: string; middle: number; tagged: number }[];
}) {
  const strip = useRef<HTMLDivElement>(null);
  // Newest round on the right and in view: the strip opens where you are now.
  useEffect(() => {
    if (strip.current) strip.current.scrollLeft = strip.current.scrollWidth;
  }, [byRound]);
  const total = rows.reduce((n, r) => n + r.putts, 0);
  if (!total) return null;
  const ordered = ORDER.map((k) => rows.find((r) => r.key === k)).filter((r): r is StrikeRow => !!r);

  return (
    <>
      <p className="topic-answer">{strikeStory(rows, byRound.length)}</p>

      <div className="card strike-card">
        <div className="strike-face" role="img" aria-label="Where on the face your putts came off">
          {ordered.map((r) => (
            <div key={r.key} className={`sf-seg sf-${r.key}`} style={{ flexGrow: r.putts }}>
              <b className="num">{pct(r.putts, total)}%</b>
              <span>{r.label}</span>
              <small>{r.putts}</small>
            </div>
          ))}
        </div>

        <div className="field-label">Where the misses went</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Strike</th>
                <th>Missed</th>
                <th>Short</th>
                <th>Long</th>
                <th>Right pace</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td className="num">{r.missed}</td>
                  <td className={r.short > r.long * 2 && r.short >= 3 ? 'num neg' : 'num'}>{r.short}</td>
                  <td className={r.long > r.short * 2 && r.long >= 3 ? 'num neg' : 'num'}>{r.long}</td>
                  <td className="num">{r.pace}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ordered.some((r) => r.missed > r.short + r.long + r.pace) && (
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            Misses with no pace tagged count in Missed only.
          </p>
        )}

        {byRound.length > 1 && (
          <>
            <div className="field-label">Off the middle, round by round</div>
            <div className="strike-rounds" ref={strip}>
              {byRound.map((r) => (
                <div key={r.id} className="sr-col" title={`${r.middle} of ${r.tagged}`}>
                  <small className="num">{pct(r.middle, r.tagged)}%</small>
                  <i style={{ height: `${Math.max(4, pct(r.middle, r.tagged) * 0.6)}px` }} />
                  <span>{fmtDate(r.date).replace(/,? \d{4}$/, '')}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="field-label">Holed against usual</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Strike</th>
              <th>Putts</th>
              <th>Holed</th>
              <th>Usual</th>
              <th>Left</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td className="num">{r.putts}</td>
                <td className="num">{r.expected === null ? '--' : r.makes}</td>
                <td className="num">{r.expected === null ? '--' : Math.round(r.expected)}</td>
                <td className="num">{r.leavePct === null ? '--' : `${r.leavePct.toFixed(1)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        Usual is what you hole from those same lengths on every putt you have logged, so Holed above Usual means that
        strike did better than normal. Left is how far a miss finished as a share of the putt. A row needs {MIN_STRIKE}{' '}
        putts before it shows numbers.
      </p>
    </>
  );
}
