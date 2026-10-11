"""Value history for the site: weekly snapshots and each player's career curve.

Two kinds of history go into public/data/history.json:

- **Weekly snapshots** of every player's Transfermarkt value and model estimate,
  one per ISO week (a later export in the same week replaces that week's), the
  last SNAPSHOT_WEEKS of them. The site compares the newest with the one
  before to show the week's risers and fallers.
- **Career curves**: Transfermarkt's valuation history from the Kaggle
  "player-scores" dataset already in pl-value (data/raw/kaggle), joined on
  name and date of birth, thinned to at most CAREER_POINTS points, and ending
  at today's value.

Values are stored in units of €100K to keep the file small.

    python pipeline/history.py --from-git   # rebuild snapshots from git history
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import unicodedata
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
HISTORY_PATH = HERE.parent / "public" / "data" / "history.json"
UNIT = 100_000
SNAPSHOT_WEEKS = 26
CAREER_YEARS = 8
CAREER_POINTS = 18

_TRANSLITERATE = str.maketrans(
    {
        "Đ": "Dj", "đ": "dj", "Ø": "O", "ø": "o", "Ł": "L", "ł": "l", "ß": "ss",
        "Æ": "Ae", "æ": "ae", "Œ": "Oe", "œ": "oe", "Þ": "Th", "þ": "th",
        "Ð": "D", "ð": "d", "ı": "i",
    }
)


def normalize_name(name: str) -> str:
    """The same key pl-value joins its sources on (backend/sources/names.py)."""
    decomposed = unicodedata.normalize("NFKD", name.translate(_TRANSLITERATE))
    return " ".join(decomposed.encode("ascii", "ignore").decode().lower().split())


def _units(eur: float | None) -> int | None:
    return None if eur is None else round(eur / UNIT)


def _week(day: str) -> tuple[int, int]:
    return date.fromisoformat(day).isocalendar()[:2]


def empty() -> dict:
    return {"unit": UNIT, "dates": [], "players": {}, "career": {}}


def load(path: Path = HISTORY_PATH) -> dict:
    if path.exists():
        return json.loads(path.read_text())
    return empty()


def last_week_model(history: dict, data_date: str) -> dict[str, int]:
    """Each player's model estimate (EUR) in the newest snapshot from an earlier
    ISO week than `data_date`: what the site showed last week."""
    week = _week(data_date)
    slots = [i for i, d in enumerate(history["dates"]) if _week(d) < week]
    if not slots:
        return {}
    slot = slots[-1]
    return {
        name: row["model"][slot] * history["unit"]
        for name, row in history["players"].items()
        if row["model"][slot]
    }


def add_snapshot(history: dict, players: list[dict], data_date: str) -> dict:
    """Record this export's values; same ISO week as the last snapshot replaces it."""
    dates: list[str] = history["dates"]
    rows: dict[str, dict[str, list]] = history["players"]
    if dates and _week(dates[-1]) == _week(data_date):
        if data_date < dates[-1]:
            return history  # an older export than the one already kept for this week
        dates[-1] = data_date
        slot = len(dates) - 1
    else:
        if dates and data_date < dates[-1]:
            raise SystemExit(f"Snapshot {data_date} is older than the last one ({dates[-1]}).")
        dates.append(data_date)
        slot = len(dates) - 1
        for row in rows.values():
            row["tm"].append(None)
            row["model"].append(None)

    for p in players:
        row = rows.setdefault(p["name"], {"tm": [None] * len(dates), "model": [None] * len(dates)})
        row["tm"][slot] = _units(p["tm"])
        row["model"][slot] = _units(p["model"])

    # Keep the last SNAPSHOT_WEEKS, and drop players with no value left in them.
    drop = max(0, len(dates) - SNAPSHOT_WEEKS)
    if drop:
        del dates[:drop]
        for row in rows.values():
            del row["tm"][:drop]
            del row["model"][:drop]
    for name in [n for n, r in rows.items() if all(v is None for v in r["tm"])]:
        del rows[name]
    return history


def _thin(points: list[tuple[str, int]], limit: int) -> list[tuple[str, int]]:
    """At most `limit` points, evenly spread, always keeping the first, the last and the peak."""
    if len(points) <= limit:
        return points
    peak = max(range(len(points)), key=lambda i: points[i][1])
    step = (len(points) - 1) / (limit - 1)
    keep = {round(i * step) for i in range(limit)} | {peak}
    keep = sorted(keep)
    while len(keep) > limit:  # the peak pushed it over: drop a neighbour that is not special
        for i in range(1, len(keep) - 1):
            if keep[i] != peak:
                del keep[i]
                break
    return [points[i] for i in keep]


def careers(root: Path, players: list[dict], data_date: str) -> dict[str, list]:
    """Transfermarkt valuation history per player, from pl-value's Kaggle files."""
    import pandas as pd

    kaggle = root / "data" / "raw" / "kaggle"
    if not (kaggle / "players.csv").exists() or not (kaggle / "player_valuations.csv").exists():
        print("No Kaggle files in pl-value; career curves skipped.")
        return {}

    people = pd.read_csv(kaggle / "players.csv", usecols=["player_id", "name", "date_of_birth", "market_value_in_eur"])
    people["key"] = people["name"].astype(str).map(normalize_name)
    people["born"] = pd.to_datetime(people["date_of_birth"], errors="coerce")
    by_key = {k: g for k, g in people.groupby("key")}

    today = pd.Timestamp(data_date)
    chosen: dict[str, int] = {}
    for p in players:
        cands = by_key.get(normalize_name(p["name"]))
        if cands is None:
            continue
        ages = ((today - cands["born"]).dt.days / 365.25).fillna(-99)
        cands = cands[(ages - p["age"]).abs() < 1.5]
        if len(cands) == 1:
            chosen[p["name"]] = int(cands["player_id"].iloc[0])
        elif len(cands) > 1:
            # Two players of that name and age: take the one valued closest to today's figure.
            gap = (cands["market_value_in_eur"].fillna(0) - p["tm"]).abs()
            chosen[p["name"]] = int(cands.loc[gap.idxmin(), "player_id"])

    vals = pd.read_csv(kaggle / "player_valuations.csv", usecols=["player_id", "date", "market_value_in_eur"])
    vals = vals[vals["player_id"].isin(set(chosen.values()))]
    since = str(today.year - CAREER_YEARS)
    vals = vals[vals["date"] >= since].sort_values("date")
    series = {pid: list(zip(g["date"].str[:7], g["market_value_in_eur"])) for pid, g in vals.groupby("player_id")}

    out: dict[str, list] = {}
    tm_now = {p["name"]: p["tm"] for p in players}
    for name, pid in chosen.items():
        points = [(month, _units(v)) for month, v in series.get(pid, [])]
        points.append((data_date[:7], _units(tm_now[name])))
        # One point per month: the latest valuation in it.
        monthly: dict[str, int] = {}
        for month, v in points:
            monthly[month] = v
        thinned = _thin(sorted(monthly.items()), CAREER_POINTS)
        if len(thinned) >= 2:
            out[name] = [[m, v] for m, v in thinned]
    print(f"Career curves for {len(out)} of {len(players)} players.")
    return out


def write(history: dict, path: Path = HISTORY_PATH) -> None:
    path.write_text(json.dumps(history, ensure_ascii=False, separators=(",", ":")))


def from_git() -> dict:
    """Rebuild the weekly snapshots from every committed version of players.json."""
    repo = HERE.parent
    log = subprocess.run(
        ["git", "log", "--reverse", "--format=%H", "--", "public/data/meta.json"],
        cwd=repo, capture_output=True, text=True, check=True,
    ).stdout.split()
    history = load()
    history["dates"], history["players"] = [], {}
    for sha in log:
        show = lambda f: subprocess.run(  # noqa: E731
            ["git", "show", f"{sha}:public/data/{f}"], cwd=repo, capture_output=True, text=True, check=True
        ).stdout
        meta = json.loads(show("meta.json"))
        history = add_snapshot(history, json.loads(show("players.json")), meta["dataDate"])
    return history


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--from-git", action="store_true", help="rebuild snapshots from git history")
    args = parser.parse_args()
    if not args.from_git:
        sys.exit("Snapshots are added by export_data.py; use --from-git to rebuild them.")
    history = from_git()
    write(history)
    print(f"{len(history['dates'])} weekly snapshots: {', '.join(history['dates'])}")


if __name__ == "__main__":
    main()
