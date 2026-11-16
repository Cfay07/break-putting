import { bleedSummary } from './bleed';
import { fitMakeModel, makeability } from './makeability';
import { liveProjection } from './projection';
import { overall } from './stats';
import { holeVsPar, holedOut, type AppState } from './types';

/**
 * What this player shares with their teams. Only these numbers leave the device; the rounds
 * themselves stay owner-only in the database.
 */
export function summarise(state: AppState) {
  const done = state.rounds.filter((r) => r.finished);
  const o = overall(done, state.baseline);
  const model = fitMakeModel(done);
  const live = state.rounds.find((r) => !r.finished);
  const played = live ? live.holes.filter((h) => h.putts.length > 0).length : 0;
  return {
    rounds: done.length,
    competitive_rounds: done.filter((r) => r.competitive).length,
    putts_pr: o.puttsPerRound,
    three_pr: o.threePuttsPerRound,
    sg_pr: o.sgPerRound,
    make6: makeability(model, 6),
    bleed_pr: bleedSummary(done).shotsPerRound,
    bounce_back: bleedSummary(done).afterRate,
    scoring_pct: o.scoringPct !== null ? o.scoringPct / 100 : null,
    last_round: done.length ? done.reduce((a, b) => (b.date > a.date ? b : a)).date : null,
    live:
      live && played
        ? {
            hole: Math.max(...live.holes.filter((h) => h.putts.length).map((h) => h.hole)),
            thru: played,
            course: live.course,
            started_at: live.updated ?? new Date().toISOString(),
            putts: live.holes.reduce((n, h) => n + h.putts.length, 0),
            to_par: live.holes.some((h) => holeVsPar(h) !== undefined)
              ? live.holes.reduce((n, h) => n + (holeVsPar(h) ?? 0), 0)
              : null,
            // Teammates only: the player's own phone never shows it, so it cannot get in their head.
            proj: liveProjection(live, done),
            // Hole by hole so far, in the same shape a finished round shares, so a teammate can follow along.
            holes: live.holes
              .filter((h) => h.putts.length > 0 || holedOut(h))
              .map((h) => ({ h: h.hole, p: h.putts.length, d: h.putts[0]?.d ?? null, v: holeVsPar(h) ?? null })),
          }
        : null,
  };
}
