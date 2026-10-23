# Form: a per-round score for how you putted, not how the ball behaved

Design. Updated 2026-10-23. Nothing here is built yet.

## Why

Strokes gained only sees where the ball finished. It cannot tell a pure stroke on a good read
that lipped out from a toe-shank that went in off the flagstick: both are one putt from the same
distance.

From Conor's own round on 2026-10-22, tagged putt by putt:

| Hole | Putt | What he did | SG |
|---|---|---|---|
| 5 | 5 ft, made | struck it out the **toe** | **+0.23** |
| 16 | 4 ft, made | struck it out the **toe** | **+0.13** |
| 1 | 54 ft | under-read by 2 notches, left it short | **+0.04** |
| 2 | 14 ft, missed | read right, centre strike, just short | **−0.25** |
| 8 | 15 ft, missed | read right, centre strike, just short | **−0.22** |

Strokes gained pays him for two toe strikes that got away with it and docks him half a shot
across two putts he struck properly. That gap is the whole reason this exists.

Conor's words: "how well you hit it on the center how well you read it everything into one
metric because strokes gained doesn't cover."

Strokes gained itself does not change. Not its formula, not its baseline, not its placement.

## The name

**Form.** Neutral, sports-native, and exactly the right idea: form is how you are striking it,
independent of results. "His form was a 3" is ordinary speech and carries no verdict.

"Pure" was the working name and Conor killed it correctly: pure means *good* in golf, so the
label fights the number on every bad round. `PURE 0.2` reads as a contradiction. A label must
name the measurement, never carry a verdict, the same way SCORE works because a score can be 68
or 88. Roll was the runner-up and was rejected for leaning positive the same way Pure does.

## What it is

A 0 to 10 score with one decimal, per round, built from two layers.

**The outcome layer** comes from strokes gained. Every round has it.

**The process layer** comes from the tags: read, strike, start line, pace, and **lip-outs**. A
lipped putt is the clearest case in the game of doing everything right and not being paid for it,
so Form should credit it where strokes gained cannot. 28 are already tagged.

Rounds with enough tagged putts show both; rounds without show the outcome layer alone, at
reduced opacity, so the two are never mistaken for the same measurement. Conor's call: a rating
appears on **every** card, "even its thinner."

## Where it goes on the round card

Settled by mockup against the real card, tested at 375px with the worst case (competitive round,
blood drop, longest putter name). No overflow.

```
┌─┬──────────────────────────────────────────────┐
│ │ Oct 13  🏆                   🩸3  COBRA       │
│ │ Flossmoor Country Club                        │
│ │ PUTTS  3-PUTTS   SG     SCORE        FORM     │
│ │ 33     2        -4.19   81            5.6     │
└─┴──────────────────────────────────────────────┘
  ^ left rail, Form band colour
```

- **Left rail**, 5px, full card height, in the vibrant band colour. Faded when untagged.
- **🏆 next to the date** for a competitive round. This *replaces* the existing
  `.round-row.comp` inset rail, which currently occupies the left edge on 17 of Conor's 26
  rounds and would collide. A trophy also needs no learning where a dark rail did.
- **🩸 stays grouped with the putter pill** on the right, as it is today.
- **FORM in the metrics row**, right-aligned, after Score, in the band's dark text variant.

Rejected: a badge beside the course name. The head strip already carries date, trophy, drop and
putter tag; a badge would be the fifth thing fighting for it, and it cannot show a season's shape
the way a rail column can when you scroll the list.

## The colour ramp

Five bands, red through green, exactly as Conor specified. **Two tones per band**, because the
rail and the number have different contrast problems: nothing sits on the rail, so it can be
vibrant, while the number is coloured text on cream and must clear 4.5:1.

| Form | Band | Rail | Number | Number contrast |
|---|---|---|---|---|
| 8.0 – 10 | Green | `#1f7a4d` | `#1f7a4d` | 5.05 |
| 6.0 – 7.9 | Yellow-green | `#93bb2e` | `#5a7016` | 5.30 |
| 4.0 – 5.9 | Amber | `#e0a526` | `#8a6208` | 5.21 |
| 2.0 – 3.9 | Orange-red | `#b0431a` | `#b0431a` | 5.44 |
| 0 – 1.9 | Red | `#a52a1f` | `#a52a1f` | 6.76 |

Measure, do not eyeball. Three separate colour faults were caught only by running the numbers:
`#c0531f` and `#7a9b24` cleared neither white nor dark text; `#b5603a` failed white text at
4.24:1; and the vibrant yellow-green and amber scored **2.12** and **2.08** as text on the card,
less than half the minimum.

**Do not try to avoid the putter brand colours.** Every candidate was measured against all
fourteen in `BRAND_PILLS` and every one lands near one of them: green sits 7 from Cleveland/
Srixon, red 12 from Wilson and 13 from Scotty, amber near TaylorMade and Bettinardi. With
fourteen brands across the spectrum there is no free space. Separation comes from form instead:
the putter tag is a capsule holding a word, the rail is an edge, and they are never confused.

## Where Form is explained

A number nobody can interrogate is a number nobody trusts, and today the design says nothing
about this. Three places, in order of importance.

**The round page.** Open a round and Form breaks into what built it: how many reads were right,
how many strikes caught the middle, how many putts started on line, how the pace ran. The
components, not just the total. This is the answer to "why was I a 5.6 on Monday".

**The Stats page.** A Form panel alongside the others, carrying the season average, the spread,
and the trend over time. Subject to the same scope filter as everything else, so Form splits by
putter, by green speed, by competitive, exactly like strokes gained does now.

**The explainer: a Venn of Form against strokes gained.** Two overlapping circles, populated
from real putts rather than drawn as decoration.

- **Overlap:** putts where both agree. A pure stroke that drops, a hacked one that does not.
- **Strokes gained only:** the ones you got away with. From 2026-10-22, hole 5 and hole 16, both
  made from inside 5 feet off the toe. SG pays +0.23 and +0.13; Form does not.
- **Form only:** the ones you deserved. Hole 2 and hole 8, read right and struck in the middle,
  both just short. SG docks −0.25 and −0.22; Form rewards them.

That graphic *is* the pitch for why the app carries two numbers instead of one, and it should
use the player's own putts, not invented examples, so it argues from their round rather than
from theory.


## Keep it contained

This touches a lot of files if built as one lump. It should not be built as one lump. Three
separate ships, smallest first, each useful on its own and each revertable without touching the
others.

**1. `accel` alone.** Five files, no new concepts, nothing depends on it. Ship and forget.

**2. The complete misread alone.** This is the risky one, because it changes `readError`'s
output shape and three consumers read that. Ship it by itself so if something breaks, it is
obvious what broke.

**3. Form.** One new file, `src/lib/form.ts`, holding the entire calculation and exporting a
single number plus its components. Nothing else does arithmetic. The card change is then one
rail element, one metric column, and swapping the competitive rail for a trophy. The round page
and Stats page each render the components they are handed.

The rule that keeps it clean: **no Form arithmetic outside `form.ts`.** If a component is doing
sums, it is in the wrong place.


## Goals

- One number per round for "did I putt well", readable at a glance.
- Rewards process, so a round of pure strokes that did not drop still scores well.
- Degrades honestly when there are no tags rather than faking it or disappearing.

## Non-goals

- Replacing strokes gained anywhere.
- Predicting score, or saying anything about approach play.
- Comparing players. Per-player, per-round.

## Anti-goals

- **Any change to strokes gained.** Hard line.
- **Conditions moving the number.** Conor, asked directly: "No i dont want numbers skewed... i
  want 100% accuracy." Green speed, bumpiness and aeration stay labels on the round and feed
  nothing. `Conditions.tsx` already tells the user "Kept with the round and never scored against
  it" and that stays true.
- **A self-referential scale.** Calibrating to the player's own history parks the number at the
  middle forever. The same trap killed a self-derived baseline earlier in this project.
- **A label that carries a verdict.** See the naming section.
- **Re-counting the outcome.** Expected putts, makes above expected, three-putt rate, lag leave
  quality and make % by distance are all derived from where the ball stopped, so they are already
  the outcome layer. Expected putts in particular was deleted from this app in commit `a0dfd64`
  for correlating 0.905 with strokes gained; putting it back inside Form would be the same
  mistake wearing a hat. The test for any new input: does it say something the ball's final
  position cannot?

## Should anything else feed it

Checked against the filter (does it say something the ball's final position cannot) rather than
added because it sounds good.

**Added: lip-outs.** See above. Missing from the first draft and clearly belongs.

**Open question for the builder: distance weighting.** Right now every tagged putt would count
the same. A misread on a 50-footer and a misread on a 6-footer are not equally culpable, and
nor are they equally costly. Weighting each putt's process score by how makeable the putt was
would be more honest, and the app already has a learned makeability model to supply that.
Against it: it makes Form harder to explain, and the round page has to show why one putt counted
more than another. Decide this deliberately; do not let it happen by accident.

**Deliberately excluded: Drift.** It is genuinely additive information, which is why it exists
as its own stat, but it is a round-level pattern rather than a per-putt quality. Every putt in a
round can be struck well and still all miss the same side. Folding that into Form would produce
the question "why is my Form low when I struck every putt properly", which has no good answer.
Form stays per-putt quality averaged up. Drift stays the thing that catches systematic aim bias,
and on 2026-10-22 it had something to catch: all eight of his tagged misreads broke more than he
read them, eight out of eight, never once over-read.


## Constraints the builder must design around

### The process inputs barely exist

Measured against the live database, 771 finished putts:

| Field | Tagged |
|---|---|
| `readAs` | 25 |
| `strike` | 23 |
| `speed` (misses) | 141 of 358 |
| `push` / `pull` | 40 |
| `decel` | **1, ever** |

Almost all read and strike tagging happened on one day, 2026-10-22 (17 strikes, 18 reads).
Before that: 6 and 7 across his whole history. So the process layer must work from a handful of
putts in a single round, must never extrapolate across rounds, and cannot lean on `decel` or the
`accel` added below.

### Most makes cannot be tagged at all

Two structural limits, both verified:

- `Track.tsx:256` — a made putt under `BREAK_PROMPT_FROM = 4` dispatches `addPutt` directly and
  never enters the tags phase. Every tap-in carries nothing.
- `Track.tsx:361-362` — the factors chips are hidden on any made putt while tracking, so push,
  pull and decel are unreachable on makes during a round. Only `PuttEditor` offers them, after
  the fact.

Conor's decision: do not change the tracking flow. **Score process on misses and long makes
only.**

### Imported rounds are permanently outcome-only

`importer.ts` can only ever produce `missSide`, `speed`, `lip`, `push`, `pull`. No reads, no
strike, no break. Those rounds will always show the faded rail. That is correct, and it should be
said in the UI rather than left to look like a bug.

## Decided

Conor's decisions, as he made them:

- Per round. A rail and a number on **every** card, fainter when untagged.
- 0 to 10, one decimal. Rejected letter grades and word tiers after seeing all three on his own
  rounds: grades collapsed four of five rounds into B or B+, words gave three straight SOLIDs.
- Five colour bands, red through green.
- Trophy for competitive; blood drop stays with the putter pill.
- Conditions are labels and never scored.
- Process on misses and long makes only.
- **Make quality is out.** Asked whether to record how a holed putt went in (died in, good pace,
  rammed), he said leave it at made.
- The name is Form, not Pure.

Author's calls, overturnable:

- 10 means everything you controlled done right: read correct, struck in the middle, pace
  correct. Not "you holed everything", which is what strokes gained already measures.
- Course familiarity is out. Conor raised it then undercut it himself: Strawberry Creek is his
  home course and played nothing like usual on 2026-10-22, tagged medium against fast in
  September. Rounds played is a poor proxy for knowing the greens.
- Slope steepness is out. He has twice cut this class of field for being too much tapping.

## The two new fields

Both required before the rating can be built.

### `accel`

`FACTORS` is `['lip', 'push', 'pull', 'decel']`. Add `accel`. A jab and a quit are opposite
tempo faults that currently collapse into one.

Larger than it looks: `Putt` needs `accel?: boolean` or the `FACTORS.map` at `PuttEditor.tsx:166`
and `Track.tsx:363` fails to type-check; `Pattern` needs a counter to parallel `decel`
(`stats.ts:59, 141, 248`); and `PatternPanel.tsx:92` and `shareCard.ts:246` both hard-code the
decel row. Five files. Nothing stops a putt being tagged both.

### The complete misread

`readAs` and `brokeAs` are magnitude only, 1 to 4. **There is no way to record "I read it left to
right and it broke right to left."** To log it today you tag the break as R→L, and your read is
then stored as "I read slight R→L", which is a false record of what you saw. The largest read
error available is unrepresentable and is silently recorded as a small one.

A fifth stop on the existing two-tap curve scale fits the interaction. Whatever shape is chosen
drags three other things with it:

- `readError.ts:70-75` computes error as `brokeAs - readAs` and splits under-read from over-read
  on the sign. A complete misread is neither; it is off-axis, and `delta` cannot express it.
  Fixing this changes `readError`'s output shape.
- `ReadPanel.tsx:3` maps only 1-4 and falls through to printing a bare number.
- `readError.ts:77/88` keys bands on `brokeAs`, so a fifth value creates a phantom band.
- Consumers: `ReadPanel`, `Stats.tsx:149-155`, `RoundDetail.tsx:77`.

## The main open question

Mapping strokes gained per 18 onto 0 to 10. It must not be calibrated to the player's own
history, and it must not anchor everything to tour level, which would park every amateur at 1 out
of 10 forever.

Conor's observed range across 26 rounds is **−11.73 to +3.56** per 18, most between −9 and −1.
The mockups used `(sg18 + 12) / 14 × 10` clamped, which spread his real rounds across 0.2 to
10.0 and looked right, but it is a starting point and not a decision.

Note the figures in the seed files under `seed/` do **not** match the live database. The live
database is authoritative.

## Left to the builder

- The weighting between outcome and process when both are present.
- The calibration above.
- The minimum tagged putts before the process layer counts, and therefore before the rail shows
  at full opacity. Note the precedent: `makeability.ts:21` requires `MIN_TAGGED = 150` before a
  learned model may speak. Form is a single-round descriptive stat rather than a fitted model, so
  a much lower gate is defensible, but it should be argued rather than assumed.
- The interaction shape for the complete misread.
- Recompute on read rather than persisting: the baseline is user-editable and conditions are set
  after the round.
- What a finished round with zero putts shows. `statsForHoles` returns `sg: 0` there, which would
  otherwise paint a mid-table rail off no putting at all. It should show no rail.
- Whether Form travels to the team board and shared rounds. Both would need a server column and a
  migration. Not specified; assume no until asked.
