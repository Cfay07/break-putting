import { useRef, useState } from 'react';
import type { Moment } from '../lib/moments';
import { shareMoment } from '../lib/momentShare';
import type { Round } from '../lib/types';
import { MomentCard } from './MomentCard';

/** The round's moments under its scorecard: one card at a time, biggest first, dots underneath. */
export function RoundMoments({ moments, round, baseline }: { moments: Moment[]; round: Round; baseline: [number, number][] }) {
  const [note, setNote] = useState('');
  const [at, setAt] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  if (!moments.length) return null;
  const share = (m: Moment) => shareMoment(m, round, baseline).catch((e) => setNote((e as Error).message));
  const goTo = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };
  return (
    <>
      <div className="moments-head">
        <h2>Moments</h2>
        <a href="#/moments" className="small">
          All your moments ›
        </a>
      </div>
      <div
        className="moments-row"
        ref={track}
        onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {moments.map((m) => (
          <MomentCard key={m.kind} m={m} onShare={() => void share(m)} />
        ))}
      </div>
      {moments.length > 1 && (
        <div className="moments-dots">
          {moments.map((m, i) => (
            <button key={m.kind} aria-label={`Moment ${i + 1} of ${moments.length}`} aria-current={i === at} onClick={() => goTo(i)}>
              <i />
            </button>
          ))}
        </div>
      )}
      {note && <p className="small neg">{note}</p>}
    </>
  );
}
