#!/bin/bash

# Run all background method tests
# Usage: ./run-all.sh [test-number]
# Example: ./run-all.sh 1  # Run only SSH test

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for required env vars
if [ -z "$DAYTONA_API_KEY" ]; then
  echo "Error: DAYTONA_API_KEY is not set"
  exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY is not set"
  exit 1
fi

echo "========================================"
echo "Background Execution Methods Test Suite"
echo "========================================"
echo ""

run_test() {
  local num=$1
  local name=$2
  echo ""
  echo "========================================"
  echo "Running Test $num: $name"
  echo "========================================"
  echo ""
  npx tsx "$SCRIPT_DIR/0${num}-${name}.ts"
  echo ""
}

if [ -n "$1" ]; then
  # Run specific test
  case $1 in
    1) run_test 1 "ssh" ;;
    2) run_test 2 "execute-command" ;;
    3) run_test 3 "session-command" ;;
    4) run_test 4 "pty" ;;
    *) echo "Unknown test number: $1"; exit 1 ;;
  esac
else
  # Run all tests
  run_test 1 "ssh"
  run_test 2 "execute-command"
  run_test 3 "session-command"
  run_test 4 "pty"
fi

echo ""
echo "========================================"
echo "All tests complete!"
echo "========================================"
