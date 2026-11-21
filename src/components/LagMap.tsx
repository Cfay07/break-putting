import { LAG_FROM } from '../lib/stats';
import { breakDirsOf, type MissSide, type Round, type Speed } from '../lib/types';

type Slope = 'up' | 'down' | 'flat';

interface Dot {
  key: string;
  side: MissSide;
  speed: Speed;
  leave: number;
  slope: Slope;
}

const SCALE = 7;
const RINGS = [3, 6, 9];
const CAP = 12;
const COLOR: Record<Slope, string> = { down: '#c0533a', up: '#1d7a5a', flat: '#9aa79f' };
const LABEL: Record<Slope, string> = { down: 'Downhill', up: 'Uphill', flat: 'Flat' };

/** Which way it finished, laid out like the miss grid: short left, long right, the high side up. */
function direction(side: MissSide, speed: Speed): [number, number] {
  // Dead on line at the right pace is a lip-out, which stays near the hole just past it.
  if (side === 'online' && speed === 'good') return [1, 0];
  const x = speed === 'short' ? -1 : speed === 'long' ? 1 : 0;
  const y = side === 'high' ? -1 : side === 'low' ? 1 : 0;
  return [x, y];
}

/**
 * Where your lags stopped. Every missed first putt from the lag distance that was tagged with
 * where it finished, drawn around the hole at the length of the putt it left. The direction is
 * the miss grid cell, so dots in the same cell fan out side by side rather than pretending to a
 * precision the tag never had.
 */
export function LagMap({ rounds }: { rounds: Round[] }) {
  let lags = 0;
  let holed = 0;
  const dots: Dot[] = [];
  for (const r of rounds) {
    r.holes.forEach((h) => {
      const p = h.putts[0];
      if (!p || p.d < LAG_FROM) return;
      lags++;
      if (p.made) return void holed++;
      if (!p.missSide || !p.speed) return;
      const dirs = breakDirsOf(p);
      dots.push({
        key: `${r.id}-${h.hole}`,
        side: p.missSide,
        speed: p.speed,
        leave: h.putts[1]?.d ?? 0,
        slope: dirs.includes('uphill') ? 'up' : dirs.includes('downhill') ? 'down' : 'flat',
      });
    });
  }
  if (dots.length < 3) return null;

  const groups = new Map<string, Dot[]>();
  for (const d of dots) {
    const k = direction(d.side, d.speed).join(',');
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  const placed = [...groups.entries()].flatMap(([k, ds]) => {
    const [x, y] = k.split(',').map(Number);
    const base = Math.atan2(y, x);
    // Cells sit 45 degrees apart, so a fan stays inside about 35 of them however many it holds.
    const step = ds.length > 1 ? Math.min(0.14, 0.6 / (ds.length - 1)) : 0;
    return ds
      .sort((a, b) => a.leave - b.leave)
      .map((d, i) => {
        const a = base + (i - (ds.length - 1) / 2) * step;
        const r = Math.min(d.leave, CAP) * SCALE;
        return { ...d, cx: Math.cos(a) * r, cy: Math.sin(a) * r };
      });
  });
  const slopes = (['down', 'up', 'flat'] as Slope[]).filter((s) => dots.some((d) => d.slope === s));
  const untagged = lags - holed - dots.length;

  return (
    <div className="card lag-map">
      <svg viewBox="-130 -108 260 216" role="img" aria-label="Where your lag putts finished around the hole">
        <line x1={-98} y1={0} x2={98} y2={0} className="lm-axis" />
        <line x1={0} y1={-104} x2={0} y2={104} className="lm-axis" />
        {RINGS.map((r) => (
          <circle key={r} r={r * SCALE} className="lm-ring" />
        ))}
        <text x={-128} y={3} className="lm-edge">
          Short
        </text>
        <text x={128} y={3} className="lm-edge" textAnchor="end">
          Long
        </text>
        <text x={4} y={-98} className="lm-edge">
          High
        </text>
        <text x={4} y={104} className="lm-edge">
          Low
        </text>
        {placed.map((d) => (
          <circle key={d.key} cx={d.cx} cy={d.cy} r={4} fill={COLOR[d.slope]} className="lm-dot" />
        ))}
        <circle r={4.2} className="lm-cup" />
        {RINGS.map((r) => (
          <text key={r} x={3} y={r * SCALE + 9} className="lm-ring-label">
            {r} ft
          </text>
        ))}
      </svg>
      <div className="lm-key">
        {slopes.map((s) => (
          <span key={s}>
            <i style={{ background: COLOR[s] }} />
            {LABEL[s]}
          </span>
        ))}
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        Every first putt from {LAG_FROM}+ ft you missed, at the length it left you. Short is left, long is right, the
        high side is up.
        {holed ? ` ${holed} holed.` : ''}
        {dots.some((d) => d.leave > CAP) ? ` Anything past ${CAP} ft sits on the edge.` : ''}
        {untagged > 0 ? ` ${untagged} had no finish tagged, so they are not on the map.` : ''}
      </p>
    </div>
  );
}
