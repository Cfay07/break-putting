# BREAK! roadmap

Written 2026-10-25. Conor's two goals, in his words: **100% consistency and honesty about the
stats, accurate with ourselves and our data**, and **easy to use and good to look at**.

Update this file as phases land. An exit condition that is not met is not met, however much
work went in.

## Where it actually stands, 2026-10-29

Written after a long build session. Phases are marked by their own exit conditions, not by effort
spent on them.

| Phase | Exit condition | State |
|---|---|---|
| 1 · Tagging economics | Closed on evidence | **Closed** |
| 2 · One sufficiency standard | No number renders without saying what it stands on | **Closed** |
| 3 · Navigation, not deletion | Any stat in one tap, nothing removed | **Closed** |
| 4 · Form's trial | Form proven or gone | **Open, data-gated** |
| 5 · Baseline provenance | Every number traces to something citable | **Open, blocked** |
| 6 · A second player | One finding confirmed on somebody else | **Open, data-gated** |
| 7 · Form as a player rating | xP shipped, xPOT gated | **Half shipped** |

### Phase 2, closed 2026-10-29
Gating enforces itself rather than only displaying. `MIN_TERM` stops the model using an
undersampled shape rather than only hiding it from the learned panel. `makeChanceOf` returns
nothing past the longest putt ever hit, because a logistic in ln(distance) will answer for any
number you hand it. `xpotStatus` refuses with the reason in the same place it refuses. The verdict
tally explains its own zeros, and `fitExecModel` refuses outright when the fault variable is
standing in for the outcome, which is not a sample-size gate and no amount of tagging the same way
would fix.

Audited component by component: every one that renders a rate also carries a count. The last gap
was the miss-shapes rows, which showed a share with the count sitting unused one line above.

### Phase 4, why it cannot be closed by writing code
`formTrial` runs on every load and prints its own verdict against thresholds fixed before the
answer was known: under 0.90 Form stays, over 0.95 it goes, between them the blend gets one
reweighting. It needs ten rounds whose process layer unlocked and has three. The task is no longer
"remember to check"; it is "play more tagged rounds".

### Phase 5, why fitting the baseline is not the fix
The obvious move is to fit `DEFAULT_BASELINE` to the player's own putts. It is wrong. Strokes
gained measures you against a reference, so a self-fitted baseline makes it zero by construction.
Measured: his putts-to-finish run 0.12 to 0.47 above the current table at every distance, which is
what losing strokes putting *means*. The table is doing its job; it just cannot be cited. This
needs a published source, and inventing numbers that look published would be the exact dishonesty
the phase exists to prevent.

### Phase 6, the reason it matters more than it looks
Two separate findings this session turned out to be tagging habits wearing the clothes of results.
Stage two had no intercept, so "putts worth tagging convert better" leaked into the break
coefficients and made every shape look easier. And faults were impossible to record on a holed
putt, so "has a fault" was standing in for "missed". Both were invisible until the data was
checked against itself. One user cannot tell a finding from a habit, which is the whole argument
for this phase.

---

## The diagnosis everything follows from

**The app has more metrics than data.** Twenty stats on the Stats page, one player, 27 rounds.
Reads on 43 putts of 805, strike on 41, tempo on 5. Several stats are built, shipped, and
structurally unable to say anything yet.

Most of what looks like a bug traces back to that: Form correlating 0.999 with strokes gained,
conditions splits that never draw, a Stakes row standing on 12 putts.

---

## Phase 1 · CLOSED, on the evidence

Opened as "tagging costs too many taps". The evidence says it does not, and the phase was built
on a bad denominator.

The alarming figures (read 9%, strike 9%, tempo 1.3%) divided by **all** putts, including every
putt in rounds where nothing was tagged. Measured instead on the 63 misses where Conor was
clearly tagging, the optional fault chips are used at normal rates:

| Chip | Used while tagging |
|---|---|
| Push / pull | 12.7% |
| Decel / accel | **9.5%** |
| Lip-out | 11.1% |

Tempo is used as often as push and pull. It stays. It was nearly deleted on the strength of a
ratio that made a sometimes-true fault look like an untouched control.

**The real shape of the gap:** on 2026-10-22 Conor tagged 19 of 31 putts, 61%, which already
clears the exit condition. Across all rounds it is 5%, because most rounds carry no tags at all.
Tagging is all-or-nothing per round, so this is a habit question rather than a UI one, and no
amount of tap-shaving addresses it.

Two things stay ruled out and are not to be revisited without new evidence: **a second grid
beside the miss grid** (Conor, twice: it reads as a near-copy of a different question) and
**deleting tempo**.

The honest floor for one putt is four taps: two for distance, one for made or missed, one to
save. The save is a confirm, not overhead.

## Phase 2 · One standard for "do we know this yet"

This is goal 1 made real, and it is the thing that could make the app distinctive.

Today there are **ten different sufficiency gates** with ten names and thresholds from 2 to 150,
and **two of them are both called `MIN_TAGGED`** meaning different things (6 putts in a round in
`form.ts`, 150 putts total in `makeability.ts`).

- One gate concept, one name, applied everywhere
- Every number carries its sample size next to it, not in a footnote
- Three states, visually distinct: enough to trust, suggestive, not yet
- A stat that cannot speak says so, rather than printing a confident percentage off 12 putts

**Exit:** no number anywhere renders without saying what it stands on.

---

## Phase 3 · Navigation, not deletion

Conor's objection to collapsing sections was correct and is recorded: a collapsed section is one
most people never open.

Measured: Stats is 20 sections, 10,502px, **12.9 phone screens**, with 30 explanatory paragraphs
totalling 994 words taking 19% of the page height.

- Sticky jump bar, seven groups, one tap to any of them, highlighting where you are
- Group dividers so twenty sections read as seven chunks
- Long notes behind a "why" link. **Text only, never numbers**
- Only then decide whether the four miss sections merge

**Exit:** any stat reachable in one tap, nothing removed.

---

## Phase 4 · Form faces its trial

The full test is in `2026-10-22-putting-rating-design.md`. Summary: measured 2026-10-23, Form
correlates **0.9992** with strokes gained and changes the order of zero rounds, because 24 of 26
rounds have no process data.

Once ten rounds clear the process gate, measure again across those ten. Below 0.90 it stays.
Above 0.95 it goes the way expected putts went in `a0dfd64`. Re-weight the 50/50 blend once
before reaching for delete.

**Exit:** Form proven or gone. There is no third option, and this file records which.

---

## Phase 5 · The baseline's provenance

`DEFAULT_BASELINE` is reverse-engineered from DECADE, by its own comment. Fine for a personal
tool, not fine the moment anyone pays. Replace with published figures that can be cited.

**Exit:** every number traces to something you could show a lawyer.

---

## Phase 6 · A second player, then a third

Everything above is unfalsifiable with one user: you cannot tell a real finding from your own
habits. Seth is already in. A college team is eight people putting thirty times a week.

**Exit:** one finding confirmed on somebody who is not Conor.

---

## Phase 7 · Form as a player rating, with an xGOT-shaped core

Conor's idea, and it is the right one: Form as a football player rating, a composite out of ten
from weighted components, with an expected-goals family underneath it.

The mapping is clean. **xP** is the chance a putt goes in given distance and break, which is
`makeability.ts` and already exists. **xPOT** is the xGOT analogue: the chance given *how it was
struck*. In football xGOT earns its place by conditioning on something xG cannot see, namely
where in the goal the ball went. The putting equivalent is read, strike, start line and pace,
which is exactly the information strokes gained has no access to.

**This has been attempted once and deleted** in `a0dfd64`, at r=0.905 against strokes gained.
The reason matters: that version was built from distance and outcome, the same ingredients
strokes gained uses, so it could only ever restate it. Rebuilding that half and giving it a
football name would reproduce the failure with better branding.

Measured 2026-10-28, the two halves are nowhere near each other:

| Needed for | Have | Gate |
|---|---|---|
| xP, break-tagged putts | **188** | 150, and every shape clears its 30 |
| xPOT, read + strike together | **39** | far short |
| xPOT, read + strike + line + pace | **29** | far short |

So the half that is ready is the half that already failed, and the half that is new stands on 29
putts.

**Do not start this until the execution-tagged count is in the high hundreds.** Then build xPOT
first, measure it against strokes gained before building anything on top of it, and only then
consider the composite rating. If xPOT correlates above 0.95 like its predecessor, it goes, and
the rating idea goes with it.

**Exit:** xPOT built on real tagged data and measured. Kept only if it disagrees with strokes
gained in the cases it was designed for: pure strokes that missed, and bad strokes that dropped.


## What would make it legendary

Not more features. There are already more than the data supports.

Every golf app lies by confident omission: a make rate off nine putts printed in the same
typeface as one off nine hundred, and never a word about which is which. None of them says "I
do not know yet."

If BREAK! is the one that does, that is an identity, it is defensible, and it is goal 1 exactly.
The instinct is already there: expected putts was deleted for being redundant at r=0.905, which
most people would have shipped.

**Order:** Phase 2 first. Phase 1 closed on the evidence rather than being done, and Phase 2 is
the one that makes the app worth trusting.
