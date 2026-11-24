import { LEVELS, levelStory, MIN_FIRST_PUTTS, type Level } from '../lib/level';

/** You against golfers at every level, on the two distances that place a putter fairly. Follows the filter. */
export function LevelCard({
  level,
  firstPutts,
  latest,
  onLatest,
}: {
  level: Level | null;
  firstPutts: number;
  /** The newest putter on its own, when the filtered rounds mix putters and it has enough putts. */
  latest: { id: string; name: string; level: Level } | null;
  /** Narrows the filter to that putter. */
  onLatest: (putterId: string) => void;
}) {
  if (!level)
    return (
      <p className="small muted" style={{ margin: '0 0 12px' }}>
        Where you stand against golfers at every level shows at {MIN_FIRST_PUTTS} first putts. You have {firstPutts}.
      </p>
    );
  const rows = [
    ...LEVELS.map((l) => ({ label: l.short, d50: l.d50, d2: l.d2 as number | null, you: false })),
    { label: 'You', d50: level.d50, d2: level.d2, you: true },
  ].sort((a, b) => b.d50 - a.d50);
  return (
    <>
      <p className="topic-answer">{levelStory(level)}</p>
      {level.d2 !== null && (
        <p className="small" style={{ margin: '-4px 0 8px' }}>
          On average you two-putt from {Math.round(level.d2)} ft.
        </p>
      )}
      {latest && (
        <button className="target-line" style={{ marginTop: 0 }} onClick={() => onLatest(latest.id)}>
          <span className="tl-what">
            These rounds mix putters. The <b>{latest.name}</b> alone: 50% from {latest.level.d50.toFixed(1)} ft.
          </span>
          <span className="tl-go">Show it ›</span>
        </button>
      )}
      <div className="field-label">Where you stand</div>
      <div className="table-wrap">
        <table className="tally-table level-table">
          <thead>
            <tr>
              <th />
              <th>50% from</th>
              <th>2 putts from</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={r.you ? 'level-you' : undefined}>
                <td>{r.label}</td>
                <td className="num">{r.d50.toFixed(1)} ft</td>
                <td className="num">{r.d2 === null ? '--' : `${Math.round(r.d2)} ft`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: '8px 0 14px' }}>
        50% from: the length you make half your first putts from. Closer in you make more, farther out fewer. 2 putts
        from: the length you average exactly two putts from. From the {level.firstPutts} first putts in these rounds.
      </p>
    </>
  );
}
