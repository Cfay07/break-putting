import { useState } from 'react';
import { fmtDate, today } from '../lib/format';
import { applyFilter, daysBefore, NO_FILTER, type RoundFilter } from '../lib/roundFilter';
import type { GreenSpeed, Putter, Round } from '../lib/types';
import { Sheet } from './Sheet';

const KINDS: { k: RoundFilter['kind']; label: string }[] = [
  { k: 'all', label: 'All' },
  { k: 'competitive', label: 'Competitive' },
  { k: 'casual', label: 'Casual' },
];

const GREENS: { k: GreenSpeed; label: string }[] = [
  { k: 'slow', label: 'Slow' },
  { k: 'medium', label: 'Medium' },
  { k: 'fast', label: 'Fast' },
  { k: 'glass', label: 'Glass' },
];

/**
 * One sheet, four groups, everything combining. Each option shows how many rounds it would
 * leave given the rest of the filter, so a choice that empties the page is visible before
 * it is tapped.
 */
export function StatsFilter({
  value,
  rounds,
  putters,
  onChange,
  onClose,
}: {
  value: RoundFilter;
  rounds: Round[];
  putters: Putter[];
  onChange: (f: RoundFilter) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<RoundFilter>(value);
  const count = (p: Partial<RoundFilter>) => applyFilter(rounds, { ...f, ...p }).length;
  const finished = rounds.filter((r) => r.finished);
  const latest = finished.reduce((a, r) => (r.date > a ? r.date : a), today());

  const putterRows = putters
    .map((p) => {
      const rs = finished.filter((r) => r.putterId === p.id).map((r) => r.date).sort();
      return rs.length ? { p, from: rs[0], to: rs[rs.length - 1] } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.to.localeCompare(a.to));
  const greens = GREENS.filter((g) => finished.some((r) => r.greenSpeed === g.k));

  const quick = [
    { label: 'Last 30 days', from: daysBefore(latest, 30) },
    { label: 'Last 90 days', from: daysBefore(latest, 90) },
    { label: `Since Jan 1`, from: `${latest.slice(0, 4)}-01-01` },
  ];

  const shown = applyFilter(rounds, f).length;

  return (
    <Sheet title="Filter rounds" onClose={onClose}>
      <div className="filter-group">
        <span className="filter-h">Rounds</span>
        <div className="seg seg-quiet">
          {KINDS.map((k) => (
            <button key={k.k} aria-pressed={f.kind === k.k} onClick={() => setF({ ...f, kind: k.k })}>
              {k.label}
              <span className="filter-n">{count({ kind: k.k })}</span>
            </button>
          ))}
        </div>
      </div>

      {putterRows.length > 1 && (
        <div className="filter-group">
          <span className="filter-h">Putter</span>
          <div className="filter-list">
            <button aria-pressed={!f.putterId} onClick={() => setF({ ...f, putterId: undefined })}>
              <span>Any putter</span>
              <span className="filter-n">{count({ putterId: undefined })}</span>
            </button>
            {putterRows.map(({ p, from, to }) => (
              <button key={p.id} aria-pressed={f.putterId === p.id} onClick={() => setF({ ...f, putterId: p.id })}>
                <span>
                  {p.name}
                  <span className="filter-sub">
                    {fmtDate(from)} to {fmtDate(to)}
                  </span>
                </span>
                <span className="filter-n">{count({ putterId: p.id })}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {greens.length > 0 && (
        <div className="filter-group">
          <span className="filter-h">Green speed</span>
          <div className="chips chips-sm">
            <button className={!f.greens ? 'chip chip-sel' : 'chip'} onClick={() => setF({ ...f, greens: undefined })}>
              Any
            </button>
            {greens.map((g) => (
              <button key={g.k} className={f.greens === g.k ? 'chip chip-sel' : 'chip'} onClick={() => setF({ ...f, greens: g.k })}>
                {g.label} <span className="filter-n">{count({ greens: g.k })}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="filter-group">
        <span className="filter-h">Dates</span>
        <div className="date-pair">
          <label>
            <span>From</span>
            <input
              type="date"
              value={f.from ?? ''}
              max={f.to ?? latest}
              onChange={(e) => setF({ ...f, from: e.target.value || undefined })}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={f.to ?? ''}
              min={f.from}
              onChange={(e) => setF({ ...f, to: e.target.value || undefined })}
            />
          </label>
        </div>
        <div className="chips chips-sm" style={{ marginTop: 8 }}>
          <button
            className={!f.from && !f.to ? 'chip chip-sel' : 'chip'}
            onClick={() => setF({ ...f, from: undefined, to: undefined })}
          >
            All time
          </button>
          {quick.map((q) => (
            <button
              key={q.label}
              className={f.from === q.from && !f.to ? 'chip chip-sel' : 'chip'}
              onClick={() => setF({ ...f, from: q.from, to: undefined })}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-foot">
        <button className="btn btn-ghost" onClick={() => setF(NO_FILTER)}>
          Reset
        </button>
        <button
          className="btn btn-primary"
          disabled={!shown}
          onClick={() => {
            onChange(f);
            onClose();
          }}
        >
          {shown ? `Show ${shown} ${shown === 1 ? 'round' : 'rounds'}` : 'No rounds match'}
        </button>
      </div>
    </Sheet>
  );
}
