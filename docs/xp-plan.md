# xP, xPOT and the condition-aware baseline

Written 2026-10-28. Supersedes nothing in ROADMAP.md; this is the implementation spec for the
difficulty/execution split those phases were circling.

## The one-sentence version

Strokes gained is already `expectedPutts(d) − putts`. We are upgrading `expectedPutts` from
distance-only to distance + break + slope + severity, and adding a separate execution layer that
never touches it.

## Architecture: three stages, one fit

`makeability.ts` already runs a two-stage penalised logistic. `irls(x, y, penalty, offset)` takes
an `offset` that the fit is not allowed to re-estimate, which is how stage 2 sits on stage 1.

| Stage | Fits | Offset | Status |
|---|---|---|---|
| 1 · distance | `a + b·ln(d)` | none | live, line 131 |
| 2 · break | shift per `lr/rl/double/uphill/downhill` | stage 1 | live, line 148 |
| 3 · execution | shift per fault | stages 1+2 | **new** |

Stage 3 is the same call with a different design matrix. No new machinery.

## Stage 2 gap: severity is collected and unused

`termsOf()` reads `breakDirs` only. `brokeAs` (1–4, how much it actually moved) has **zero
references** in `makeability.ts`. A slight L→R and a severe L→R are the same putt today.

Add severity as a term. **Use `brokeAs`, never `readAs`.** `readAs` is what the player thought it
would do; a misread would otherwise make a putt easier. `form.ts:164` already relies on this
distinction.

## Definitions

```
p(d, cond)        = sigmoid(stage1 + stage2)         make probability
tail(d)           = e(d) + p_distance_only(d) − 2    three-putt risk the baseline carries
xP(d, cond)       = 2 − p(d, cond) + tail(d)         expected putts to hole out
c(d, cond)        = xP(d, cond) − e(d)               condition adjustment
```

`xP` is expected putts **to finish the hole**, not make probability. Those are two different
numbers and both are displayed, under different names:

- **Make chance** — `p`. About this stroke. The xG analogue.
- **xP** — expected putts. The strokes gained ingredient.

## The difficulty adjustment must telescope

Per-putt adjustment is **not** `c_i`. That double counts, because the leftover putt's difficulty is
already inside the previous putt's expectation.

```
adj_i = c_i − c_(i+1)          with c = 0 after hole-out
Σ adj_i = c_1                  the hole's adjustment is the first putt's
```

Measured error from getting this wrong on one hole with two breaking putts: **+0.240 strokes**.
A test case where the second putt is straight and flat will not catch it. Write the test with a
breaking leftover.

Same rule for per-putt SG: `SG_i = xP_i − 1 − xP_(i+1)`, zero after hole-out, which telescopes to
`xP_1 − n`.

This buys a real capability: a lag now gets charged for the putt it leaves. Same 22 ft lag,
leaving a straight 6-footer scores −0.358 and leaving a breaking downhill 6-footer scores −0.598.
Distance-only calls both −0.442.

## Stage 3: xPOT

```
logit p_pot = logit p(d, cond) + Σ w_f · fault_f
xPOT        = 2 − p_pot + tail(d)
stroke cost = xPOT − xP                              in putts, always ≥ 0 for real faults
```

**xPOT never feeds xP.** A bad stroke must not raise pre-putt difficulty, or the app says you were
expected to struggle because you struggled.

Ship **level 1** first: a single coefficient for "any fault present", clean vs faulty. Per-fault
pricing is level 2 and genuinely harder, because faults co-occur (a toe strike often causes the
push) and separating them needs more than marginal counts.

### Band it, do not gate it

There is no count at which the coefficients become trustworthy. There is only a band that narrows.
Show the estimate with its 95% interval from the first fit.

At 39 tagged putts a 35-point effect clears zero; a 10-point effect does not. Whether the effect is
large is the open question, and gating hides the answer instead of reporting it.

A band that straddles zero must *look* like it straddles zero. Not a confident number with small
grey text underneath.

## Form, rebuilt on xPOT

Form today counts tags: 7 of 11 reads right, every fault weighted the same. Rebuild it as
`Σ (xPOT_i − xP_i)` per round, the putts your execution cost you, mapped onto 0–10 with a fixed
curve the way `fromSG` does now.

Keeps the 0–10 rating. Replaces a tally with a measured quantity. Form still never reads xP as a
level, only the execution delta.

## Cup entry

New `{putt.made && …}` block in `PuttEditor.tsx`, mirroring the `{!putt.made && …}` miss grid at
line 101. Tap-ins never open this sheet, so they gain no taps.

Eight points on the rim, no dead centre: a ball crosses the rim somewhere, so the centre-cut putt
is **front door**. **6 o'clock faces where the ball started**, fixed, or the points mean nothing
across players. Include **not sure / didn't see**.

Ships as **observed cup entry · optional**. It does **not** establish pace or verify the read:
entry point is a joint result of line, speed and break, so a back-door entry could be too much pace
or a putt that took the break late. Different causes, same observation.

## Naming

**Condition-adjusted**, not corrected. "Corrected" asserts the old verdict was wrong and the new
one is right. All we can show is that the model changes the verdict, which is not the same as
earning it. Revisit after validation against held-out rounds.

## The boundary, stated once

**Conditions set the expectation. Execution tags describe what you did. Neither proves why the ball
missed.**

`+0.15` means *the model estimates this putt was harder than an average six footer*. It does **not**
mean *the break caused 0.15 of your miss*. A hard putt and a bad stroke are both allowed to be true
at once: the difficulty does not excuse the push, and the push does not remove the difficulty.

An expected-strokes benchmark evaluates a result against an expectation. It never identifies a
cause. If the question is "why did I miss", xP cannot answer it, and recording a push alongside a
severe break does not establish how much either contributed.

The card reads:

```
Expected putts      1.45
Conditions          downhill, right to left, severe
Result              missed, then holed  ·  2 putts
Execution recorded  push
Adjusted SG         −0.55
```

Five plain rows. No invented headline, no causal verb anywhere in it.

## Display rules

- The bar runs 1.00–2.30 with 1.00 and 2.00 as **reference anchors**, not probability zones. xP is
  an average; print make and three-putt separately since the model estimates them.
- The 2.23 ceiling means **the model has no four-putt term**, not that four-putts are impossible.
- No round-level xP. It is already inside strokes gained; printing it prints SG's own ingredient.
  Round level shows distance-only SG, condition-adjusted SG, and the gap.
- **The difficulty adjustment is not a headline number.** It is never called break credit: that
  name reads as the app apportioning blame to the break, which is not what it measures. The card
  leads with expected putts and the conditions that produced it. Show the delta only as a quiet
  secondary row, labelled **difficulty adjustment**.
- It is exactly 0.00 on untagged and genuinely straight putts. Say so, do not draw a confident
  zero. Keep it off the home card, where 24 of 26 rounds would show blank.
- ⓘ beside strokes gained, in these words: *Strokes gained already works this way. It looks up what
  a putt from your distance is normally worth, then subtracts what you took. The only thing
  changing is that the lookup now knows your putt broke.*

## Removals

- `BlameTriangle.tsx`, live in `RoundDetail.tsx` and `Stats.tsx`. It divides by `1/faults`, an
  allocation rule wearing a graphic. Faults get listed, not priced, until stage 3 level 2.
- Form's borrowing of strokes gained, which is why it correlates r = 0.9992 today.

## Known limitations, documented not hidden

- **60 ft clamp.** `sg.ts:5` returns the last baseline value for any `d ≥ 60`. A 90-footer scores
  as a 60-footer.
- **Mixed populations.** `DEFAULT_BASELINE` is a fixed table never fit to the user; the break shift
  is fit on the user's own rounds. The shift is log-odds so it transfers, but the two halves come
  from different populations.
- **Slope has no magnitude.** Break gets 1–4 via `brokeAs`; uphill/downhill is boolean. A gentle
  and a terrifying downhiller are the same putt. Deferred: a second scale on every putt costs taps.

## Order of work

1. Severity into stage 2 (`brokeAs`). No new tagging, data ready.
2. `xP`, `c`, and telescoping `adj_i`. Test with a breaking leftover.
3. Putt card in the shape below. Expected putts leads; the adjustment is secondary.
4. Stage 3 level 1 with bands. Count the real clean/faulty split first.
5. Form rebuilt on the execution delta.
6. Cup entry, optional.
7. Remove the triangle.
8. Best/worst holes ranked against xP rather than raw SG.

Steps 1–3 and 7 need no new data. Step 4 reports a band from whatever exists. Step 6 starts a new
series from zero.
