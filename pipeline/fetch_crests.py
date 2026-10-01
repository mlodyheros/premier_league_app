"""Download club crests for this season's clubs into public/crests/.

Run when the Premier League's clubs change (promotion and relegation). Club
codes come from pl-value's cached FPL snapshot; the crests are the SVG badges
the Premier League serves to Fantasy Premier League. Existing files are kept
unless --force is given.

    python3 pipeline/fetch_crests.py [--pl-value PATH] [--force]
"""

from __future__ import annotations

import argparse
import json
import urllib.request
from pathlib import Path

CREST_URL = "https://resources.premierleague.com/premierleague/badges/t{code}.svg"
OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "crests"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--pl-value", type=Path, default=Path.home() / "projects" / "pl-value-predictor")
    parser.add_argument("--force", action="store_true", help="download even if the file exists")
    args = parser.parse_args()

    bootstrap = json.loads((args.pl_value.expanduser() / "data/raw/fpl/bootstrap_static.json").read_text())
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for team in bootstrap["teams"]:
        target = OUT_DIR / f"{team['short_name']}.svg"
        if target.exists() and not args.force:
            continue
        with urllib.request.urlopen(CREST_URL.format(code=team["code"]), timeout=20) as resp:
            body = resp.read()
        if b"<svg" not in body[:2000]:
            raise SystemExit(f"{team['short_name']}: not an SVG")
        target.write_bytes(body)
        print(f"{team['short_name']}: {len(body):,} bytes")
    print("Optimise with: npx svgo -q -f public/crests --multipass")


if __name__ == "__main__":
    main()
