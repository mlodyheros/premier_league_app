#!/bin/bash
# Runs scripts/publish_data.sh every morning at 07:30 (macOS launchd), half an
# hour after pl-value's own refresh at 07:00. If the Mac is asleep then, launchd
# runs it on waking. Output goes to logs/publish.log.
#
# Remove it again with scripts/uninstall_publish_schedule.sh.
#
# Keep this checkout outside Desktop, Documents and Downloads: macOS does not let
# background jobs read those folders.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.plgames.publish"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

# launchd starts jobs with a bare PATH; give this one node, npm and git.
NODE_DIR="$(dirname "$(command -v node)")"
GIT_DIR="$(dirname "$(command -v git)")"
JOB_PATH="$NODE_DIR:$GIT_DIR:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$HOME/Library/LaunchAgents" "$REPO/logs"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string><string>$REPO/scripts/publish_data.sh</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$JOB_PATH</string></dict>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>30</integer></dict>
  <key>StandardOutPath</key><string>$REPO/logs/publish.log</string>
  <key>StandardErrorPath</key><string>$REPO/logs/publish.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed $LABEL: daily at 07:30, log in $REPO/logs/publish.log"
