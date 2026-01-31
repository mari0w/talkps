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

args=("$jsx_path")
if [[ -n "${PS_REQUEST_FILE:-}" ]]; then
  args+=("$PS_REQUEST_FILE")
fi
if [[ -n "${PS_RESPONSE_FILE:-}" ]]; then
  args+=("$PS_RESPONSE_FILE")
fi

osascript - "${args[@]}" <<'APPLESCRIPT'
on run argv
  set jsxPath to POSIX file (item 1 of argv)
  set argCount to (count of argv)
  if argCount >= 3 then
    set reqPath to item 2 of argv
    set resPath to item 3 of argv
    tell application id "com.adobe.Photoshop"
      do javascript file jsxPath with arguments {reqPath, resPath}
    end tell
  else if argCount = 2 then
    set reqPath to item 2 of argv
    tell application id "com.adobe.Photoshop"
      do javascript file jsxPath with arguments {reqPath}
    end tell
  else
    tell application id "com.adobe.Photoshop"
      do javascript file jsxPath
    end tell
  end if
  return ""
end run
APPLESCRIPT
