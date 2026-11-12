import { useMemo } from 'react';
import { hcpMove, hcpText } from '../lib/puttingHcp';
import { useApp } from '../lib/store';
import type { Round } from '../lib/types';

export function RoundHcp({ round }: { round: Round }) {
  const { state } = useApp();
  const m = useMemo(() => hcpMove(state.rounds, round, state.baseline), [state.rounds, round, state.baseline]);
  if (!m) return null;
  const after = hcpText(m.after.hcp);
  const before = m.before ? hcpText(m.before.hcp) : null;
  return (
    <div className="stat-row">
      <span className="k">Putting handicap</span>
      <span className="v num">{before && before !== after ? `${before} → ${after}` : after}</span>
    </div>
  );
}
