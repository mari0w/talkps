#!/bin/zsh
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
request_file="${PS_REQUEST_FILE:-$script_dir/ps_request.json}"
response_file="${PS_RESPONSE_FILE:-$script_dir/ps_response.json}"
agent_jsx="${PS_AGENT_JSX:-$script_dir/ps_agent.jsx}"
runner="${PS_RUNNER:-$script_dir/run_ps.sh}"

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

: > "$response_file"
"$runner" "$agent_jsx"

if [[ -f "$response_file" ]]; then
  cat "$response_file"
else
  echo "No response file: $response_file" >&2
  exit 1
fi
