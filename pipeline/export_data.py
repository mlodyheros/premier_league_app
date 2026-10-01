"""Export pl-value's players and model estimates to static JSON for the site.

Runs with pl-value's own Python environment, because the model's estimates are
not stored anywhere in pl-value: its API computes them on startup. Calling the
same functions here keeps every figure identical to what pl-value itself shows.

    ~/Desktop/pl-value-predictor/.venv/bin/python pipeline/export_data.py \
        --pl-value ~/Desktop/pl-value-predictor

Nothing is fetched from the network: it reads pl-value's built dataset, its
calibration file and its cached FPL snapshot, and writes public/data/.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import date, datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from reference import CLUBS, COUNTRIES, POSITIONS, flag  # noqa: E402

OUT_DIR = HERE.parent / "public" / "data"
REPO_URL = "https://github.com/mlodyheros/pl-value-predictor"
RANGE_LEVEL = 0.8
TIER_CODES = {"pl_history": 0, "non_pl_history": 1, "no_history": 2}

# Share of a missing measure's percentile: an unknown is treated as a little
# below average rather than as the worst in the league.
MISSING_PERCENTILE = 0.35
# Below five full matches a per-90 rate is mostly noise.
MIN_RATE_MINUTES = 450

# Weights of the performance rating. Goalkeepers have no attacking measures, so
# theirs are spread across the rest.
PERF_WEIGHTS = {
    "this_season_share": 0.15,
    "last_season_share": 0.15,
    "career_share": 0.10,
    "bps_per90": 0.15,
    "form_ppg": 0.15,
    "xgchain": 0.10,
    "gi_per90": 0.10,
    "cl_matches": 0.10,
}
GK_SKIP = {"xgchain", "gi_per90"}


def _load_pl_value(root: Path):
    sys.path.insert(0, str(root))
    import pandas as pd
    from backend import confidence
    from backend.config import CALIBRATION_PATH, FPL_RAW_DIR, PROCESSED_DATASET_PATH
    from backend.features import add_derived_features
    from backend.model import cross_validate_model, out_of_fold_predictions

    df = add_derived_features(pd.read_csv(PROCESSED_DATASET_PATH))
    df["predicted_eur"] = out_of_fold_predictions(df)
    df["tier"] = confidence.coverage_tiers(df)
    calibration = json.loads(CALIBRATION_PATH.read_text())
    bootstrap = json.loads((FPL_RAW_DIR / "bootstrap_static.json").read_text())
    return {
        "df": df,
        "confidence": confidence,
        "calibration": calibration,
        "metrics": cross_validate_model(df),
        "bootstrap": bootstrap,
        "dataset_date": date.fromtimestamp(PROCESSED_DATASET_PATH.stat().st_mtime),
    }


def _fpl_extras(df, bootstrap):
    """This season's FPL figures, joined on pl-value's fpl_id."""
    import pandas as pd

    elements = {e["id"]: e for e in bootstrap["elements"]}
    rows = []
    for fpl_id in df["fpl_id"]:
        e = elements.get(int(fpl_id)) if pd.notna(fpl_id) else None
        rows.append(
            {
                "web_name": e["web_name"] if e else None,
                "fpl_points": e["total_points"] if e else 0,
                "fpl_goals": e["goals_scored"] if e else 0,
                "fpl_assists": e["assists"] if e else 0,
                "fpl_ppg": float(e["points_per_game"]) if e else 0.0,
                "fpl_minutes_live": e["minutes"] if e else 0,
            }
        )
    return pd.DataFrame(rows, index=df.index)


def _performance(df):
    """0-100 performance rating, a percentile within the position group.

    Built only from what players have done (minutes, bonus points, xGChain,
    goal involvement, FPL form, Champions League games), never from price, so
    the games can combine it with whichever value source is active.
    """
    import numpy as np
    import pandas as pd

    measures = pd.DataFrame(index=df.index)
    measures["this_season_share"] = df["minutes_share"]
    measures["last_season_share"] = df["recent_minutes_share"]
    measures["career_share"] = df["career_minutes_share"]
    measures["bps_per90"] = np.where(
        df["hist_minutes"] >= MIN_RATE_MINUTES,
        df["hist_bps"] / df["hist_minutes"].clip(lower=1) * 90,
        np.nan,
    )
    measures["form_ppg"] = np.where(df["fpl_minutes"] >= 90, df["fpl_ppg"], np.nan)
    measures["xgchain"] = np.where(df["has_quality_record"] == 1, df["xgchain_vs_position"], np.nan)
    measures["gi_per90"] = np.where(df["career_minutes_share"] > 0, df["career_gi_per90"], np.nan)
    measures["cl_matches"] = df["cl_matches_last"]

    score = pd.Series(0.0, index=df.index)
    for group, idx in df.groupby("pos_group").groups.items():
        weights = {k: w for k, w in PERF_WEIGHTS.items() if not (group == "GK" and k in GK_SKIP)}
        total = sum(weights.values())
        for measure, weight in weights.items():
            pct = measures.loc[idx, measure].rank(pct=True).fillna(MISSING_PERCENTILE)
            score.loc[idx] += pct * weight / total
    # Re-rank so every group spreads across the full 0-100 scale.
    return (score.groupby(df["pos_group"]).rank(pct=True) * 100).round().astype(int)


def _is_known(row) -> bool:
    """Recognisable enough to be a daily puzzle answer."""
    return bool(
        row.market_value_eur >= 25_000_000
        or (row.market_value_eur >= 10_000_000 and row.hist_minutes >= 4000)
    )


def _season(bootstrap) -> str:
    first = min(e["deadline_time"] for e in bootstrap["events"])
    year = int(first[:4])
    return f"{year}/{str(year + 1)[-2:]}"


def build(root: Path) -> tuple[list[dict], dict]:
    import pandas as pd

    src = _load_pl_value(root)
    df, calibration, confidence = src["df"], src["calibration"], src["confidence"]
    df = df.join(_fpl_extras(df, src["bootstrap"]))

    unknown_pos = set(df["position"]) - POSITIONS.keys()
    unknown_nat = set(df["nationality"]) - COUNTRIES.keys()
    unknown_club = set(df["club_code"]) - CLUBS.keys()
    if unknown_pos or unknown_nat or unknown_club:
        raise SystemExit(
            "Add these to pipeline/reference.py first: "
            f"positions={sorted(unknown_pos)} nationalities={sorted(unknown_nat)} "
            f"clubs={sorted(unknown_club)}"
        )

    df["pos_group"] = df["position"].map(lambda p: POSITIONS[p][1])
    df["perf"] = _performance(df)

    players = []
    for pid, row in df.iterrows():
        pos_code, pos_group = POSITIONS[row.position]
        nat_name, nat_code, continent = COUNTRIES[row.nationality]
        low, high = confidence.interval(row.predicted_eur, row.tier, calibration, RANGE_LEVEL)
        fee = None if pd.isna(row.transfer_fee_eur) else int(row.transfer_fee_eur)
        players.append(
            {
                "id": int(pid),
                "name": row["name"],
                "short": row["name"].split(" ")[-1] if pd.isna(row.web_name) else row.web_name,
                "club": row.club_code,
                "pos": pos_code,
                "group": pos_group,
                "age": int(row.age),
                "nat": nat_name,
                "flag": flag(nat_code),
                "continent": continent,
                "tm": int(row.market_value_eur),
                "model": int(round(row.predicted_eur, -4)),
                "low": int(round(low, -4)),
                "high": int(round(high, -4)),
                "tier": TIER_CODES[row.tier],
                "perf": int(row.perf),
                "known": _is_known(row),
                "contract": None if pd.isna(row.contract_expiry) else str(row.contract_expiry)[:4],
                "fee": fee,
                "stats": {
                    "minutes": int(row.fpl_minutes),
                    "goals": int(row.fpl_goals),
                    "assists": int(row.fpl_assists),
                    "points": int(row.fpl_points),
                    "plSeasons": int(row.hist_seasons) if row.has_hist_record else 0,
                    "plMinutes": int(row.hist_minutes),
                    "plGoals": int(row.hist_goals),
                    "plAssists": int(row.hist_assists),
                    "clMinutes": int(row.cl_minutes_last),
                },
            }
        )

    metrics = src["metrics"]
    tiers = {}
    for tier, code in TIER_CODES.items():
        lo, hi = confidence.interval(1.0, tier, calibration, RANGE_LEVEL)
        tiers[str(code)] = {
            "key": tier,
            "label": confidence.TIER_LABELS.get(tier, tier),
            "players": int((df.tier == tier).sum()),
            "rangeLow": round(float(lo), 2),
            "rangeHigh": round(float(hi), 2),
        }

    meta = {
        "season": _season(src["bootstrap"]),
        "dataDate": src["dataset_date"].isoformat(),
        "gameweek": int(df["fpl_gameweeks"].max()),
        "exportedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": {"name": "pl-value-predictor", "url": REPO_URL},
        "players": len(players),
        "model": {
            "kind": "Linear regression on log(1 + value), weighted by √value",
            "features": 25,
            "scoring": "out-of-fold (5-fold), averaged over 20 random splits",
            "cvR2Log": round(metrics["cv_r2_log"], 3),
            "cvMaeEur": int(round(metrics["cv_mae_eur"], -4)),
            "cvRmseEur": int(round(metrics["cv_rmse_eur"], -4)),
            "cvTopDecileMaeEur": int(round(metrics["cv_top_decile_mae_eur"], -4)),
            "cvTopDecileRatio": round(metrics["cv_top_decile_ratio"], 3),
            "rangeLevel": RANGE_LEVEL,
            "tiers": tiers,
        },
        "clubs": CLUBS,
    }
    return players, meta


def _diagnostics(players: list[dict]) -> dict:
    """Plain-language accuracy figures, from the same out-of-fold estimates the
    games use. They reproduce pl-value's README (typical miss 28%, 430 of 540
    inside the range, 1.7x below EUR5m, 0.95x above EUR20m)."""
    from statistics import median

    def miss(p):
        return math.exp(abs(math.log(p["model"] / p["tm"]))) - 1

    no_record = [p for p in players if p["tier"] == 2]
    others = [p for p in players if p["tier"] != 2]
    return {
        "typicalMiss": round(median(miss(p) for p in players), 3),
        "inRange": sum(p["low"] <= p["tm"] <= p["high"] for p in players),
        "ratioUnder5m": round(median(p["model"] / p["tm"] for p in players if p["tm"] < 5_000_000), 2),
        "ratioOver20m": round(median(p["model"] / p["tm"] for p in players if p["tm"] > 20_000_000), 2),
        "typicalMissNoRecord": round(median(miss(p) for p in no_record), 3),
        "typicalMissWithRecord": round(median(miss(p) for p in others), 3),
        "totalModelEur": sum(p["model"] for p in players),
        "totalTmEur": sum(p["tm"] for p in players),
    }


def _check(players: list[dict]) -> None:
    for p in players:
        for key in ("tm", "model", "low", "high"):
            if not (isinstance(p[key], int) and p[key] > 0):
                raise SystemExit(f"Bad {key} for {p['name']}: {p[key]!r}")
        if not p["low"] <= p["model"] <= p["high"]:
            raise SystemExit(f"Range does not contain the estimate for {p['name']}")
        if math.isnan(p["perf"]):
            raise SystemExit(f"No performance rating for {p['name']}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--pl-value",
        type=Path,
        default=Path.home() / "Desktop" / "pl-value-predictor",
        help="path to a pl-value-predictor checkout with a built dataset",
    )
    args = parser.parse_args()
    root = args.pl_value.expanduser().resolve()
    if not (root / "data" / "processed" / "pl_players.csv").exists():
        raise SystemExit(f"No built dataset under {root}; run pl-value's build first.")

    players, meta = build(root)
    _check(players)
    meta["model"]["diagnostics"] = _diagnostics(players)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "players.json").write_text(
        json.dumps(players, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    )
    (OUT_DIR / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2, allow_nan=False))
    crest_dir = OUT_DIR.parent / "crests"
    missing = sorted(code for code in CLUBS if not (crest_dir / f"{code}.svg").exists())
    if missing:
        print(f"Warning: no crest for {', '.join(missing)}; run pipeline/fetch_crests.py")
    known = sum(p["known"] for p in players)
    print(
        f"Exported {len(players)} players ({known} in the daily pool), "
        f"data from {meta['dataDate']} (GW{meta['gameweek']}) -> {OUT_DIR}"
    )


if __name__ == "__main__":
    main()
