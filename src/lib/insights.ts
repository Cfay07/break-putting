import { pct, readBias, type Stats } from './stats';

export interface Insight {
  id: string;
  tone: 'warn' | 'good';
  title: string;
  detail: string;
  drill: string;
}

export interface InsightContext {
  rounds?: number;
  /**
   * Already on an eighteen-hole footing, so a season of nine-hole rounds is not quoted at half
   * value. Comes straight from the Averages card, which keeps the two agreeing.
   */
  threePuttsPerRound?: number | null;
  /** Rounds carrying at least one tagged miss, so a read is not called off one day's greens. */
  taggedRounds?: number;
}

const MIN_PACE_SAMPLE = 6;

/** Three cards. Any more and nothing on the list feels like the thing to go work on. */
const MAX_CARDS = 3;

export function insights(s: Stats, ctx: InsightContext | number = {}): Insight[] {
  const { rounds = 1, threePuttsPerRound = null, taggedRounds = 1 } =
    typeof ctx === 'number' ? { rounds: ctx } : ctx;
  const out: Insight[] = [];
  const p = s.pattern;
  const paceTotal = p.short + p.long;
  const scoringPct = pct(s.scoring);
  const lagPct = s.lagAttempts ? (s.lagInside / s.lagAttempts) * 100 : null;
  const oneRound = rounds === 1;
  const over = oneRound ? 'this round' : `across ${rounds} rounds`;

  if (s.threePlus >= 2) {
    const rate =
      !oneRound && threePuttsPerRound !== null ? `, ${threePuttsPerRound.toFixed(1)} a round` : '';
    out.push({
      id: 'three-putts',
      tone: 'warn',
      title: 'Kill the three-putts',
      detail: `${s.threePlus} three-putts${
        oneRound && s.threePuttHoles.length ? ` (holes ${s.threePuttHoles.join(', ')})` : ''
      }${rate}. That is where your putting strokes are going.`,
      drill: 'Ladder drill: one ball each to 20, 30, 40 feet. Every leave has to finish inside a tenth of the putt before you move on.',
    });
  }

  if (scoringPct !== null && s.scoring.attempts >= 4 && scoringPct < 50) {
    out.push({
      id: 'scoring-range',
      tone: 'warn',
      title: 'Short putts are costing you',
      detail: `${s.scoring.makes} of ${s.scoring.attempts} from 3 to 10 feet (${scoringPct.toFixed(
        0,
      )}%), which cost ${Math.abs(s.scoring.sg).toFixed(1)} strokes ${over}. This is the range that decides your score.`,
      drill: 'Circle drill: eight balls at 4 feet around the hole. Make all eight or start over.',
    });
  }

  if (lagPct !== null && s.lagAttempts >= 3 && lagPct < 50) {
    out.push({
      id: 'lag-leaves',
      tone: 'warn',
      title: 'Your long putts are leaving too much',
      detail: `${s.lagInside} of ${s.lagAttempts} putts from outside ${30} feet finished inside a tenth of the putt. Your average leave ran ${s.avgLeavePct?.toFixed(0)}% of the distance.`,
      drill: 'Ladder from 30, 40, 50 and 60 feet with a tenth of the putt as the target: 3 feet from 30, 6 feet from 60. Three in a row at each station before you move back.',
    });
  }

  // Same gate the Miss patterns panel uses, so the two cannot contradict each other on the page.
  const bias = readBias(p, taggedRounds);
  if ((bias.verdict === 'read' || bias.verdict === 'leaning') && bias.side) {
    const sided = p.high + p.low;
    const high = bias.side === 'high';
    const hedge =
      bias.verdict === 'leaning'
        ? ` That is only ${bias.rounds} round${bias.rounds === 1 ? '' : 's'} of tagging, so treat it as a lead rather than a verdict.`
        : ` That holds across ${bias.rounds} rounds, so it is the read, not the day.`;
    out.push({
      id: high ? 'high-bias' : 'low-bias',
      tone: 'warn',
      title: `You are missing on the ${bias.side} side`,
      detail: `${high ? p.high : p.low} of ${sided} break-side misses went ${bias.side}. ${
        high
          ? 'You are playing too much break or rolling it too soft.'
          : 'You are under-reading the break or starting it inside your line.'
      }${hedge}`,
      drill: high
        ? 'Gate drill from 6 feet: two tees a putterhead apart, play half the break you read, hit it firm enough to take the last foot out.'
        : 'Pick an apex point, put a tee there, and roll ten putts over the tee from 8 feet. Read more break than feels right.',
    });
  }

  if (paceTotal >= MIN_PACE_SAMPLE && p.short / paceTotal >= 0.6) {
    out.push({
      id: 'short-bias',
      tone: 'warn',
      title: 'You are leaving lag putts short',
      detail: `${p.short} of ${paceTotal} pace misses came up short. A putt that never reaches never breaks in.`,
      drill: 'Roll every putt over 20 feet with the intent of finishing 12 to 18 inches past. Ten in a row past the hole, no exceptions.',
    });
  } else if (paceTotal >= MIN_PACE_SAMPLE && p.long / paceTotal >= 0.6) {
    out.push({
      id: 'long-bias',
      tone: 'warn',
      title: 'You are running putts past',
      detail: `${p.long} of ${paceTotal} pace misses ran long. That is where comebackers and three-putts come from.`,
      drill: 'Die-it drill: from 25 feet, hit ten putts trying to stop the ball in a 2-foot zone just past the hole.',
    });
  }

  if (p.lip >= 3) {
    out.push({
      id: 'lips',
      tone: 'warn',
      title: `${p.lip} lip-outs is a speed problem`,
      detail: 'Putts that catch the edge and stay out were almost always a fraction too slow or too quick, not a bad read.',
      drill: 'From 8 feet, pick the speed that would leave the ball 14 inches past. Roll fifteen and watch how many more take the lip.',
    });
  }

  if (out.length < MAX_CARDS) {
    if (scoringPct !== null && s.scoring.attempts >= 4 && scoringPct >= 60) {
      out.push({
        id: 'good-scoring',
        tone: 'good',
        title: 'Scoring range is holding up',
        detail: `${s.scoring.makes} of ${s.scoring.attempts} from 3 to 10 feet (${scoringPct.toFixed(0)}%). Keep that and the score follows.`,
        drill: 'Keep the circle drill in your warm-up so it stays there.',
      });
    } else if (lagPct !== null && s.lagAttempts >= 3 && lagPct >= 60) {
      out.push({
        id: 'good-lag',
        tone: 'good',
        title: 'Lag putting is holding up',
        detail: `${s.lagInside} of ${s.lagAttempts} from outside 30 feet finished inside a tenth of the putt, averaging ${s.avgLeave?.toFixed(1)} feet.`,
        drill: 'Nothing to fix here. Spend the practice time inside 8 feet.',
      });
    } else if (s.threePlus === 0 && s.holesPlayed >= 9) {
      out.push({
        id: 'no-three-putts',
        tone: 'good',
        title: 'Zero three-putts',
        detail: `${s.holesPlayed} holes without a three-putt. Speed control did its job.`,
        drill: 'Keep the ladder drill in the routine so it stays clean.',
      });
    }
  }

  return out.slice(0, MAX_CARDS);
}
