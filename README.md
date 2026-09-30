# PL Games

Premier League mini-games powered by real squad data and two prices for every
player: **Transfermarkt's market value** and an estimate from the
[pl-value](https://github.com/mlodyheros/pl-value-predictor) machine-learning
model. A switch in the header chooses which price every game uses, and it is
remembered between visits.

A static site: no server and no accounts. The data is exported to JSON ahead of
time, and scores, streaks and settings live in the browser's local storage.

| Game | Status |
|---|---|
| **Guess the Player**: Wordle-style, daily and unlimited | ✅ |
| Road to 38-0 · Higher or Lower · Budget XI · Beat the Model · Price Tag | planned |

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
- Club colours, flags and continents, from the hand-written
  [`pipeline/reference.py`](pipeline/reference.py). A new club or nationality
  stops the export with a message saying what to add there.

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
  games/guess/       logic.ts (pure rules) and GuessGame.tsx (UI)
  pages/             home, how it works
tests/               Vitest unit tests
```

Games reach data only through `src/data/`, so the data source can change without
touching them.

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

## Data and credits

Player data and values come from
[pl-value-predictor](https://github.com/mlodyheros/pl-value-predictor), which
draws on the Fantasy Premier League API, Understat and Transfermarkt. Market
values are Transfermarkt's estimates, shown for non-commercial, educational
use. No logos, crests, photos or other images from the Premier League, its
clubs or Transfermarkt are used: players get generated badges in their club's
colours. This is an unofficial fan project, not affiliated with any of them.

Code: [MIT](LICENSE).
