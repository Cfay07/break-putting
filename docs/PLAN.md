# BREAK! plan: redesign, teams, and getting paid

Written 2026-11-15. This sits on top of [ROADMAP.md](ROADMAP.md) and [PRACTICE.md](PRACTICE.md)
and changes one thing in the build order: team and feed come before full game.

## What BREAK! is

The putting and practice app golf teams use together. Free for players, paid by the coach.
A player can keep a GPS app for yardages and a strategy app for course management and still use
BREAK! for putting, because nobody else closes this loop:

**log a round → see what cost you → practice exactly that → watch it show up on the course.**

For one player, that loop is the product. For a team, it is the same loop made visible: teammates
see each other's work, and the coach sees who is practicing and sets the week.

## The deadline

The Carthage winter break meeting. The coach has seen the app and asked for it. By that meeting:
steps 1 to 4 below are live, Conor has weeks of his own practice logged, and two teammates have
run a session.

## Build order

Each step finishes before the next starts. Every new screen gets a mockup first.

### 1. Practice, the biggest piece

Found by running Practice as a new player on a phone, 2026-11-15:

1. Ready-made sessions, so a new player can start in one tap without importing or building.
2. A done screen that says something: the score by distance and what to do next.
3. One tap to start the weekly test, not two.
4. Every drill listed at the length you will actually putt in your room.
5. Plain labels: "3 to 12 ft · 18 putts", "Holed", "Inside 3 ft".
6. "Pace to the far end" shows its distance.

Then the proof, which no code closes: Conor logs every practice in BREAK! with no paper, and one
full team session is run start to finish on grass.

### 2. The round page, in the recommended style

Go to the mockup's "moments built into the round page" layout. It reads as a recap, where today's
page reads as a stat sheet with moments tacked on under the scorecard.

- **Top:** the moment of the round as the hero (big number, one line, tap to share), with one or
  two smaller moments as chips under it.
- **Then:** what this round showed, as now.
- **Then:** the numbers as one compact row (putts, 1-putts, 3-putts, strokes gained). The full
  stat list moves below the scorecard. Nothing is removed or collapsed.
- **Scorecard:** a tag on any hole with a moment (Weak spot, 2% chance, Lag). Tapping the row
  opens its card.
- **Below:** By distance, Lag control, Form, Misses, Beat the number, Where they went in, unchanged.

### 3. Moments

Moments feed the round page, the share card and, later, the team feed, so they get fixed once here.

- Headlines written like a highlight ("Drained a 40-footer."), one number, how rare.
- One moment per fact. A round that earned nothing shows nothing.
- A moment for the thing a player would brag about and one for the thing they would want to fix
  (the Weak spot tag), so the page is honest and not only a highlight reel.
- The share card matches the hero.

### 4. Settings

Six sections and twelve rows today, in the order they were built. Regroup by what a person comes
to do: **You** (name, account, team), **Your bag** (putters), **Courses**, **While you play**,
**Your data** (imports, backup). Same rows, cleaner order, team gets its row here.

### 5. Team tab and the live feed

- **Joining:** a link the coach or a teammate texts. Tap it, you are on the team, the Team tab
  appears. Settings has "Join or start a team" for everyone else. Nobody sees an empty tab.
- **Live now:** a strip at the top for teammates on the course right now, hole by hole
  ("Hole 12: two-putt from 35 ft"). Rounds publish as each hole is logged, not only at the end.
- **The feed:** every post is made by the app from what was logged. Nobody writes a post.
  A finished round, a moment card, a practice session or test score, a drill level moved.
- **Reactions:** one tap. No comments, no follower counts, no streaks.
- **This week:** who practiced, minutes, and the weekly test as a team board.

What makes it better than a scorecard feed: posts carry the stat and the story automatically,
and the team is small enough that everyone knows everyone. What it stays out of: official
tournament scoring.

### 6. The coach view

One screen, nothing for the coach to log: the roster, who logged rounds and practice this week,
each player's trend, who has gone quiet for seven days. The coach picks the week's session and it
sits at the top of every player's Practice.

### 7. Ready to charge

- A citable baseline (ROADMAP Phase 5): published tour putting numbers, named in the app.
- iPhone home-screen pass and logging with no signal.
- The paid database tier so it never pauses mid-season.
- A paid-until date per team, coach features behind it, invoices for schools.
- Privacy policy and terms.

Where it stands, 2026-11-16:

- **Baseline:** named in Settings as PGA Tour averages. Inside 25 ft it matches Yousefi and Swartz
  (2013, 2012 ShotLink) within 0.02 putts at 7.5, 12.5, 17.5 and 22.5 ft, checked from the paper.
  Past 30 ft is not traced: reproductions of Broadie's table in Every Shot Counts disagree (40 ft
  is 2.06 in the app, 2.12 elsewhere). Open until someone reads the table in the book.
- **No signal:** done. The service worker caches the page and its files on the first visit, so a
  phone that adds the app and goes straight to the course opens it offline. Logging was already
  phone-first.
- **Database tier:** not done. Needs Conor to upgrade the database plan (about $25 a month).
- **Team plans:** done in the app. `team_plans` holds a paid-until date per team that only the
  server can write. New teams get 30 days. The Coach view and setting the week need an active
  plan; the feed and leaderboard never do. Carthage is a pilot through 2027-06-30. Invoices are
  not built: the first one can be sent by hand.
- **Privacy and terms:** done, at #/privacy and #/terms, plus Delete my account in the account
  sheet. Worth a read by someone who knows school contracts before the first paid team.

### Later, only once a team uses it weekly

- Putts-only round entry for teams whose scores live in another app.
- A weekly team report to the coach and a leaderboard post to the team chat.
- A paid tier for solo players.
- Full game ([FULL-GAME.md](FULL-GAME.md)), if teams ask for it.

## Money

- Costs: about $25 a month once teams depend on it. One paying team covers it.
- Price: a season fee per team, priced as an add-on to software the program already buys.
  Carthage pilots free.
- The math: 50 teams at $500 is $25k a year; 120 teams is a job. Year one is realistically
  $5k to $15k, so freelance work stays as the bridge.
- First customers after Carthage: the conference's other schools, then Wisconsin and Illinois
  high schools.

## Rules that still hold

No streaks, XP or badges. No collapsed sections. Every number carries its count. Nothing shows
that was not logged. No other app's name in copy. No handicaps. Fewest taps by default.
