#!/bin/zsh
set -euo pipefail

request_file="/Users/charles/photoshop/ps_request.json"
response_file="/Users/charles/photoshop/ps_response.json"
agent_jsx="/Users/charles/photoshop/ps_agent.jsx"
runner="/Users/charles/photoshop/run_ps.sh"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 '{\"command\":\"list_layers\"}'" >&2
  echo "   or: $0 /path/to/request.json" >&2
  exit 1
fi

if [[ -f "$1" ]]; then
  cp "$1" "$request_file"
else
  echo "$1" > "$request_file"
fi

"$runner" "$agent_jsx"

if [[ -f "$response_file" ]]; then
  cat "$response_file"
else
  echo "No response file: $response_file" >&2
  exit 1
fi
