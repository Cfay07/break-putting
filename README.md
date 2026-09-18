# BREAK!

Putting tracker. Log every putt during a round, see what the misses have in common, and check whether the numbers are moving over time.

Runs as a standalone Vite app inside this repo. The Next portfolio build does not touch it.

## On a phone

The build is static, so any HTTPS host works. Once it is on a URL:

1. Open it in Safari on the phone.
2. Share, then Add to Home Screen.

That step matters for more than the icon. iOS clears local storage for ordinary websites after about a week of no visits, and a site added to the home screen is exempt. Installed, it also opens fullscreen with no address bar, and the service worker means it opens with no signal, which is most golf courses.

Data lives in the browser that entered it, so moving to a new URL means Settings, Import JSON, and the backup in `seed/`.

## Run it

```bash
npm --prefix break run dev
```

Opens on http://localhost:5183. Build with `npm --prefix break run build`.

## Pages

- **Rounds** every finished round, newest first, with putts, 3-putts, strokes gained and score. A round in progress pins to the top with a Continue button.
- **Track** the live round. Type the distance on the keypad, tap MADE or MISSED, tag the miss behind MISSED, then type the leave. When a hole closes you type the score and the par is already filled in from the course. Undo and a hole selector are always on screen. Leaving the page and coming back puts you on the exact step you left, half-tagged miss included.
- **Stats** averages, four trend charts, round vs round with deltas, pooled miss patterns, breakdowns by putter and by nine, and coaching cards. The only filter is the putter, and it only appears once there is more than one. Date range is redundant with the trends, and a course filter stops being useful as soon as there are more than a few.
- **Settings** putters, the expected-putts baseline, a bulk importer for old rounds, JSON export and import.

## Data

Everything lives in `localStorage` under one key (`break.state`) with a `version` field for later migrations. No backend, no accounts. Export the JSON after rounds that matter, because a browser can clear local storage without asking.

Stats are pure functions in `src/lib/stats.ts` and `src/lib/sg.ts`, so round detail and the Stats page compute from the same code.

## Strokes gained

Per putt: `expectedPutts(distance) - 1 - expectedPutts(leave)`, with the leave counting as zero when the putt goes in. Those sum by hole to `expectedPutts(first putt) - putts taken`, so the by-distance column and the round total always agree. The baseline is a scratch-level table in `src/lib/types.ts`, editable per device in Settings.

Distance buckets: tap-in ≤2, 3-5, 6-8, 9-15, 16-30, 31-40, 41-50, 51-60, 61+. Scoring range is 3 to 10 feet.

Checked against DECADE on both Ives Grove rounds. Eleven of eighteen holes match to the hundredth on 9/14 and the round totals land within 0.14 and 0.57. Where they differ, it is because DECADE has a different first-putt distance recorded, not because the model differs.

## Courses and pars

New round searches api.golfcourseapi.com, which returns par for every hole on every tee. Pick a course, pick a tee, and each hole starts with its par filled in, so logging a hole is just typing the score. Picked courses are saved to the device, so the search is only needed once per course and the app keeps working with no signal.

The auth header needs a space after the word Key (`Authorization: Key <key>`). Without it every request 401s. Coverage is partial: Racine CC and Johnson Park are in the database, Ives Grove is not, so there is a manual path where you type the pars once and they get saved under a name like "Blue + Red".

The API key lives in `src/lib/courseApi.ts` and ships in the bundle. That is fine for a personal app on a personal device, and it is the same key already sitting in the Groove repo.

## Greens in regulation

Entering a hole's score is enough to work out whether the green was hit in regulation, with no yardage needed:

```
GIR  ⟺  putts - (score against par) ≥ 2
```

A two-putt par is a green hit. A one-putt bogey is not, because you got there in one more than regulation. Both real rounds check out against the greens written on the card, 14 and 13.

## Lag putting

A lag putt from 30 feet or more counts as good when the leave is inside a tenth of the putt: 6 feet from 60, 4 feet from 40. Holed putts count as a zero leave. The lag panel reports how many cleared that bar and what the average leave was as a percentage of the putt.

## Nines

Courses with more than eighteen holes get a name for each nine on the round, so holes 1-9 and 10-18 can be attributed separately. The Stats page then breaks putting down by nine.

## Bulk importer format

It reads the shorthand as written on a phone during a round. Hole number, then one entry per putt in play order, commas between them. The first number in an entry is the distance. Words anywhere in the entry become tags: high, low, on line, short, long, past, lip, push, pull, chunk. Whatever follows the pipe is the running score.

```
1: 8 feet (lip) (high), 1 foot | E
12: 22 feet (high&short), 2 feet (high and pushed), 1 foot | +1
9: 32 feet high and 12 feet past, 12 feet low lip, 4 feet missed high, one foot | +10
```

Three rules cover how the shorthand actually gets written:

- A last entry with no tags is the putt that went in.
- A tagged last entry from more than 2 feet means the tap-in went unwritten, so one gets added.
- A tagged entry inside 2 feet at the end of a hole is a note about the putt before it, so the tags move back a putt.

Commas are optional between two tagged distances (`44 feet (high) 12 feet (high)` is two putts) because parentheses already mark where one putt ends. Every inference gets reported back after the import, and the putt count is checked against the number written on the card.

## Seeded rounds

`seed/rounds-2026-09-14-15.json` holds the 9/14 and 9/15 rounds at Ives Grove, ready for Settings → Import JSON. 37 putts and 80 on Blue + Red, then 40 putts and 81 on White + Blue, both with the L.A.B. DF3. Back-nine pars and scores came off the DECADE cards; the front nine pars were cut off in those screenshots, so those holes carry only their score against par.

Nothing in the app uses a browser `confirm()` dialog, because the preview browser swallows them. Destructive buttons arm on the first tap instead.

## Ives Grove

The golf course API does not carry it, so its three nines are built into `src/lib/builtInCourses.ts` off the BlueGolf scorecards. The Blue nine appears on two different BlueGolf cards with the same pars, and both match the DECADE cards from 9/14 and 9/15, so the numbers are confirmed twice over. All six orderings of the three nines are offered as tees, and picking one names the round's nines by itself.

## Not built yet

Green speed and conditions per round, goals, a practice and drill log, and a first-putt proximity heatmap. Left out of v1 on purpose.

A most-played-courses section, which is the useful version of course data: a stat block rather than a filter.

Front nine pars at Ives Grove, which would let those holes carry a real score instead of a score against par.
