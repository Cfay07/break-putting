import { useState } from 'react';
import type { Moment } from '../lib/moments';
import { shareMoment } from '../lib/momentShare';
import type { Round } from '../lib/types';
import { MomentCard } from './MomentCard';

/** The round's moments under its scorecard, rarest first, swiped sideways. */
export function RoundMoments({ moments, round, baseline }: { moments: Moment[]; round: Round; baseline: [number, number][] }) {
  const [note, setNote] = useState('');
  if (!moments.length) return null;
  const share = (m: Moment) =>
    shareMoment(m, round, baseline).catch((e) => setNote((e as Error).message));
  return (
    <>
      <div className="moments-head">
        <h2>Moments</h2>
        <a href="#/moments" className="small">
          All your moments ›
        </a>
      </div>
      <div className="moments-row">
        {moments.map((m, i) => (
          <MomentCard key={m.kind} m={m} dark={i === 0 && !m.low} onShare={() => void share(m)} />
        ))}
      </div>
      {note && <p className="small neg">{note}</p>}
    </>
  );
}
