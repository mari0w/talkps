#!/bin/zsh
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/script.jsx" >&2
  exit 1
fi

jsx_path="$1"

if [[ ! -f "$jsx_path" ]]; then
  echo "JSX file not found: $jsx_path" >&2
  exit 1
fi

osascript - "$jsx_path" <<'APPLESCRIPT'
on run argv
  set jsxPath to POSIX file (item 1 of argv)
  tell application id "com.adobe.Photoshop"
    do javascript file jsxPath
  end tell
  return ""
end run
APPLESCRIPT
