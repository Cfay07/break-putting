import { useMemo } from 'react';
import { scopeRounds } from '../lib/practice';
import { hcpText, puttingHcp } from '../lib/puttingHcp';
import { fmtDate } from '../lib/format';
import { useApp } from '../lib/store';

const LOW = -6;
const HIGH = 30;
const at = (h: number) => `${((h - LOW) / (HIGH - LOW)) * 100}%`;

export function PuttingHcpCard() {
  const { state } = useApp();
  const putter = state.putters.find((p) => p.active);
  const scoped = useMemo(() => scopeRounds(state.rounds, putter?.id), [state.rounds, putter?.id]);
  const h = useMemo(() => puttingHcp(scoped.rounds, state.baseline), [scoped.rounds, state.baseline]);
  if (!h) return null;

  return (
    <div className="hcp-card">
      <div className="hcp-head">
        <span className="pay-eyebrow">Putting handicap</span>
        <strong className="hcp-big num">{hcpText(h.hcp)}</strong>
      </div>
      <div className="hcp-scale" role="img" aria-label={`Putting handicap ${hcpText(h.hcp)}. Most rounds putt like a ${hcpText(h.good)} to a ${hcpText(h.bad)}.`}>
        {h.each.map((r, i) => (
          <i key={r.id} className={i === 0 ? 'hcp-tab out' : 'hcp-tab'} style={{ left: at(r.hcp) }} />
        ))}
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
      </div>
      <p className="hcp-legend">
        Each tab is a round. The hollow one, {fmtDate(h.each[0].date)}, drops out next.
      </p>
      <p className="pay-note">
        Average of your last {h.rounds} rounds{scoped.putterOnly && putter ? ` with the ${putter.name}` : ''}. An estimate, not an
        official handicap. A good day is your rounds above your own average.
      </p>
    </div>
  );
}
