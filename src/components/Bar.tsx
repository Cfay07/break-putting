export function Bar({
  label,
  value,
  ratio,
  warn,
}: {
  label: string;
  value: string;
  ratio: number | null;
  warn?: boolean;
}) {
  return (
    <div className="bar-row">
      <span className="k">{label}</span>
      <span className="bar">
        <span
          className={warn ? 'bar-fill warnfill' : 'bar-fill'}
          style={{ width: `${Math.max(0, Math.min(100, (ratio ?? 0) * 100))}%` }}
        />
      </span>
      <span className="v num">{value}</span>
    </div>
  );
}

export function Split({
  parts,
}: {
  parts: { label: string; count: number; color: string }[];
}) {
  const total = parts.reduce((s, p) => s + p.count, 0);
  if (!total) return <p className="small muted">Nothing tagged yet.</p>;
  return (
    <>
      <div className="split">
        {parts.map((p) => {
          const share = (p.count / total) * 100;
          if (!p.count) return null;
          return (
            <div key={p.label} style={{ width: `${share}%`, background: p.color }}>
              {share >= 24 ? `${p.label} ${Math.round(share)}%` : share >= 11 ? `${Math.round(share)}%` : ''}
            </div>
          );
        })}
      </div>
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        {parts.map((p) => `${p.count} ${p.label.toLowerCase()}`).join(' · ')}
      </p>
    </>
  );
}
