#!/bin/bash
# Re-export the site's data from pl-value and publish it: commit public/data and
# push to main, where GitHub Actions tests, builds and deploys to Pages.
#
# Runs every morning at 07:30 (scripts/install_publish_schedule.sh), half an
# hour after pl-value's own refresh. Safe to run by hand at any time:
#
#   - it does nothing while anything outside public/data is uncommitted, so work
#     in progress is never pushed;
#   - it stops without committing if the data has not changed, or if the tests
#     or the build fail;
#   - it never force-pushes.
#
# Everything goes to logs/publish.log. When a run fails (or is skipped because
# of uncommitted work), it opens a GitHub issue labelled publish-failed, so
# GitHub emails you; later runs comment on it, and the first good run closes it.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$REPO/logs/publish.log"
# pl-value's daily refresh, which writes the dataset this script exports.
REFRESH_LABEL="com.plvalue.refresh"
REFRESH_WAIT_SECONDS=1200

mkdir -p "$REPO/logs"
exec >>"$LOG" 2>&1
cd "$REPO" || exit 1

REPO_SLUG="mlodyheros/premier_league_app"
ISSUE_LABEL="publish-failed"
RUN_START_LINE=$(($(wc -l < "$LOG") + 1))

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

open_issue() {
  gh issue list --repo "$REPO_SLUG" --label "$ISSUE_LABEL" --state open --json number --jq '.[0].number // empty' 2>/dev/null
}

# A failed or skipped run: open an issue (or comment on the open one) with this run's log.
notify_failure() {
  command -v gh >/dev/null || return 0
  local body
  body="$(printf 'Automatyczna publikacja danych nie powiodła się: **%s**\n\nOstatnie linie logu (`logs/publish.log` na Macu):\n\n```\n%s\n```\n' \
    "$1" "$(tail -n +"$RUN_START_LINE" "$LOG" | sed 's/\x1b\[[0-9;]*m//g' | tail -60)")"
  local number
  number="$(open_issue)"
  if [ -n "$number" ]; then
    gh issue comment "$number" --repo "$REPO_SLUG" --body "$body" >/dev/null && log "Commented on issue #$number."
  else
    gh issue create --repo "$REPO_SLUG" --label "$ISSUE_LABEL" \
      --title "Publikacja danych nie powiodła się ($(date '+%Y-%m-%d'))" --body "$body" >/dev/null && log "Opened a publish-failed issue."
  fi
}

# A good run after failures: close the open issue.
notify_ok() {
  command -v gh >/dev/null || return 0
  local number
  number="$(open_issue)"
  [ -n "$number" ] && gh issue close "$number" --repo "$REPO_SLUG" --comment "Publikacja znów działa: $1" >/dev/null && log "Closed issue #$number."
  return 0
}

stop() {
  log "$1"
  case "${2:-0}" in
    0) [ "${3:-}" = ok ] && notify_ok "$1" ;;
    *) notify_failure "$1" ;;
  esac
  log "---"
  exit "${2:-0}"
}

log "Publishing data from $REPO"

branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$branch" = "main" ] || stop "On branch $branch, not main; nothing done."

# Work in progress anywhere but public/data: leave everything alone.
if [ -n "$(git status --porcelain -- . ':(exclude)public/data')" ]; then
  git status --short -- . ':(exclude)public/data'
  stop "Uncommitted changes outside public/data; nothing done." 2
fi

# public/data is generated, so anything left there by an earlier failed run is
# dropped rather than mixed into today's export.
if [ -n "$(git status --porcelain -- public/data)" ]; then
  log "Discarding leftover changes in public/data from an earlier run."
  git checkout -- public/data
fi

# If the Mac slept through 07:00 and 07:30, launchd starts both jobs on waking.
# Wait for pl-value's refresh rather than export a dataset it is rewriting.
waited=0
while launchctl print "gui/$(id -u)/$REFRESH_LABEL" 2>/dev/null | grep -q "state = running"; do
  [ "$waited" -ge "$REFRESH_WAIT_SECONDS" ] && stop "pl-value's refresh still running after ${waited}s; try again later." 1
  [ "$waited" -eq 0 ] && log "Waiting for pl-value's refresh to finish..."
  sleep 30
  waited=$((waited + 30))
done

git pull --ff-only || stop "git pull --ff-only failed; nothing done." 1

npm run export-data || stop "Export failed; nothing committed." 1

# exportedAt changes on every export; on its own it is not new data.
data_changes="$(git diff --unified=0 -- public/data | grep -E '^[+-][^+-]' | grep -v '"exportedAt"')"
if [ -z "$data_changes" ] && [ -z "$(git ls-files --others --exclude-standard -- public/data)" ]; then
  git checkout -- public/data
  stop "Data unchanged; nothing to publish." 0 ok
fi

npm test || { git checkout -- public/data; stop "Tests failed; nothing committed." 1; }
npm run build || { git checkout -- public/data; stop "Build failed; nothing committed." 1; }

date_and_gw="$(node -e '
  const m = JSON.parse(require("fs").readFileSync("public/data/meta.json", "utf8"));
  process.stdout.write(`${m.dataDate} (GW ${m.gameweek})`);
')"
git add -- public/data
git commit -q -m "Update data to $date_and_gw" -- public/data || stop "Commit failed." 1
git push origin main || stop "Push failed; the commit is local, push it by hand." 1

stop "Published: $(git log -1 --format='%h %s')" 0 ok
