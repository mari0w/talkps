#!/bin/zsh
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <natural language instruction>" >&2
  exit 1
fi

python3 "$script_dir/ps_nl.py" "$@"
