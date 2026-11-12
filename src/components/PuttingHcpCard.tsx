import { useMemo } from "react";
import { fmtDate } from "../lib/format";
import { hcpText, puttingHcp, type HcpRound } from "../lib/puttingHcp";
import type { Round } from "../lib/types";

const LOW = -6;
const HIGH = 30;
const at = (h: number) =>
  `${((Math.max(LOW, Math.min(HIGH, h)) - LOW) / (HIGH - LOW)) * 100}%`;
const MARKS: [number, string][] = [
  [-6, "+6"],
  [0, "0"],
  [10, "10"],
  [20, "20"],
  [30, "30+"],
];

function Lane({ r, you, out }: { r: HcpRound; you: number; out: boolean }) {
  return (
    <div className="hcp-lane">
      <span className="hcp-date">
        {fmtDate(r.date)}
        {r.nines && <small> 9+9</small>}
        {out && <em> next out</em>}
      </span>
      <span className="hcp-track">
        <i className="hcp-you" style={{ left: at(you) }} />
        <i className="hcp-pt" style={{ left: at(r.hcp) }} />
      </span>
      <b className="num">{hcpText(r.hcp)}</b>
    </div>
  );
}

export function PuttingHcpCard({
  rounds,
  baseline,
}: {
  rounds: Round[];
  baseline: [number, number][];
}) {
  const h = useMemo(() => puttingHcp(rounds, baseline), [rounds, baseline]);
  if (!h) return null;
  const counting = h.rounds
    .filter((r) => r.counts)
    .sort((a, b) => a.hcp - b.hcp || b.date.localeCompare(a.date));
  const rest = h.rounds.length - counting.length;

  return (
    <div className="hcp-card">
      <div className="hcp-head">
        <span className="pay-eyebrow">Putting handicap</span>
        <strong className="hcp-big num">{hcpText(h.hcp)}</strong>
      </div>
      <p className="hcp-how">
        Best {h.counting} of your last {h.rounds.length} rounds, like a real
        handicap.
      </p>
      <div className="hcp-chart">
        {counting.map((r) => (
          <Lane key={r.id} r={r} you={h.hcp} out={r.id === h.nextOut?.id} />
        ))}
        <div className="hcp-lane hcp-axis">
          <span />
          <span className="hcp-track">
            {MARKS.map(([v, label]) => (
              <span key={v} className="hcp-mark" style={{ left: at(v) }}>
                {label}
              </span>
            ))}
          </span>
          <span />
        </div>
      </div>
      {(rest > 0 || h.nextOut) && (
        <p className="pay-note">
          {rest > 0 && `The other ${rest} putted worse and don't count. `}
          {h.nextOut &&
            !h.nextOut.counts &&
            `${fmtDate(h.nextOut.date)} is the next round out. `}
        </p>
      )}
      <p className="pay-note">
        How it works: each round's strokes gained against tour pros becomes a
        handicap. Tour putting is +6.0, and every stroke a round you lose to
        tour adds 6.0. Your handicap is the average of your best {h.counting} of
        your last {h.rounds.length}. Two nine-hole rounds make one 9+9. An
        estimate, not an official handicap.
      </p>
    </div>
  );
}
