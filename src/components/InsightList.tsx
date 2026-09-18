import { insights } from '../lib/insights';
import type { Stats } from '../lib/stats';

export function InsightList({ stats }: { stats: Stats }) {
  const cards = insights(stats);
  if (!cards.length) {
    return <p className="small muted">Log a few more putts and the patterns start showing up here.</p>;
  }
  return (
    <div>
      {cards.map((c) => (
        <div key={c.id} className={c.tone === 'warn' ? 'card card-warn' : 'card card-good'}>
          <h3>{c.title}</h3>
          <p className="small" style={{ margin: '2px 0 8px' }}>
            {c.detail}
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            <strong>Drill.</strong> {c.drill}
          </p>
        </div>
      ))}
    </div>
  );
}
