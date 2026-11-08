# Full game

Step 3 of the build order in [ROADMAP.md](ROADMAP.md). Nothing here is built yet. This is the plan
for adding tee, approach, and short game without making a round cost twice the taps.

## The question

Putting already takes about 8 taps a hole: four per putt (two for distance, one for made or
missed, one to save) and a typical hole has two putts, plus one for the score. How does BREAK!
compete with Arccos once it covers the whole round?

## The answer: it does not compete on capture

Arccos wins on effort. Sensors in the grips and course maps mean a full round costs roughly zero
taps. No amount of tap-shaving gets a web app to zero, and a web app cannot track GPS in the
background with the phone in a pocket. Racing them on capture is a race we lose.

BREAK! wins on two things Arccos does not do well. It knows why a putt missed (read, pace,
strike, start line), and it is built for a team with a coach reading every player. Full game
exists to put the putting in context ("you lose 2.1 on the greens and 1.4 on approach, so putting
is still the thing") and to make the team plan complete. It does not need Arccos-level shot
detail to do that. It needs four facts per hole, and most of them are already in the data.

## Two kinds of player, two speeds of entry

Conor's teammates barely use 18 Birdies and hate entering DECADE after a round. Most players
will never tag a putt. The app has to be worth opening for them anyway, because a team plan
where half the roster logs nothing is not worth a coach's money.

**Quick entry, the default.** One tap per hole from a short list of the holes that actually
happen: birdie with one putt, par with one, par with two, bogey with two, bogey with three, and
"other" for the rest. Par comes from the course, so the tap is the whole hole. Add the fairway tap
on par 4s and 5s and a round is about 30 taps, under two minutes, done walking to the next tee.
From that alone: score, putts, three-putts, greens in regulation, fairways, scrambling. No
strokes gained, because that needs putt lengths.

**One optional upgrade.** A first-putt band (inside 5, 5 to 15, 15 to 30, past 30) is one more
tap and unlocks rough strokes gained putting and proximity. It is offered, never required.

**Full tagging, opt in.** Everything BREAK! does today, for the players who want it.

Quick and full entry write the same hole record, so a player can switch any hole up and nothing
downstream has to know which mode it came from.

**Why they log at all.** Fewer taps do not make people log. Getting something back does. The
player gets a share card for the round and a spot on the team feed (build step 4). The coach gets
the automation from the team plan: the weekly team read, auto-assigned drills, the GroupMe post.
When the coach reads it, the team logs it. That is the habit DECADE has and BREAK! needs, at a
tenth of the entry work.

## Better than DECADE and Arccos?

**DECADE:** yes, possible. DECADE asks for every shot after the round. Quick entry asks for one
tap per hole during it, and still gives the coach the numbers DECADE leads with.

**Arccos:** not on capture. Sensors beat taps and always will. It can beat Arccos for a team:
free for players instead of grips plus a subscription each, a coach view Arccos does not
center on, and putting detail Arccos cannot see (read, pace, strike). Sell it on those, not on
effort.

## Why a player picks BREAK! over DECADE or 18 Birdies

Nobody logs a round in two apps. If the coach requires DECADE, teammates log in DECADE and BREAK!
gets nothing. So BREAK! cannot sit beside DECADE. It has to replace it for the team, and that
happens when the coach switches, not one player at a time.

What each one is actually opened for:

- **18 Birdies** is opened for free GPS yardages. The scorecard gets filled in because the app is
  already on screen. Logging is a side effect of something useful.
- **DECADE** is opened because the coach requires it. Players get a strategy and a strokes gained
  report. The entry is the price, paid after the round.
- **BREAK!** has to give a reason to have it open during the round, or a coach who requires it.

The reasons it can offer:

1. **Less work than DECADE for the same coach report.** About 32 taps during the round against
   every shot entered afterwards. The coach still gets scoring, putting, GIR, fairways, and
   scrambling for the whole roster.
2. **A live team round.** Teammates and the coach see scores come in hole by hole during
   qualifying and tournaments (build step 4). Entering the hole is how you show up on the board,
   which is the same pull 18 Birdies gets from yardages.
3. **Something back after every round.** A share card and a spot on the team feed. DECADE and 18
   Birdies give a stats page.
4. **The coach's automation.** The weekly team read, drills assigned from each player's own
   numbers, and the GroupMe post. DECADE makes the coach do the reading.
5. **Putting detail nobody else has**, for the players who want it.

The test before anything is built: **find out what the Carthage coach actually uses DECADE for.**
If it is strokes gained off the tee and on approach, quick entry cannot replace it and the pitch
changes. If it is scoring, putting, and seeing who logged, quick entry plus the team view covers
it with a fraction of the entry.

Yardages are the one reason 18 Birdies wins that BREAK! does not try to match. They need course
maps, which is a data business of its own.

## What is already in the data

Every hole already records par, score, and every putt with its length. From those alone:

| Fact | How it is derived | Taps |
|---|---|---|
| Green in regulation | strokes minus putts against par minus two (already done) | 0 |
| Approach proximity on a hit green | first putt length (already shown under By distance) | 0 |
| Short-game proximity on a missed green | first putt length on a missed green | 0 |
| Up and down | missed green and score at par or better with one putt | 0 |
| Chip-in | `holedOut` flag, already logged | 0 |
| Sand save | needs one fact the data lacks: was it a bunker | 1, only when it was |

So approach quality on hit greens and the whole short game come free. Strokes gained for both
is possible off a baseline by start distance, which the first putt length gives on the green
side. The approach side needs a start distance, covered below.

## The directions, judged

**Reuse first-putt distance as proximity.** Yes, and it is the core of the plan. Zero taps, real
numbers, and it is data Conor has 27 rounds of already. Its limit: on a missed green the first
putt only exists if he putted, so a chip that finishes 4 ft and goes in on the next is a putt of
4 ft (good), but a chip into a bunker is invisible. That is acceptable for a first version.

**Phone GPS for approach distance.** Later, optional, off by default. The browser can read
location only while the app is open on screen, so it costs the real price Arccos avoids: taking
the phone out and unlocking it at the ball. The cheapest version is one tap ("I'm hitting from
here") before the approach, with the second fix taken silently when he logs the first putt
standing near his ball. The gap is the shot length, accurate to about 5 to 10 yards on a phone.
No course map is needed. Worth building only after the zero-tap version has a season of use.

**One tap for the tee result.** Yes. Fairway, left, right, or penalty, on par 4s and 5s only.
That is about 14 taps a round. Skip distance off the tee entirely: it is the stat with the least
to say about a college player's score and the most effort to log.

**Approach miss direction.** Short, long, left, or right, only when the green was missed, and
only in the optional post-round strip. Green hit is already derived, so it costs nothing.

**Derive up-and-down from score and putts.** Yes. Covered in the table. Zero taps.

**Post-round entry.** Yes for the tee and approach taps, as a strip on the round page you fill in
after the round. Fairway or not and which side the green was missed are easy to remember an hour
later. Putting stays in-round, because read and pace are not.

**Voice entry.** No for now. "Fairway, missed right, chipped to six, made it" sounds like the
answer, but it needs speech parsing that fails outdoors in wind, and a wrong parse is worse than
a tap. Revisit if the tap version is used and someone asks for it.

**Import from DECADE.** No. Conor's call: nobody should have to touch DECADE to get value out
of BREAK!. The existing paste import stays for whoever already uses it, but no plan depends on
it.

## Tap budget per round

180 taps a round is a DECADE problem with a different screen. The default has to be a number a
player who barely opens 18 Birdies will actually do.

| | Taps a hole | Taps a round (18, 14 par 4s and 5s) |
|---|---|---|
| **Quick entry, the default** | 1 (score and putts together), +1 fairway on par 4 and 5 | **about 32** |
| Quick, with first-putt band | +1 | about 50 |
| Full tagging, opt in | about 9 to 11 | about 180 |

Missed-green side and bunker are not in the default. They go on the round page as an optional
post-round strip, so nobody is asked mid-round.

The rule this sets: **the default round stays under 40 taps.** A new input gets into the default
only by replacing one, never by adding to it. Everything else is opt in or post-round.

## What to build, in order

1. Quick entry (one tap per hole) and the derived stats: GIR, proximity, up and down,
   chip-ins. This is what the rest of the roster will actually use, so it goes first.
2. The fairway tap on the hole screen, and the optional post-round strip for missed-green side
   and bunkers.
3. GPS approach distance, optional, only if 1 and 2 are used for a season.

Strokes gained off the tee and on approach waits for Phase 5. The putting baseline is not yet
citable, and adding three more uncited baselines makes that worse, not better.
