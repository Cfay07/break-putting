export function Trend({ values, invert }: { values: number[]; invert?: boolean }) {
  if (values.length === 0) return <p className="small muted">No rounds yet.</p>;
  const w = 300;
  const h = 72;
  const pad = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const x = (i: number) => (values.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (values.length - 1));
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const last = values[values.length - 1];
  const better = invert ? last <= avg : last >= avg;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="trend" role="img" aria-label="trend by round">
      <line x1={pad} x2={w - pad} y1={y(avg)} y2={y(avg)} stroke="#8c9a92" strokeWidth="1" strokeDasharray="4 4" />
      <polyline
        points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
        fill="none"
        stroke="#14392b"
        strokeWidth="2"
      />
      {values.map((v, i) => {
        const last = i === values.length - 1;
        if (!last && values.length > 14) return null;
        return (
          <circle
            key={i}
            cx={x(i)}
            cy={y(v)}
            r={last ? 4.5 : 3}
            fill={last ? (better ? '#1f7a4d' : '#a52a1f') : '#14392b'}
          />
        );
      })}
    </svg>
  );
}
