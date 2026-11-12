import { useMemo } from 'react';
import { gameHcp } from '../lib/gameHcp';
import { hcpMove, hcpText, puttingHcp } from '../lib/puttingHcp';
import { useApp } from '../lib/store';
import type { Round } from '../lib/types';
import { useCourseRatings } from '../lib/useCourseRatings';

function Row({ label, m }: { label: string; m: ReturnType<typeof hcpMove> }) {
  if (!m) return null;
  const after = hcpText(m.after.hcp);
  const before = m.before ? hcpText(m.before.hcp) : null;
  return (
    <div className="stat-row">
      <span className="k">{label}</span>
      <span className="v num">{before && before !== after ? `${before} → ${after}` : after}</span>
    </div>
  );
}

export function RoundHcp({ round }: { round: Round }) {
  const { state } = useApp();
  const courses = useCourseRatings();
  const game = useMemo(
    () => hcpMove(state.rounds, round, (rs) => gameHcp(rs, courses, state.rounds, !!state.backTees)),
    [state.rounds, round, courses, state.backTees],
  );
  const putting = useMemo(
    () => hcpMove(state.rounds, round, (rs) => puttingHcp(rs, state.baseline)),
    [state.rounds, round, state.baseline],
  );
  return (
    <>
      <Row label="Plays to" m={game} />
      <Row label="Putts to" m={putting} />
    </>
  );
}
