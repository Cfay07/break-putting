import { useMemo, useState } from "react";
import { fmtDate } from "../lib/format";
import { gameHcp, unrated } from "../lib/gameHcp";
import {
  HCP_WINDOW,
  hcpText,
  puttingHcp,
  type HcpRound,
} from "../lib/puttingHcp";
import type { Round, SavedCourse } from "../lib/types";

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

const HOW = {
  putting:
    "each round's strokes gained putting against tour pros becomes a number on the handicap scale. Tour putting is +6.0, and every stroke a round you lose to tour adds 6.0.",
  game: "each round is (113 / slope) x (score minus course rating), off the tee you played.",
};

interface Props {
  rounds: Round[];
  courses: SavedCourse[];
  baseline: [number, number][];
  shoot: number;
  withTour: number;
  scoredRounds: number;
}

export function StandCard({
  rounds,
  courses,
  baseline,
  shoot,
  withTour,
  scoredRounds,
}: Props) {
  const putting = useMemo(
    () => puttingHcp(rounds, baseline),
    [rounds, baseline],
  );
  const game = useMemo(() => gameHcp(rounds, courses), [rounds, courses]);
  const missing = useMemo(() => unrated(rounds, courses), [rounds, courses]);
  const [view, setView] = useState<"putting" | "game">("putting");
  const shown = view === "game" && game ? game : putting;
  const kind = view === "game" && game ? "game" : "putting";
  const counting =
    shown?.rounds
      .filter((r) => r.counts)
      .sort((a, b) => a.hcp - b.hcp || b.date.localeCompare(a.date)) ?? [];
  const rest = shown ? shown.rounds.length - counting.length : 0;
  const gap = putting && game ? game.hcp - putting.hcp : null;

  return (
    <div className="hcp-card light">
      <div className="stand-grid">
        <div>
          <span className="pay-eyebrow">You shoot</span>
          <strong className="num">{shoot.toFixed(1)}</strong>
        </div>
        <div>
          <span className="pay-eyebrow">With tour putting</span>
          <strong className="num">{withTour.toFixed(1)}</strong>
        </div>
        <div>
          <span className="pay-eyebrow">Plays to</span>
          <strong className="num">{game ? hcpText(game.hcp) : "–"}</strong>
        </div>
        <div>
          <span className="pay-eyebrow">Putts to</span>
          <strong className="num">
            {putting ? hcpText(putting.hcp) : "–"}
          </strong>
        </div>
      </div>

      <p className="hcp-how">
        {shoot > withTour
          ? `A tour pro's putter would save you ${(shoot - withTour).toFixed(1)} a round. `
          : `You putt better than tour, by ${(withTour - shoot).toFixed(1)} a round. `}
        {gap !== null &&
          (Math.abs(gap) < 0.5
            ? "Your putting is right in line with the rest of your game."
            : `Your putting plays ${Math.abs(gap).toFixed(1)} ${gap > 0 ? "better" : "worse"} than your game.`)}
        {!game && " Plays to needs five rounds on a rated tee."}
      </p>

      {(putting || game) && (
        <div
          className="hcp-line2"
          role="img"
          aria-label={`Plays to ${game ? hcpText(game.hcp) : "not yet"}, putts to ${putting ? hcpText(putting.hcp) : "not yet"}`}
        >
          <span className="hcp-track">
            {game && (
              <i className="hcp-dot game" style={{ left: at(game.hcp) }} />
            )}
            {putting && (
              <i className="hcp-dot" style={{ left: at(putting.hcp) }} />
            )}
          </span>
          <span className="hcp-axis2">
            {MARKS.map(([v, label]) => (
              <span key={v} className="hcp-mark" style={{ left: at(v) }}>
                {label}
              </span>
            ))}
          </span>
          <span className="hcp-key">
            <i className="game" /> Plays to <i /> Putts to
          </span>
        </div>
      )}

      {shown && (
        <>
          {game && putting && (
            <div className="seg hcp-seg">
              <button
                aria-pressed={kind === "putting"}
                onClick={() => setView("putting")}
              >
                Putting rounds
              </button>
              <button
                aria-pressed={kind === "game"}
                onClick={() => setView("game")}
              >
                Scoring rounds
              </button>
            </div>
          )}
          <div className="hcp-chart">
            {counting.map((r) => (
              <Lane
                key={r.id}
                r={r}
                you={shown.hcp}
                out={r.id === shown.nextOut?.id}
              />
            ))}
          </div>
          <p className="pay-note">
            Your best {shown.counting} of your last {shown.rounds.length}, shown
            above.
            {rest > 0 && ` The other ${rest} were worse and don't count.`}
            {shown.nextOut &&
              !shown.nextOut.counts &&
              ` ${fmtDate(shown.nextOut.date)} is the next round out.`}
            {kind === "game" &&
              missing > 0 &&
              ` ${missing} rounds have no rated tee, so they can't count.`}
          </p>
          <p className="pay-note">
            How it works: {HOW[kind]}{" "}
            {kind === "game" ? "Plays to" : "Putts to"} is the average of your
            best 4 of your last {HCP_WINDOW} rounds, or your best third until
            you have {HCP_WINDOW}. Two nine-hole rounds make one 9+9. Scoring
            average over {scoredRounds} rounds. Not an official handicap.
          </p>
        </>
      )}
    </div>
  );
}
