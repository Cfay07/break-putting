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
  // Mixed putters average a before and an after, so the putter you use now leads and the blend is a footnote.
  const you = latest?.level ?? level;
  const rows = [
    ...LEVELS.map((l) => ({ label: l.short, d50: l.d50, d2: l.d2 as number | null, you: false })),
    { label: 'You', d50: you.d50, d2: you.d2, you: true },
  ].sort((a, b) => b.d50 - a.d50);
  return (
    <>
      <p className="topic-answer">{levelStory(you, latest?.name)}</p>
      {you.d2 !== null && (
        <p className="small" style={{ margin: '-4px 0 12px' }}>
          You average two putts from {Math.round(you.d2)} ft.
          {latest ? ` All your putters together: half from ${level.d50.toFixed(1)} ft.` : ''}
        </p>
      )}
      <div className="field-label">Where you stand</div>
      <div className="table-wrap">
        <table className="tally-table level-table">
          <thead>
            <tr>
              <th />
              <th>Half go in</th>
              <th>Two putts</th>
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
        Half go in is your range: the length you hole half your first putts from. Two putts is where you average exactly
        two. From your {you.firstPutts} first putts{latest ? ` with the ${latest.name}` : ''}.
      </p>
    </>
  );
}
