# BREAK! roadmap

Written 2026-10-25. Conor's two goals, in his words: **100% consistency and honesty about the
stats, accurate with ourselves and our data**, and **easy to use and good to look at**.

Update this file as phases land. An exit condition that is not met is not met, however much
work went in.

## The diagnosis everything follows from

**The app has more metrics than data.** Twenty stats on the Stats page, one player, 27 rounds.
Reads on 43 putts of 805, strike on 41, tempo on 5. Several stats are built, shipped, and
structurally unable to say anything yet.

Most of what looks like a bug traces back to that: Form correlating 0.999 with strokes gained,
conditions splits that never draw, a Stakes row standing on 12 putts.

---

## Phase 1 · Tagging has to be worth its taps

Blocks everything else. Every read stat in the app is decoration until the tags exist.

Measured fill rates across 374 misses:

| Control | Taps | Filled |
|---|---|---|
| Miss grid (side and speed together) | 1 | **50%** |
| Break direction | 1 | 36% |
| Read | 1 | 9% |
| Strike | 1 | 9% |
| Tempo (decel / accel) | 1 | **1.3%** |

Honest tap count for one putt: 2 for distance, 1 for made or missed, 1 to save. **Four is the
floor and it cannot go lower**, because the save is a real confirm rather than overhead. Tagging
adds four more on top.

So this phase is narrower than it first looked. It is not "halve the taps", it is **make each
tagging tap earn itself**.

- **Delete tempo.** Five putts in 805. It feeds pace in Form and one arm of the triangle, and
  both survive without it.
- **Read and strike: cheaper, but not a second grid.** Conor has said twice that a second grid
  beside the miss grid would read as a near-copy of a different question. He is right. Find a
  shape that is not a grid, or leave it at two taps and spend the effort elsewhere.
- Revisit whether break direction and the read can be one choice, since the read curves already
  bow by direction.

**Exit:** 60% of misses carry a read.

---

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

## What would make it legendary

Not more features. There are already more than the data supports.

Every golf app lies by confident omission: a make rate off nine putts printed in the same
typeface as one off nine hundred, and never a word about which is which. None of them says "I
do not know yet."

If BREAK! is the one that does, that is an identity, it is defensible, and it is goal 1 exactly.
The instinct is already there: expected putts was deleted for being redundant at r=0.905, which
most people would have shipped.

**Order:** Phase 1 first regardless, because an app nobody tags is a spreadsheet with opinions.
Then 2, which is the one that makes it worth trusting.
