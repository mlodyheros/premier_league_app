#!/bin/sh
# Re-export players and model estimates from a local pl-value-predictor checkout.
# Set PL_VALUE_DIR if it is not at ~/Desktop/pl-value-predictor.
set -eu
PL_VALUE_DIR="${PL_VALUE_DIR:-$HOME/Desktop/pl-value-predictor}"
PYTHON="$PL_VALUE_DIR/.venv/bin/python"
if [ ! -x "$PYTHON" ]; then
  echo "No Python environment at $PYTHON. Set PL_VALUE_DIR, or create pl-value's .venv first." >&2
  exit 1
fi
cd "$(dirname "$0")/.."
"$PYTHON" -W ignore pipeline/export_data.py --pl-value "$PL_VALUE_DIR"
