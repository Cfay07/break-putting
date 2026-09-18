export function TendencyDial({
  high,
  low,
  short,
  long,
}: {
  high: number;
  low: number;
  short: number;
  long: number;
}) {
  const max = Math.max(high, low, short, long, 1);
  const len = (n: number) => (n / max) * 44;
  const ink = '#14392b';
  const cx = 120;
  const cy = 95;
  const gap = 14;
  const w = 16;

  const bars = [
    { n: high, label: 'HIGH', x: cx - w / 2, y: cy - gap - len(high), bw: w, bh: len(high), tx: cx, ty: cy - gap - len(high) - 8, anchor: 'middle' as const },
    { n: low, label: 'LOW', x: cx - w / 2, y: cy + gap, bw: w, bh: len(low), tx: cx, ty: cy + gap + len(low) + 16, anchor: 'middle' as const },
    { n: short, label: 'SHORT', x: cx - gap - len(short), y: cy - w / 2, bw: len(short), bh: w, tx: cx - gap - len(short) - 7, ty: cy + 4, anchor: 'end' as const },
    { n: long, label: 'LONG', x: cx + gap, y: cy - w / 2, bw: len(long), bh: w, tx: cx + gap + len(long) + 7, ty: cy + 4, anchor: 'start' as const },
  ];

  return (
    <div style={{ maxWidth: 280, margin: '0 auto' }}>
      <svg viewBox="0 0 240 180" className="trend" role="img" aria-label="miss tendency">
        {bars.map((b) => (
          <g key={b.label}>
            {b.n > 0 && <rect x={b.x} y={b.y} width={b.bw} height={b.bh} fill={ink} opacity={0.85} rx="2" />}
            <text x={b.tx} y={b.ty} fontSize="11" fontWeight="700" fill={b.n ? ink : '#8c9a92'} textAnchor={b.anchor}>
              {b.label} {b.n}
            </text>
          </g>
        ))}
        <circle cx={cx} cy={cy} r="11" fill="none" stroke={ink} strokeWidth="2" />
        <circle cx={cx} cy={cy} r="2.5" fill={ink} />
      </svg>
    </div>
  );
}
