# PL Games

Premier League mini-games powered by real squad data and two prices for every
player: **Transfermarkt's market value** and an estimate from the
[pl-value](https://github.com/mlodyheros/pl-value-predictor) machine-learning
model. A switch in the header chooses which price every game uses, and it is
remembered between visits.

A static site: no server and no accounts. The data is exported to JSON ahead of
time, and scores, streaks and settings live in the browser's local storage.

| Game | What you do |
|---|---|
| **Guess the Player** | Wordle-style: find the hidden player from club, position, nationality, age and value clues. Daily and unlimited. |
| **Road to 100** | Spin a club, draft one of its players, fill an XI, then play a 38-game season against the real league: the goal is 100 points. Three draft modes (standard, random position, blind) and two season modes (realistic, arcade); every player's goals and assists. |
| **Higher or Lower** | Is the next player worth more or less? Pairs get closer as the streak grows. |
| **Budget XI** | Build the strongest XI on a themed budget, from a promoted side (€80M) to a sheikh's takeover (€1.5B), then play a season with it. |
| **Beat the Model** | Does the model rate the player over or under his Transfermarkt value? Ten a round; daily and practice. |
| **Price Tag** | Slide to the value you think a player has. Five a round, up to 100 points each; daily and practice. |

The daily rounds (Guess the Player, Beat the Model, Price Tag) are the same for
everyone on a given date, can be played once, and keep a daily streak.

Every game has a shareable result and keeps personal bests in the browser.

**Languages:** English and Polish. The ⚙ Settings dialog switches language
(first visit follows the browser), switches the value source, and resets scores
and progress. The **How it works** page explains the model, its accuracy and
limits, the players it disagrees with Transfermarkt about most, and how every
game and the season simulation work. Its figures come from the exported data and
the simulation's own constants, so they update with the data.

## Run it

Needs Node.js 20.19 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the game logic
npm run build      # type-check and build to dist/
npm run preview    # serve the production build
```

## Update the data

The site reads two files, `public/data/players.json` and `public/data/meta.json`.
They are committed, so building and deploying never needs pl-value. To refresh
them after pl-value has rebuilt its dataset:

```bash
npm run export-data
```

This runs [`pipeline/export_data.py`](pipeline/export_data.py) with pl-value's
own Python environment. It expects a built checkout at
`~/Desktop/pl-value-predictor`; point `PL_VALUE_DIR` elsewhere if needed:

```bash
PL_VALUE_DIR=/path/to/pl-value-predictor npm run export-data
```

The model's estimates are not stored in pl-value (its API computes them when it
starts), so the exporter calls the same functions: out-of-fold predictions
averaged over 20 splits, the 80% ranges and the cross-validated metrics. The
figures therefore match pl-value's own site exactly. Nothing is fetched from the
network. It reads pl-value's dataset, calibration file and cached FPL snapshot.

What the export adds:

- **`perf`**: a 0–100 performance rating, a percentile within the position group,
  from minutes (this season, last season, career), bonus points per 90,
  xGChain against the position, goal involvement per 90, FPL points per game and
  Champions League games. It never uses price, so games can mix it with
  whichever value source is active.
- **`known`**: whether a player is recognisable enough to be a daily answer
  (worth €25m+, or €10m+ with 4,000+ Premier League minutes).
- When clubs change (promotion and relegation), fetch the new crests with
  `python3 pipeline/fetch_crests.py` (the export warns about any missing one),
  then add the club to `pipeline/reference.py`.
- Club colours, flags and continents, from the hand-written
  [`pipeline/reference.py`](pipeline/reference.py). A new club or nationality
  stops the export with a message saying what to add there.

## Share previews

Links to the site show `public/og.png` (1200×630: title, games, crests). After
the clubs change, regenerate it locally with `npm run og-image`; it uses macOS
system fonts, so the PNG is committed instead of built in CI. The address it is
served from is `VITE_SITE_URL` in [`.env`](.env).

## Visit statistics (optional)

The site can count visits with [GoatCounter](https://www.goatcounter.com):
open source, free for non-commercial sites, no cookies and no personal data, so
no consent banner is needed. It is off until you give it a site code:

1. Create a free account at goatcounter.com; the code is the `xyz` in
   `xyz.goatcounter.com`.
2. In the GitHub repository: Settings → Secrets and variables → Actions →
   Variables → New repository variable `GOATCOUNTER_CODE` = your code.
3. Push (or re-run the Deploy workflow).

Counting is skipped on localhost and for browsers that send Do Not Track, and
players can switch it off in Settings. Besides page views it records a few
anonymous game events, such as `road/arcade/standard/ovr-84/pos-1/pts-100` or
`beat/daily/score-7`. The Road to 100 events are meant for tuning its
difficulty on real drafts: if arcade titles come too easily or 100 points never
happens, adjust `DIFFICULTY` in [`src/lib/season.ts`](src/lib/season.ts).

## Deploy

**GitHub Pages:** push to `main`. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
tests, builds and publishes. Once, in the repository's Settings → Pages, set
Source to **GitHub Actions**.

**Vercel:** import the repository. The defaults (framework Vite, build
`npm run build`, output `dist`) work as they are.

The build uses relative paths and hash routes (`#/guess`), so it works at a
domain root or under a sub-path without configuration.

## Project structure

```
pipeline/            export from pl-value → public/data/ (Python)
public/data/         players.json, meta.json: the only files a data update changes
src/
  data/              types, loading (store.ts), the value-source switch
  lib/               seeded randomness, formatting, storage, stats, sharing
  components/        header and toggle, avatars, search, value comparison, stats
  games/<game>/      logic.ts (pure rules) and <Game>.tsx (UI), one folder per game
  lib/strength.ts    ratings, formations, positional fit, squad strength
  lib/season.ts      the match model and 38-game season simulation
  i18n/              en.ts (reference), pl.ts (typed against it), countries, labels
  pages/             home, how it works
  styles/            tokens, base, layout, components, games, pages, motion
docs/design-system.md  colour, type, spacing, motion and accessibility rules
tests/               Vitest unit tests
```

Games reach data only through `src/data/`, so the data source can change without
touching them.

## Translations

All text lives in [`src/i18n/en.ts`](src/i18n/en.ts) and
[`src/i18n/pl.ts`](src/i18n/pl.ts). `pl.ts` is typed against the English keys,
so a missing translation fails the build, and a test checks that both languages
use the same `{placeholders}`. Plural forms follow `Intl.PluralRules`, which
gives Polish its three forms (1 minuta, 3 minuty, 7 minut). Money, decimals and
dates follow the language too: `€45.5M` / `45,5 mln €`, `84.3` / `84,3`.

To add a language, copy `pl.ts`, translate it, register it in `LANGS` and
`DICTS` in [`src/i18n/index.ts`](src/i18n/index.ts), and add country names in
[`src/i18n/countries.ts`](src/i18n/countries.ts).

## How Guess the Player works

Find the hidden player in 8 guesses. Each guess is compared on five things:

| | Green | Yellow |
|---|---|---|
| Club | same club | none |
| Position | same position | same line (GK / DEF / MID / FWD; wingers count as FWD) |
| Nationality | same country | same continent |
| Age | same age | within 2 years; the arrow points towards the answer |
| Value | same value | within 25% on the active value source; arrow as for age |

The **daily** player is the same for everyone. The pool of well-known players is
shuffled with a fixed seed and walked one player per day, so no one repeats until
the pool runs out. The pool can change when the data is updated. **Unlimited**
draws at random. Its hard mode draws from all 540 players.

## Ratings and the season simulation

Road to 100 and Budget XI rate players on a FIFA-like overall (OVR), built in
[`src/lib/strength.ts`](src/lib/strength.ts) in three steps:

1. **Ability value.** The market value on the active source, corrected for age
   (`AGE_FACTOR`): the market prices young players for potential and resale and
   veterans cheaply for the lack of it, so a 20-year-old's price is scaled down
   (×0.72) and a 35-year-old's up (×3.7). Goalkeepers' prices are scaled up
   (×1.5, `POSITION_FACTOR`), because keepers sell for less than outfield
   players of the same standing.
2. **Score.** 60% that ability value on a log scale (€1m–€200m), 40% the exported
   performance percentile (minutes, bonus points, xGChain, goal involvement,
   FPL form, Champions League games, within the position group). Each role is
   judged on what it does: goalkeepers not on attacking output, defensive and
   central midfielders not on goal involvement. This season's measures count
   in proportion to the season played (a quarter at gameweek 5, fully from
   gameweek 19), so a few games missed early don't sink a regular.
3. **Scale.** Scores are ranked across the league and mapped onto a FIFA-like
   curve (`RATING_CURVE`): the best player 91, about ten players 88+, the top 3%
   86+, a median Premier League player 73, fringe youngsters in the 50s.
4. **Reader corrections.** A reader's ratings for 15 players are a test
   ([`tests/rating-labels.test.ts`](tests/rating-labels.test.ts)): every one must
   stay within a point. The formula gets 11 of them on its own; four Man Utd
   midfielders, whose recent numbers reflect a struggling side more than
   themselves, get explicit `RATING_ADJUSTMENTS`. If that list grows, change
   the formula instead.

Neighbouring roles cost nothing: CM ↔ DM, CM ↔ AM, LW ↔ LM, RW ↔ RM. A little
further out of position a player keeps nearly all of his rating (a 10 on the
wing or a winger on the other flank 97–98%, a winger or a 10 up front 95%, a
centre-back at full-back 93%), so a star is never far below his rating; a
goalkeeper only plays in goal.

- **Your XI's strength** is the mean rating of its eleven, after those penalties.
- **A real club's strength** is the mean rating of its best 16 players: clubs
  rotate, while your XI plays every minute. Players you draft leave their clubs.
  Today that runs from about 69 (the promoted clubs) to 85 (Arsenal, Man City).
- **Your XI joins the league** in place of the weakest club, and every team plays
  every other home and away.
- **Every real club gets a season's form**, a random swing of about ±2.5 rating
  points (injuries, a new manager, luck), so the strongest squad doesn't win the
  league every time: Arsenal and City about a third of the titles each,
  Liverpool about a sixth, someone else the rest.
- **Goals get scorers.** Each of your XI's goals is given a scorer drawn by the
  slot he plays (a striker far more often than a centre-back, a goalkeeper
  never) and his own goals-per-90 record against his position's norm. About
  three goals in five also get an assister, drawn the same way but more
  concentrated, so a 100-goal side has one or two double-figure assisters, not
  five; 3% are own goals and go to nobody
  ([`src/lib/scorers.ts`](src/lib/scorers.ts)).
- **Each match** draws goals from a Poisson distribution. The expected goals
  start at 1.45 a side, get ×1.12 at home (÷1.12 away), and move with the
  strength gap: a stronger side's goals rise by 5.5% per rating point, a weaker
  side's fall by 16.5%. Favourites therefore win 2-0 and 3-0 far more often than
  7-0.

With these settings a simulated real league averages 2.7 goals a game, with a
champion on about 96 points. The **100-point chance** shown for an XI is exact:
dynamic programming over the win, draw and loss probabilities of all 38
fixtures. Random drafts land around 79–85. In realistic mode a strong one (84)
reaches 100 points about 2% of the time and the best (~85.5) about 12%; only
one real Premier League side has ever done it (Manchester City, 2017/18).

**Arcade mode** (an option in Road to 100) gives your XI +2.5 and a steeper
curve (+7% / −21% per point). There a typical draft (~81.5) reaches 100 points
about one season in ten, a strong one more often than not, the best about 85%
of the time.

**Draft modes**, from easiest to hardest: *standard* (spin a club, take any
player for any open position), *random position* (the spin also draws the
position to fill) and *blind* (a drawn position, names only: no ratings, no
prices, an alphabetical list; the ratings are revealed after the season). In
the position modes the club and the position have a reel and a button each, in
either order: the club is drawn from those that can fill the drawn position,
the position from those the drawn club can fill. A re-draw (club, position or
both at once) costs one of the three re-spins. Bests
are kept per draft mode and season mode.

## Data and credits

Player data and values come from
[pl-value-predictor](https://github.com/mlodyheros/pl-value-predictor), which
draws on the Fantasy Premier League API, Understat and Transfermarkt. Market
values are Transfermarkt's estimates, shown for non-commercial, educational
use. Club crests in [`public/crests/`](public/crests) are the badges the Premier
League serves to Fantasy Premier League (`resources.premierleague.com`), bundled
so the site never contacts their servers. They are trademarks of their clubs,
shown only to identify them; no player photos are used. This is an unofficial
fan project, not affiliated with the Premier League, its clubs or Transfermarkt.
If a rights holder objects, delete `public/crests/`: every crest falls back to
a swatch in the club's colours.

Code: [MIT](LICENSE).
