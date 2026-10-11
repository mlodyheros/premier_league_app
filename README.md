# PL Games

Premier League mini-games powered by real squad data and two prices for every
player: **Transfermarkt's market value** and an estimate from the
[pl-value](https://github.com/mlodyheros/pl-value) machine-learning
model. A switch in the header chooses which price every game uses, and it is
remembered between visits.

A static site: no server and no accounts. The data is exported to JSON ahead of
time, and scores, streaks and settings live in the browser's local storage.

| Game | What you do |
|---|---|
| **Guess the Player** | Wordle-style: find the hidden player from club, position, nationality, age and value clues. Daily and unlimited. |
| **100 PTS Challenge** | Spin a club, draft one of its players, fill an XI, then play a 38-game season against the real league: the goal is 100 points. Three draft modes (standard, random position, blind) and two season modes (realistic, arcade); club chemistry; the expected points and 100-point chance before kick-off; every player's goals and assists, every match result. |
| **Higher or Lower** | Is the next player worth more or less? A face-off: the two side by side, their records row by row. Pairs get closer as the streak grows. Themed runs: forwards, midfielders, defenders, goalkeepers, the Big Six. |
| **Budget XI** | Build the strongest XI on a themed budget, from a promoted side (€80M) to a sheikh's takeover (€1.5B), then play a season with it. "Fill the rest" completes an XI within the money left. |
| **Beat the Model** | Does the model rate the player over or under his Transfermarkt value? Ten a round; daily and practice. |
| **Price Tag** | Slide (or step through round amounts) to the value you think a player has. Five a round, up to 100 points each; daily and practice. |
| **Transfer Window** | Take over a club with the board's budget (15% of the squad's value), sell up to three and buy up to three from the other clubs (you pay 20% over value and sell for 10% under; a contract in its last year takes 30% off, two years left 10%; a player you sell joins the strongest club that can pay for him and that he improves), watch the season forecast (200 simulated seasons) move with every deal, then play the season and try to finish above the forecast made before the window. |

Beyond the games: **Market of the week** (`#/market`), the week's biggest
value risers and fallers, and a **Friends
league** (`#/league`) that compares today's results and personal bests with
friends. The league needs no accounts or server: everyone's results travel as a
code inside a link (`src/lib/friends.ts`), and opening a friend's link adds them
to your table. Each browser gets a random player id (kept through a progress reset), so two friends with the same nickname stay two rows and your own link never adds you. An **About & privacy** page (`#/about`) lists the data sources and what is stored, and links to a pre-filled GitHub issue for bug reports (also in the footer).

The home page is a team sheet: every game and page a player on a 4-3-3
pitch, today's three daily rounds up front (green until played, then today's
result), the squad games in midfield, Higher or Lower, the Market, the League
and Players at the back, and you in goal (your nickname and today's score).

A **Players** page (`#/stats`) lists all of them: search, filter by club and
position, sort by rating, value, model-vs-TM gap, goals, assists, minutes or
age, and open any player's full card.

Every player also has a **profile** (`#/player/bukayo-saka`): rating next to
his FC 27 card, both values with this week's change, the model's range,
contract, fee and the career chart. His name opens it wherever a round is
already over: the Market, the season result's XI, the Guess the Player reveal
and the Players list. Names stay plain while a question is open, since the
profile would give the answer away.

The daily rounds (Guess the Player, Beat the Model, Price Tag) are the same for
everyone on a given date, can be played once, and keep a daily streak.

Every game has a **Share** button that opens a share sheet with a card of the
result, drawn on a canvas ([`src/lib/shareCard.ts`](src/lib/shareCard.ts)):
an Instagram story (1080×1920) or a post (1080×1080), with the score, the XI
on a pitch with ratings, goals and assists, the 38 results, badges and a
challenge. On a phone it goes straight to the share sheet (Instagram, chats);
it can also be saved, or copied as text. The daily cards give nothing away:
Guess the Player shows only the colours, Price Tag only the scores. Personal
bests are kept in the browser. The home page
shows today's three daily results and, once all three are done, shares them in
one message.

**Colours** (in Settings): the default night palette, the Premier League's own (purple `#37003c`, green, raspberry, cyan), or a light one (white, blue, green and purple). The club crests on the home page open the Players page filtered to that club.

**Difficulty** (in Settings) decides which players the free-play rounds draw
from ([`src/lib/pools.ts`](src/lib/pools.ts)):

| Level | Players | Who |
|---|---|---|
| Easy | ~110 | worth €30M+ with 2,500+ Premier League minutes |
| Normal | ~290 | 1,800+ Premier League minutes (last four seasons plus this one), or €50M+ with 4,000+ minutes in another big league |
| Expert | all 540 | youth and reserves included |

Daily rounds always use Normal, from 2 October 2026; earlier dates keep the
pool they were played with, so a finished round never changes.

**On a phone** the site installs to the home screen and works offline (a web
app manifest and a service worker: pages and data come from the network first,
the rest from the cache). A first visit gets two short screens on how it works.
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
npm run e2e        # Playwright: every page on a phone and a desktop (after a build)
npm run icons      # regenerate src/components/icons.generated.ts
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
`~/projects/pl-value-predictor`; point `PL_VALUE_DIR` elsewhere if needed:

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
  then add the club to `pipeline/reference.py`. Then run `npm run crests`: crests over 15KB are re-saved as a 192px, 128-colour image inside the same `.svg` (identical at the sizes shown; all 20 now weigh 212KB, not 752KB).
- Club colours, flags and continents, from the hand-written
  [`pipeline/reference.py`](pipeline/reference.py). A new club or nationality
  stops the export with a message saying what to add there.

### Automatic updates

On a Mac, the data can update itself every morning. pl-value refreshes its
dataset at 07:00. At 07:30,
[`scripts/publish_data.sh`](scripts/publish_data.sh) re-exports it. If the data
has changed, the script runs the tests and the build, commits `public/data` as
"Update data to <date> (GW <gameweek>)" and pushes to `main`. The Deploy
workflow then publishes the site.

```bash
./scripts/install_publish_schedule.sh     # turn it on: daily at 07:30 (launchd)
./scripts/uninstall_publish_schedule.sh   # turn it off
./scripts/publish_data.sh                 # run it now, by hand
launchctl kickstart -k gui/$(id -u)/com.plgames.publish   # run the scheduled job now
```

The log is in `logs/publish.log`, which is not committed.

The script is careful by design:
- **Your work is safe.** It does nothing while anything outside `public/data`
  is uncommitted, so work in progress is never pushed.
- **No needless commits.** It stops without committing when nothing but
  `exportedAt` has changed.
- **Broken builds stay local.** If the tests or the build fail, it stops without
  committing.
- **It never force-pushes.**
- **It waits for pl-value.** If the Mac slept through both times, launchd starts
  both jobs on waking. The script then waits for pl-value's refresh to finish
  before exporting.

Pushing needs stored GitHub credentials (the macOS keychain or `gh auth`),
because the job cannot ask for a password. Keep this checkout and pl-value's
outside Desktop, Documents and Downloads: macOS does not let background jobs
read them.

## Share previews

Links to the site show `public/og.png` (1200×630: title, games, crests). Every
game also has its own share page, `g/<game>/`, with its own title, text and
picture (`public/og/<game>.png`), which forwards to the game; the games' share
buttons link there, because link previews never see the part of an address
after `#`. The pages are listed in
[`pipeline/share-pages.json`](pipeline/share-pages.json) and written by a small
plugin in [`vite.config.ts`](vite.config.ts). After the clubs or the games
change, regenerate the pictures locally with `npm run og-image`; it uses macOS
system fonts, so the PNGs are committed instead of built in CI. The address
they are served from is `VITE_SITE_URL` in [`.env`](.env).

## Daily rounds

The daily rounds (Guess the Player's answer, Beat the Model's ten, Price
Tag's five) are written into
`public/data/daily.json` by [`pipeline/daily.ts`](pipeline/daily.ts), today
and two days ahead, with the values they are asked with. A day once written
never changes, so a data update in the middle of a day cannot change its
round (it used to: the browser recomputed the round from the new data, and
Guess the Player even dropped the progress of anyone who had started). The
script runs the games' own TypeScript (with `tsx`) after every export, so a
written round is exactly what the browser would compute; the browser computes
a round itself only for a day the file lacks. The guess answer is never
repeated within a year, or until the pool runs out.

A page left open overnight (common on phones and with the installed app)
reloads itself when the day changes, so it never plays yesterday's round.

## Value history

Each export also updates `public/data/history.json`
([`pipeline/history.py`](pipeline/history.py)): one snapshot of both values per
ISO week (the last 26 weeks), which the Market page compares, and each player's
Transfermarkt valuation history, joined from the Kaggle "player-scores" files
already in pl-value, for the career chart on the Players page. It is loaded
only by the pages that use it. `python3 pipeline/history.py --from-git`
rebuilds the snapshots from this repository's history of `players.json`.

## Tests

`npm test` runs the unit tests (Vitest, `tests/`). `npm run e2e` runs
[Playwright](playwright.config.ts) against the production build on a phone
(Pixel 7) and a desktop: every page loads without errors or sideways scrolling,
the answer buttons stay in thumb reach, Budget XI's sheet opens on screen, the
share pages forward, and the main flows of Guess the Player, 100 PTS Challenge,
Transfer Window and the league work. Locally it uses the installed Chrome; CI
runs both suites before every deploy.

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
`beat/daily/score-7`. The 100 PTS Challenge events are meant for tuning its
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
public/sw.js         the service worker; manifest.webmanifest and icons/ beside it
src/
  data/              types, loading (store.ts), the value-source switch
  lib/               seeded randomness, formatting, storage, stats, sharing,
                     difficulty pools (pools.ts), result pictures (shareImage.ts)
  components/        header and toggle, avatars, search, value comparison, stats
  games/<game>/      logic.ts (pure rules) and <Game>.tsx (UI), one folder per game
  lib/strength.ts    ratings, formations, positional fit, squad strength
  lib/season.ts      the match model and 38-game season simulation
  i18n/              en.ts (reference), pl.ts (typed against it), countries, labels
  pages/             home, players, how it works
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

The **daily** player is the same for everyone. The Normal pool (see Difficulty)
is shuffled with a fixed seed and walked one player per day, so no one repeats
until the pool runs out. The pool can change when the data is updated.
**Unlimited** draws at random from the difficulty level in Settings.

Under the search box a counter says how many players in the pool still fit every
answer so far. After five misses the club can be revealed as a hint (marked 💡
in the shared result). A name with a typo ("Halland") gets "did you mean"
suggestions.

## Ratings and the season simulation

100 PTS Challenge and Budget XI rate players on a FIFA-like overall (OVR), built in
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
3. **Scale.** Scores are ranked across the league and mapped onto the spread of
   EA Sports FC 27's Premier League base cards (`RATING_CURVE`): the best player
   91, about ten players 88+, the top 3% 86+, a median player 77, youngsters
   from the high 50s.
4. **Reader corrections.** A reader's ratings for 15 players are a test
   ([`tests/rating-labels.test.ts`](tests/rating-labels.test.ts)): every one must
   stay within a point. Three Man Utd midfielders get explicit
   `RATING_ADJUSTMENTS`.
5. **EA Sports FC 27.** All but a handful of players (youngsters not in the
   game) have an FC 27 base card (from FUTBIN and EA's own ratings site, in [`pipeline/fc27-ratings.json`](pipeline/fc27-ratings.json), added
   to each player as `ref` by the export, matched without accents and with a few
   aliases for respelled names, so an upstream respelling never loses a rating). Their rating is kept within two
   points of it (`REF_TOLERANCE`): the formula still moves it with form and the
   value source, but never far from what players know from the game. A test
   checks every one of them on both values. Players without a card (new
   arrivals, youngsters) are rated by the formula alone, on the same scale.

Neighbouring roles cost nothing: CM ↔ DM, CM ↔ AM, LW ↔ LM, RW ↔ RM. A little
further out of position a player keeps nearly all of his rating (a 10 on the
wing or a winger on the other flank 97–98%, a winger or a 10 up front 95%, a
centre-back at full-back 93%), so a star is never far below his rating; a
goalkeeper only plays in goal.

- **Your XI's strength** is the mean rating of its eleven, after those penalties.
- **A real club's strength** is the mean rating of its best 16 players: clubs
  rotate, while your XI plays every minute. Players you draft leave their clubs.
  Today that runs from about 75 (the promoted clubs) to 85 (Arsenal, Man City).
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
  five; 3% are own goals and go to nobody. Your XI plays every minute, but a
  real side's substitutes and rotation score and set up about a fifth of its
  goals, so 18% of goals and assists go to the bench: a 90-goal side's top
  scorer gets about 21, and two or three players reach 20 goals and assists,
  as in real title-winning seasons
  ([`src/lib/scorers.ts`](src/lib/scorers.ts)).
- **Each match** draws goals from a Poisson distribution. The expected goals
  start at 1.45 a side, get ×1.12 at home (÷1.12 away), and move with the
  strength gap: a stronger side's goals rise by 7% per rating point, a weaker
  side's fall by 21.5% (FC 27's ratings are closer together than the old
  scale, so each point counts for more). Favourites therefore win 2-0 and 3-0 far more often than
  7-0. Two independent Poisson draws give too few 0-0 and 1-1 games, so the four
  lowest scores get the Dixon-Coles correction (rho −0.2): a simulated league
  has 22% draws, like the Premier League's 22–25%.

With these settings a simulated real league averages 2.7 goals a game, with a
champion in the 90s. The **100-point chance** shown for an XI is exact:
dynamic programming over the win, draw and loss probabilities of all 38
fixtures. Random drafts land around 81–86. In realistic mode 100 points is for
the very best drafts (about one in ten for ~86); only one real Premier League
side has ever done it (Manchester City, 2017/18).

**Arcade mode** (an option in 100 PTS Challenge) gives your XI +2.5 and a steeper
curve (+9% / −27% per point). There a typical draft (~82.5) reaches 100 points
about one season in ten, a strong one (~84) about every other season, the best
nearly always.

**Draft modes**, from easiest to hardest: *standard* (spin a club, take any
player for any open position), *random position* (the spin also draws the
position to fill) and *blind* (a drawn position, names only: no ratings, no
prices, an alphabetical list; the ratings are revealed after the season). In
the position modes the club and the position have a reel and a button each, in
either order: the club is drawn from those that can fill the drawn position,
the position from those the drawn club can fill. "Draw club and position"
spins both reels at once (free, as the first draw). Clubs and positions have
three re-draws each: a new club costs a club re-draw, a new position a position
re-draw, both at once one of each. A tap on a spinning reel stops it
at once. "Start over" throws the XI away mid-draft. Bests are kept per draft
mode and season mode.

**Chemistry**: every extra player from a club already in your XI adds 0.3 to
its rating, up to +1.5 (five from one club, or several smaller groups). It is a
reason to take a slightly weaker player from a club you already have.

## Data and credits

Player data and values come from
[pl-value-predictor](https://github.com/mlodyheros/pl-value), which
draws on the Fantasy Premier League API, Understat and Transfermarkt. Market
values are Transfermarkt's estimates, shown for non-commercial, educational
use. Club crests in [`public/crests/`](public/crests) are the badges the Premier
League serves to Fantasy Premier League (`resources.premierleague.com`), bundled
so the site never contacts their servers. They are trademarks of their clubs,
shown only to identify them; no player photos are used. This is an unofficial
fan project, not affiliated with the Premier League, its clubs or Transfermarkt.
If a rights holder objects, delete `public/crests/`: every crest falls back to
a swatch in the club's colours.

Icons: [Tabler Icons](https://tabler.io/icons) (MIT, © Paweł Kuna), copied at
build time into [`src/components/icons.generated.ts`](src/components/icons.generated.ts)
by [`pipeline/icons.mjs`](pipeline/icons.mjs), only the few dozen the site uses.

Code: [MIT](LICENSE).
