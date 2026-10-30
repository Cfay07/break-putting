# BREAK! Practice roadmap

Written 2026-10-29, at the start of winter. The goal: replace the team's paper practice sheet
with something people want to open, and point every session at what the rounds say is costing
strokes. Mockups: https://claude.ai/artifact/VyhLR5tyL2xbSU9H6E2KYu

Practice replaces Team in the tab bar. Importing a practice file lives in Settings, with every
other import. Team moves under Settings and comes back for head to head
games (Phase P4). Nothing about Team is deleted.

## Rules that do not bend

- **A practice putt never touches a round.** Sets live in their own `practice` table and their own
  state. Strokes gained, xP, the make model and Form never read them. A mat rolls flat, true and
  the same speed every time; mixing it in would make every distance look easier than it plays.
- **No XP, badges, levels, streak counters or quality scores.** Groove had all of them and they are
  why it felt like a game about the app instead of about putting. The hook is your own last score
  and your own best, nothing invented on top.
- **Every number carries its count.** Same standard as Stats: "68% of 90", never a bare 68%.
- **Nothing shows that was not logged.** No empty sections and no nagging.

## Phases

| Phase | Exit condition | State |
|---|---|---|
| P1 · The tab and the counter | Shipped, 10 sets logged with nothing lost across two devices | **Shipped 2026-10-30, data-gated** |
| P2 · The team sheet | 90 Minutes of Putting run start to finish on a phone, no paper | **Shipped 2026-10-30, untested on grass** |
| P3 · Build your own | A custom 20 minute indoor session built in under a minute | **Shipped 2026-10-30** |
| P4 · Head to head | A week of team games logged by two or more players | Logging shipped; standings are your own record only |
| P5 · Practice against the course | 40+ course putts at a distance after practice began | Data-gated, spring |

### P1 · The tab and the counter
Built and tested on 2026-10-29, not deployed:
- `practice` table in Supabase, owner-only, same rules as rounds. Verified that a signed-out
  visitor gets 401 on read and write.
- Sync on its own clock, so a failed practice upload can never block or skip a round.
- Work on card: the distance zone costing the most strokes a round, from the current putter's
  rounds only (L.A.B. and Cobra putt like two different players). Says so when the runner-up is
  within a tenth of a stroke.
- Drill counter with big Made and Missed buttons, "Type the score", undo, last time and best.
- 52 tests passing.

### P2 · The team sheet
Source: `Putting File _ Outside Practice Plans - Fall practices 2026`. Sixteen sessions, about
thirty distinct drills. Each drill is written once and referenced by id, so Lucky 13 is one drill
used in five sessions, with one history.

Six ways the sheet scores a drill, and each gets one input:
- Made out of N, per distance: steppers (Gate drill 5/10/15, Mirror and tee gates).
- How far you got: a ladder of stations (Lucky 13, Mission Impossible, 2 putt ladder).
- In a row against a clock: ring timer and streak (20 in a row from 3, Northwestern Pressure).
- Two-putt or not: one toggle per distance (Two putt from 20/30/40, Semi-Circle lag rows).
- Inside a zone: counted out of N (Speed drill box, Earn the C, DECADE Speed Drill 3).
- Win, tie or loss: head to head games.

Open questions on the sheet, not to be guessed:
- Lucky 13: does a miss end the attempt, or restart that station?
- DECADE Speed Drill 1 labels its rows Try 1, Try 2, Try 2, Try 2. Read as four tries of six?
- DECADE Speed Drill 3 labels four rows "20 ft". The setup says 15, 20, 25, 30, 35.
- Spiral Out and Two Putt Knock Out point to a Competitive Putting Drills tab that is not in the PDF.
- Chipping and range blocks: show them as timed blocks with a score, or leave them out?
- There is no Day 9.

### P3 · Build your own
A drill is a name, one of the six scoring types, distances, balls, an optional pass mark, a time
block and the surfaces it works on. A session is drills in order with times.

### P4 · Head to head
Opponents come from your team. Each game records winner and, optionally, points. "Winning the
putting game" standings are wins and losses for the season. This is where Team earns its way
back.

### P5 · Practice against the course
Make rate by distance from practice, next to the same distance from rounds. Kept as two bars,
never blended. A mat reads higher by nature, so the story is the gap closing, not the practice
number. Before and after comparisons are confounded by season and green speed, so this states
what moved and never claims practice caused it.

## What shipped on 2026-10-30

- **Work on reads your last ten rounds** with the current putter, and says when the season's
  biggest leak is a different one. A weakness the last ten rounds already fixed is not worth a
  winter.
- **Indoor and Green**, each with the longest putt there is room for. Make stations past it move
  in and say so. Two-putt and speed stations past it are left out, because a two-putt from
  twelve feet is a different drill. A drill that starts past it hides.
- **Practice files import from Settings.** The 2026 Outside Practice Plans sheet reads as 17
  sessions and 47 drills with nothing unread; the 2025 putting file as 15 and 34. Partner and
  group drills come in flagged and are never suggested as solo work.
- **Every drill can be edited.** Someone else's drill saves as your copy, which stands in for it
  in every session; "Back to the original" drops the copy.
- **Practice against play** per drill and per distance, two bars that never blend, each with its
  count, "not yet" under 10 practice balls or 15 course putts.
- **Getting better** compares the earlier half of a drill's balls with the later half on one
  surface, and only says up or down when the change beats its own 95% noise.

## The loop, as of 2026-10-30

Two speeds, so neither claims more than its data holds.

- **Fast, every session.** A drill, a score, your best to beat, and one optional tap on a miss
  for which way it went. Practice finds its own pattern from those taps ("at 3 to 5 ft indoors,
  7 of your last 10 tagged misses went left") and hands you the drill for it. No round needed,
  which is the whole winter.
- **Slow, every few rounds.** Rounds set the target. Inside the zone on the Work on card, the app
  compares each kind of putt (break direction, uphill, downhill) against your other tagged putts
  from the same distance, never against untagged ones, because tagged putts are the harder
  ones. It names a kind only past 10 putts on both sides, says whether the gap beats chance or is
  still a lead, and builds a drill for that exact putt at its distance. Once you have rolled that
  drill, the card tracks that kind of putt on the course since the day you started, and says when
  there are too few to compare.
- **Never** a composite score, XP, or a claim that practice caused a change on the course.

First real readings: left-to-right putts from 3 to 5 ft (5 of 13 against 85%) and from 9 to 15 ft
(1 of 22 against 33%), both past chance; downhill lag finishing close 55% against 75%, still a lead.
