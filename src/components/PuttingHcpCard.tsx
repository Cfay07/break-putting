import { useMemo } from 'react';
import { hcpText, puttingHcp } from '../lib/puttingHcp';
import type { Round } from '../lib/types';

const LOW = -6;
const HIGH = 30;
const at = (h: number) => `${((h - LOW) / (HIGH - LOW)) * 100}%`;

export function PuttingHcpCard({ rounds, baseline }: { rounds: Round[]; baseline: [number, number][] }) {
  const h = useMemo(() => puttingHcp(rounds, baseline), [rounds, baseline]);
  const all = useMemo(() => puttingHcp(rounds, baseline, Infinity), [rounds, baseline]);
  if (!h || !all) return null;
  const more = all.rounds > h.rounds;

  return (
    <div className="hcp-card">
      <div className="hcp-head">
        <span className="pay-eyebrow">Putting handicap</span>
        <strong className="hcp-big num">{hcpText(h.hcp)}</strong>
      </div>
      <div className="hcp-scale" role="img" aria-label={`Putting handicap ${hcpText(h.hcp)}. Good days putt like a ${hcpText(h.good)}, bad days like a ${hcpText(h.bad)}.`}>
        <div className="hcp-track" />
        <div className="hcp-band" style={{ left: at(h.good), width: `calc(${at(h.bad)} - ${at(h.good)})` }} />
        <i className="hcp-dot" style={{ left: at(h.hcp) }} />
        <div className="hcp-ticks">
          {[-6, 0, 10, 20, 30].map((t) => (
            <span key={t} style={{ left: at(t) }}>{hcpText(t)}</span>
          ))}
        </div>
      </div>
      <div className="hcp-days">
        <span>Good day <b className="num">{hcpText(h.good)}</b></span>
        <span>Bad day <b className="num">{hcpText(h.bad)}</b></span>
        {more && <span>All {all.rounds} <b className="num">{hcpText(all.hcp)}</b></span>}
      </div>
      <p className="pay-note">
        {more ? `Your last ${h.rounds} rounds` : `All ${h.rounds} rounds`} in this view. An estimate, not an official
        handicap. A good day is your rounds above your own average.
      </p>
    </div>
  );
}
