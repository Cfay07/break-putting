export interface Blame {
  read: number;
  stroke: number;
  speed: number;
}

const W = 320;
const PAD_X = 34;
const TOP = 26;
const SIDE = W - PAD_X * 2;
const H = (SIDE * Math.sqrt(3)) / 2;

/** Corners: read at the top, stroke bottom left, speed bottom right. */
const R: [number, number] = [PAD_X + SIDE / 2, TOP];
const S: [number, number] = [PAD_X, TOP + H];
const P: [number, number] = [PAD_X + SIDE, TOP + H];

/**
 * Barycentric placement. A miss is one of three things, the shares sum to one, and the point
 * is the weighted average of the corners: p = r·R + s·S + v·P. Sitting on a corner means every
 * miss was that one thing; the middle means they are split evenly.
 */
function at(b: Blame): [number, number] {
  const total = b.read + b.stroke + b.speed;
  if (!total) return [PAD_X + SIDE / 2, TOP + H / 2];
  const [r, s, v] = [b.read / total, b.stroke / total, b.speed / total];
  return [r * R[0] + s * S[0] + v * P[0], r * R[1] + s * S[1] + v * P[1]];
}

/** Lines of constant share, so the distance from an edge can be read off. */
function guides() {
  const out: [number, number, number, number][] = [];
  for (const f of [0.25, 0.5, 0.75]) {
    const lerp = (a: [number, number], b: [number, number], t: number): [number, number] => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
    ];
    const a1 = lerp(S, R, f);
    const b1 = lerp(P, R, f);
    out.push([a1[0], a1[1], b1[0], b1[1]]);
    const a2 = lerp(R, S, f);
    const b2 = lerp(P, S, f);
    out.push([a2[0], a2[1], b2[0], b2[1]]);
    const a3 = lerp(R, P, f);
    const b3 = lerp(S, P, f);
    out.push([a3[0], a3[1], b3[0], b3[1]]);
  }
  return out;
}

export function BlameTriangle({ season, rounds = [] }: { season: Blame; rounds?: Blame[] }) {
  const total = season.read + season.stroke + season.speed;
  if (!total) return null;
  const [cx, cy] = at(season);
  const share = (n: number) => Math.round((n / total) * 100);
  const biggest =
    season.read >= season.stroke && season.read >= season.speed
      ? ['the read', share(season.read)]
      : season.stroke >= season.speed
        ? ['the stroke', share(season.stroke)]
        : ['the speed', share(season.speed)];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${TOP + H + 40}`}
        className="tri"
        role="img"
        aria-label={`${biggest[1]}% of misses were ${biggest[0]}`}>
        {guides().map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="tri-guide" />
        ))}
        <polygon points={`${R[0]},${R[1]} ${P[0]},${P[1]} ${S[0]},${S[1]}`} className="tri-edge" />

        {rounds.map((b, i) => {
          const [x, y] = at(b);
          return <circle key={i} cx={x} cy={y} r={4} className="tri-round" />;
        })}

        <circle cx={cx} cy={cy} r={9} className="tri-dot" />

        <text x={R[0]} y={R[1] - 9} className="tri-label" textAnchor="middle">READ</text>
        <text x={S[0] - 4} y={S[1] + 22} className="tri-label" textAnchor="start">STROKE</text>
        <text x={P[0] + 4} y={P[1] + 22} className="tri-label" textAnchor="end">SPEED</text>
      </svg>
      <p className="small" style={{ margin: '2px 0 0' }}>
        <strong>{biggest[1]}%</strong> of your misses were {biggest[0]}. Read {share(season.read)}%,
        stroke {share(season.stroke)}%, speed {share(season.speed)}%, off {total} tagged misses.
      </p>
      {rounds.length > 1 && (
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          Small dots are single rounds. The big one is every round together. A dot near a corner
          means nearly every miss that round was the one thing.
        </p>
      )}
    </div>
  );
}
