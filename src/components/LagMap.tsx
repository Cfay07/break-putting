import { useState } from 'react';
import { LAG_FROM, LEAVE_STANDARD } from '../lib/stats';
import { breakDirsOf, type MissSide, type Round, type Speed } from '../lib/types';

type Slope = 'up' | 'down' | 'flat';
type Result = 'good' | 'two' | 'three';

interface Lag {
  key: string;
  d: number;
  made: boolean;
  /** Missing on a hole that stopped after the first putt, so it cannot be placed or averaged. */
  leave: number | null;
  side?: MissSide;
  speed?: Speed;
  slope: Slope;
  result: Result;
}

const SCALE = 7;
const RINGS = [3, 6, 9, 12];
const CAP = 12;
/** How far a dot can sit from the hole before it would leave the card. */
const EDGE_X = 122;
const EDGE_Y = 100;
const COLOR: Record<Result, string> = { good: '#2e8a5c', two: '#9aa79f', three: '#a52a1f' };
const SLOPES: [Slope | 'all', string][] = [
  ['all', 'All'],
  ['up', 'Uphill'],
  ['down', 'Downhill'],
  ['flat', 'Flat'],
];

/** Which way it finished, laid out like the miss grid: short left, long right, the high side up. */
function direction(side: MissSide, speed: Speed): [number, number] {
  // Dead on line at the right pace is a lip-out, which stays near the hole just past it.
  if (side === 'online' && speed === 'good') return [1, 0];
  const x = speed === 'short' ? -1 : speed === 'long' ? 1 : 0;
  const y = side === 'high' ? -1 : side === 'low' ? 1 : 0;
  return [x, y];
}

/** Newest first, so a limit keeps the lags that say how you putt now. */
function lagsOf(rounds: Round[]): Lag[] {
  const out: Lag[] = [];
  for (const r of [...rounds].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const h of [...r.holes].reverse()) {
      const p = h.putts[0];
      if (!p || p.d < LAG_FROM) continue;
      const leave = p.made ? 0 : (h.putts[1]?.d ?? null);
      const dirs = breakDirsOf(p);
      out.push({
        key: `${r.id}-${h.hole}`,
        d: p.d,
        made: p.made,
        leave,
        side: p.missSide,
        speed: p.speed,
        slope: dirs.includes('uphill') ? 'up' : dirs.includes('downhill') ? 'down' : 'flat',
        result: h.putts.length >= 3 ? 'three' : leave !== null && leave <= p.d * LEAVE_STANDARD ? 'good' : 'two',
      });
    }
  }
  return out;
}

/**
 * Where your lags stopped, colored by how they turned out: inside a tenth of the putt, a comeback
 * you holed, or a three-putt. The direction is the miss grid cell, so dots in the same cell fan
 * out side by side rather than pretending to a precision the tag never had. The dashed ring is
 * the average leave of the lags shown, holed ones counting as zero.
 */
export function LagMap({ rounds, limit }: { rounds: Round[]; limit?: number }) {
  const [slope, setSlope] = useState<Slope | 'all'>('all');
  const all = lagsOf(rounds);
  const recent = limit === undefined ? all : all.slice(0, limit);
  const cut = recent.length < all.length;
  if (recent.filter((l) => !l.made && l.side && l.speed).length < 3) return null;

  const shown = recent.filter((l) => slope === 'all' || l.slope === slope);
  const plotted = shown.filter((l) => !l.made && l.side && l.speed && l.leave !== null);
  const left = shown.filter((l) => l.leave !== null);
  const avg = left.length ? left.reduce((a, l) => a + l.leave!, 0) / left.length : null;
  const holed = shown.filter((l) => l.made).length;
  const untagged = shown.filter((l) => !l.made && (!l.side || !l.speed)).length;

  const groups = new Map<string, Lag[]>();
  for (const l of plotted) {
    const k = direction(l.side!, l.speed!).join(',');
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  const placed = [...groups.entries()]
    .flatMap(([k, ls]) => {
      const [x, y] = k.split(',').map(Number);
      const base = Math.atan2(y, x);
      // Cells sit 45 degrees apart, so a fan stays inside about 35 of them however many it holds.
      const step = ls.length > 1 ? Math.min(0.14, 0.6 / (ls.length - 1)) : 0;
      return ls
        .sort((a, b) => a.leave! - b.leave!)
        .map((l, i) => {
          const a = base + (i - (ls.length - 1) / 2) * step;
          // To scale out past the last ring too, as far as the card allows in that direction. Only
          // a leave longer than the card is pulled in to its edge, so one huge miss never shrinks
          // every other lag into the cup.
          const room = Math.min(EDGE_X / Math.abs(Math.cos(a) || 1e-6), EDGE_Y / Math.abs(Math.sin(a) || 1e-6));
          const r = Math.min(l.leave! * SCALE, room);
          return { ...l, cx: Math.cos(a) * r, cy: Math.sin(a) * r };
        });
    })
    // Three-putts last, so no plain dot is ever drawn over their 3.
    .sort((a, b) => Number(a.result === 'three') - Number(b.result === 'three'));
  const present = new Set(recent.map((l) => l.slope));
  const ring = avg !== null && avg > 0 ? Math.min(avg, CAP) * SCALE : null;

  return (
    <div className="card lag-map">
      {present.size > 1 && (
        <div className="chips chips-sm lm-slopes">
          {SLOPES.filter(([k]) => k === 'all' || present.has(k)).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={slope === k ? 'chip chip-sel' : 'chip'}
              aria-pressed={slope === k}
              onClick={() => setSlope(k)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <svg viewBox="-130 -108 260 216" role="img" aria-label="Where your lag putts finished around the hole">
        <line x1={-98} y1={0} x2={98} y2={0} className="lm-axis" />
        <line x1={0} y1={-104} x2={0} y2={104} className="lm-axis" />
        {RINGS.map((r) => (
          <circle key={r} r={r * SCALE} className="lm-ring" />
        ))}
        {ring !== null && <circle r={ring} className="lm-avg" />}
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
        {placed.map((l) =>
          l.result === 'three' ? (
            <g key={l.key}>
              <circle cx={l.cx} cy={l.cy} r={5.6} fill={COLOR.three} className="lm-dot" />
              <text x={l.cx} y={l.cy + 2.4} className="lm-three">
                3
              </text>
            </g>
          ) : (
            <circle key={l.key} cx={l.cx} cy={l.cy} r={4} fill={COLOR[l.result]} className="lm-dot" />
          ),
        )}
        <circle r={4.2} className="lm-cup" />
        {RINGS.map((r) => (
          <text key={r} x={3} y={r * SCALE + 9} className="lm-ring-label">
            {r} ft
          </text>
        ))}
        {ring !== null && (
          <text x={Math.cos(-0.75) * ring + 3} y={Math.sin(-0.75) * ring - 3} className="lm-avg-label">
            Avg {avg!.toFixed(1)} ft
          </text>
        )}
      </svg>
      <div className="lm-key">
        <span>
          <i style={{ background: COLOR.good }} />
          Inside 10%
        </span>
        <span>
          <i style={{ background: COLOR.two }} />
          Comeback holed
        </span>
        <span>
          <b className="lm-three-key">3</b>
          Three-putt
        </span>
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        {cut ? `Your last ${limit} lags from ${LAG_FROM}+ ft` : `Your lags from ${LAG_FROM}+ ft`}, each at the length it
        left you. Short is left, long is right, the high side is up.
        {holed ? ` ${holed} went in.` : ''}
        {plotted.some((l) => l.leave! > CAP) ? ` A dot outside the ${CAP} ft ring went further than that.` : ''}
        {untagged > 0 ? ` ${untagged} had no finish tagged, so they are not on the map.` : ''}
      </p>
    </div>
  );
}
