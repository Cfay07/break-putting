import { go } from '../lib/router';
import type { RowNumber } from '../lib/statsHome';

export interface TopicRow {
  key: string;
  title: string;
  sub: string;
  num?: RowNumber | null;
  fmt?: (v: number) => string;
  /** Which way is good, so the arrow is green when it moved the right way. */
  better?: 'up' | 'down';
  /** Bar length, nought to one. Red when more is worse. */
  bar?: number;
  /** Shown in place of a trend, when there is a number but no comparison worth one. */
  note?: string;
}

/** How far a number has to move before it earns an arrow, in its own units. */
const STILL = (v: number) => (Math.abs(v) <= 1 ? 0.02 : 0.1);

function Trend({ r, fmt, better }: { r: RowNumber; fmt: (v: number) => string; better: 'up' | 'down' }) {
  if (r.fresh) return <small className="flat">new tag</small>;
  if (r.before === null) return null;
  const d = r.now - r.before;
  if (Math.abs(d) < STILL(r.before)) return <small className="flat">same as before</small>;
  const good = better === 'up' ? d > 0 : d < 0;
  return (
    <small className={good ? 'up' : 'down'}>
      {d > 0 ? '▲' : '▼'} from {fmt(r.before)}
    </small>
  );
}

/** One row per topic: what it is, its number, and which way it is going. Each opens its own page. */
export function TopicRows({ rows }: { rows: TopicRow[] }) {
  return (
    <div className="topic-list">
      {rows.map((row) => (
        <button key={row.key} className="topic-row" onClick={() => go(`/stats/t/${row.key}`)}>
          <span className="tr-name">
            <b>{row.title}</b>
            <small>{row.sub}</small>
          </span>
          <span className="tr-bar">
            {row.bar !== undefined && (
              <i
                style={{
                  width: `${Math.max(0, Math.min(1, row.bar)) * 100}%`,
                  background: row.better === 'down' ? '#a52a1f' : '#2e8a5c',
                }}
              />
            )}
          </span>
          <span className="tr-val num">
            {row.num && row.fmt ? row.fmt(row.num.now) : (row.note ?? '')}
            {row.num && row.fmt && <Trend r={row.num} fmt={row.fmt} better={row.better ?? 'up'} />}
          </span>
          <span className="chev">›</span>
        </button>
      ))}
    </div>
  );
}
