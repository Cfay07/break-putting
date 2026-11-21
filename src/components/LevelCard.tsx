import { LEVELS, levelStory, MIN_FIRST_PUTTS, type Level } from '../lib/level';

/** You against golfers at every level, on the two distances that place a putter fairly. */
export function LevelCard({
  level,
  firstPutts,
  latest,
}: {
  level: Level | null;
  firstPutts: number;
  /** The newest putter on its own, when this set mixes putters and it has enough putts. */
  latest: { name: string; level: Level } | null;
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
      {latest && (
        <p className="small" style={{ margin: '-4px 0 12px' }}>
          These rounds mix putters. With the {latest.name} alone: half in from {latest.level.d50.toFixed(1)} ft
          {latest.level.d2 !== null ? `, two putts from ${Math.round(latest.level.d2)} ft` : ''}.
        </p>
      )}
      <div className="field-label">Where you stand</div>
      <div className="table-wrap">
        <table className="tally-table level-table">
          <thead>
            <tr>
              <th />
              <th>Half in</th>
              <th>2 putts</th>
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
        Half in is how far out you still hole the first putt half the time. 2 putts is how far out you average exactly
        two. Golfers grouped by their scoring average. From your {level.firstPutts} first putts.
      </p>
    </>
  );
}
