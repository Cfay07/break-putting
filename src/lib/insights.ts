import { pct, type Stats } from './stats';

export interface Insight {
  id: string;
  tone: 'warn' | 'good';
  title: string;
  detail: string;
  drill: string;
}

const MIN_SIDE_SAMPLE = 6;

export function insights(s: Stats): Insight[] {
  const out: Insight[] = [];
  const p = s.pattern;
  const sideTotal = p.high + p.low;
  const paceTotal = p.short + p.long;
  const scoringPct = pct(s.scoring);
  const lagPct = s.lagAttempts ? (s.lagInside / s.lagAttempts) * 100 : null;
  const oneRound = new Set(s.threePuttHoles).size === s.threePuttHoles.length;

  if (s.threePlus >= 2) {
    out.push({
      id: 'three-putts',
      tone: 'warn',
      title: 'Kill the three-putts',
      detail: `${s.threePlus} three-putts${
        oneRound && s.threePuttHoles.length ? ` (holes ${s.threePuttHoles.join(', ')})` : ''
      }. That is where your putting strokes are going.`,
      drill: 'Ladder drill: one ball each to 20, 30, 40 feet. Every leave has to finish inside a tenth of the putt before you move on.',
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

  if (sideTotal >= MIN_SIDE_SAMPLE && p.high / sideTotal >= 0.6) {
    out.push({
      id: 'high-bias',
      tone: 'warn',
      title: 'You are missing on the high side',
      detail: `${p.high} of ${sideTotal} break-side misses went high. You are playing too much break or rolling it too soft.`,
      drill: 'Gate drill from 6 feet: two tees a putterhead apart, play half the break you read, hit it firm enough to take the last foot out.',
    });
  } else if (sideTotal >= MIN_SIDE_SAMPLE && p.low / sideTotal >= 0.6) {
    out.push({
      id: 'low-bias',
      tone: 'warn',
      title: 'You are missing on the low side',
      detail: `${p.low} of ${sideTotal} break-side misses went low. You are under-reading the break or starting it inside your line.`,
      drill: 'Pick an apex point, put a tee there, and roll ten putts over the tee from 8 feet. Read more break than feels right.',
    });
  }

  if (paceTotal >= MIN_SIDE_SAMPLE && p.short / paceTotal >= 0.6) {
    out.push({
      id: 'short-bias',
      tone: 'warn',
      title: 'You are leaving lag putts short',
      detail: `${p.short} of ${paceTotal} pace misses came up short. A putt that never reaches never breaks in.`,
      drill: 'Roll every putt over 20 feet with the intent of finishing 12 to 18 inches past. Ten in a row past the hole, no exceptions.',
    });
  } else if (paceTotal >= MIN_SIDE_SAMPLE && p.long / paceTotal >= 0.6) {
    out.push({
      id: 'long-bias',
      tone: 'warn',
      title: 'You are running putts past',
      detail: `${p.long} of ${paceTotal} pace misses ran long. That is where comebackers and three-putts come from.`,
      drill: 'Die-it drill: from 25 feet, hit ten putts trying to stop the ball in a 2-foot zone just past the hole.',
    });
  }

  if (scoringPct !== null && s.scoring.attempts >= 4 && scoringPct < 50) {
    out.push({
      id: 'scoring-range',
      tone: 'warn',
      title: 'Short putts are costing you',
      detail: `${s.scoring.makes} of ${s.scoring.attempts} from 3 to 10 feet (${scoringPct.toFixed(0)}%), which cost ${Math.abs(s.scoring.sg).toFixed(1)} strokes. This is the range that decides your score.`,
      drill: 'Circle drill: eight balls at 4 feet around the hole. Make all eight or start over.',
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

  if (out.length < 5) {
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

  return out.slice(0, 5);
}
