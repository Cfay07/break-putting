import { Chevron } from '../components/Chevron';
import { allDrills, distanceText, fits, SCORING_LABELS } from '../lib/drills';
import { usePractice } from '../lib/usePractice';
import { SURFACE_LABELS, type DrillDef } from '../lib/types';

const GROUPS: { k: DrillDef['source']; label: string }[] = [
  { k: 'mine', label: 'Yours' },
  { k: 'import', label: 'Imported' },
  { k: 'app', label: "BREAK!'s" },
];

/** Every drill there is, grouped by where it came from, with the ones that do not fit today set apart. */
export function DrillBrowse() {
  const { state, surface, room } = usePractice();
  const drills = allDrills(state);
  return (
    <div>
      <div className="page-top">
        <a href="#/practice" className="back-link">
          Practice
        </a>
        <a href="#/practice/edit/new" className="back-link">
          New drill
        </a>
      </div>
      <h1 className="page-title">Every drill</h1>
      <p className="small muted" style={{ margin: '2px 0 0' }}>
        {SURFACE_LABELS[surface]}, up to {room} ft. Drills that need more room are listed last.
      </p>
      {GROUPS.map((g) => {
        const list = drills
          .filter((d) => d.source === g.k)
          .map((d) => ({ d, ok: !d.putting || fits(d, surface, room) }))
          .sort((a, b) => Number(b.ok) - Number(a.ok));
        if (!list.length) return null;
        return (
          <div key={g.k}>
            <h2>{g.label}</h2>
            <div className="row-list">
              {list.map(({ d, ok }) => (
                <a key={d.id} className={ok ? 'nav-row' : 'nav-row off'} href={`#/practice/drill/${d.from ?? d.id}`}>
                  <span className="nav-main">
                    <strong>
                      {d.name}
                      {d.from && <span className="small muted"> · edited</span>}
                    </strong>
                    <span className="small muted">
                      {[distanceText(d), SCORING_LABELS[d.scoring], ok ? '' : 'needs more room'].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <Chevron />
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
