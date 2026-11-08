import type { Moment, MomentViz } from '../lib/moments';

function PuttLine({ dirs }: { dirs: string[] }) {
  const l = dirs.includes('L→R');
  const r = dirs.includes('R→L');
  const [d, ball, cup]: [string, number, number[]] =
    l && r
      ? ['M60 100 C 20 64, 160 86, 130 58 S 196 20, 214 30', 60, [214, 30]]
      : l
        ? ['M70 100 C 50 52, 140 24, 210 30', 70, [210, 30]]
        : r
          ? ['M210 100 C 230 52, 140 24, 70 30', 210, [70, 30]]
          : ['M140 100 L 140 34', 140, [140, 28]];
  return (
    <svg viewBox="0 0 280 110" className="moment-viz" aria-hidden="true">
      <ellipse cx="140" cy="62" rx="150" ry="58" className="mv-green" />
      <path d={d} className="mv-line" />
      <circle cx={ball} cy="100" r="5" className="mv-ball" />
      <circle cx={cup[0]} cy={cup[1]} r="8" className="mv-cup" />
      <circle cx={cup[0]} cy={cup[1]} r="3.5" className="mv-pin" />
    </svg>
  );
}

function Bars({ bars }: { bars: { v: number; label: string; me: boolean }[] }) {
  const max = Math.max(...bars.map((b) => b.v));
  return (
    <div className="mv-bars" role="img" aria-label={bars.map((b) => `${b.label} ${b.v}`).join(', ')}>
      {bars.map((b, i) => (
        <div key={i} className={b.me ? 'mv-bar me' : 'mv-bar'}>
          <span className="mv-bar-v">{b.v}</span>
          <i style={{ height: `${40 + (b.v / max) * 50}px` }} />
          <span className="mv-bar-l">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function Dots({ holes }: { holes: { hole: number; chance: number; made: boolean }[] }) {
  return (
    <div
      className="mv-dots"
      style={{ gridTemplateColumns: `repeat(${holes.length}, minmax(0, 1fr))` }}
      role="img"
      aria-label={`Holed the first putt on ${holes.filter((h) => h.made).map((h) => h.hole).join(', ')}`}
    >
      {holes.map((h) => (
        <div key={h.hole} className={h.made ? 'mv-dot made' : 'mv-dot'}>
          <span>{h.hole}</span>
          <i />
          <b>{Math.round(h.chance * 100)}%</b>
        </div>
      ))}
    </div>
  );
}

function Lag({ from, leave }: { from: number; leave: number }) {
  const x = (ft: number) => 270 - (ft / from) * 258;
  return (
    <svg viewBox="0 0 280 80" className="moment-viz" role="img" aria-label={`${from} feet to ${leave} feet, drawn to scale`}>
      <line x1="12" y1="46" x2="272" y2="46" className="mv-track" />
      <circle cx="270" cy="46" r={Math.max(6, (3 / from) * 258)} className="mv-zone" />
      <path d={`M12 46 Q 140 14 ${x(leave)} 46`} className="mv-line" />
      <circle cx="12" cy="46" r="4" className="mv-ball-start" />
      <circle cx="272" cy="46" r="5" className="mv-cup" />
      <circle cx={x(leave)} cy="46" r="4.5" className="mv-ball" />
      <text x="12" y="72" className="mv-text">{from} ft</text>
      <text x="272" y="72" textAnchor="end" className="mv-text">3 ft circle</text>
    </svg>
  );
}

function Streak({ holes }: { holes: { hole: number; one: boolean }[] }) {
  return (
    <div className="mv-streak" role="img" aria-label={`One-putts on holes ${holes.filter((h) => h.one).map((h) => h.hole).join(', ')}`}>
      {holes.map((h) => (
        <span key={h.hole} className={h.one ? 'on' : undefined}>
          {h.hole}
        </span>
      ))}
    </div>
  );
}

function Viz({ v }: { v: MomentViz }) {
  if (v.t === 'line') return <PuttLine dirs={v.dirs} />;
  if (v.t === 'bars') return <Bars bars={v.bars} />;
  if (v.t === 'dots') return <Dots holes={v.holes} />;
  if (v.t === 'lag') return <Lag from={v.from} leave={v.leave} />;
  return <Streak holes={v.holes} />;
}

export function MomentCard({ m, dark, onShare }: { m: Moment; dark?: boolean; onShare?: () => void }) {
  return (
    <article className={`moment${dark ? ' dark' : ''}${m.low ? ' low' : ''}`}>
      <header className="moment-head">
        <span className="moment-label">{m.label}</span>
        {m.tag && <span className="moment-tag">{m.tag}</span>}
      </header>
      <div className="moment-big">
        <span className="moment-num">{m.big}</span>
        {m.unit && <span className="moment-unit">{m.unit}</span>}
      </div>
      <p className="moment-line">{m.line}</p>
      {m.viz && (
        <div className="moment-fill">
          <Viz v={m.viz} />
        </div>
      )}
      <div className="moment-stats">
        {m.stats.slice(0, 2).map((s) => (
          <div key={s.l}>
            <b className={s.tone ? `t-${s.tone}` : undefined}>{s.v}</b>
            <span>{s.l}</span>
          </div>
        ))}
        {onShare && (
          <button className="moment-share" onClick={onShare} aria-label="Share this moment">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12" />
              <path d="M7 8l5-5 5 5" />
              <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </svg>
          </button>
        )}
      </div>
    </article>
  );
}
