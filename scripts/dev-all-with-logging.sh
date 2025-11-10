#!/bin/bash

# Script to run all package dev servers in parallel with logging
# Each package logs to /tmp/campaign-<package>-dev.log
#
# Usage: ./scripts/dev-all-with-logging.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# List of packages to run
PACKAGES=("api" "frontend" "rules-engine" "scheduler")

echo "==========================================="
echo "Starting all dev servers with logging"
echo "==========================================="
echo ""

# Store PIDs for cleanup
PIDS=()

# Trap to kill all child processes on exit
cleanup() {
  echo ""
  echo "Shutting down all dev servers..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Start each package in the background
for package in "${PACKAGES[@]}"; do
  LOG_FILE="/tmp/campaign-${package}-dev.log"
  echo "Starting @campaign/${package} (logging to ${LOG_FILE})"

  # Run the dev command with logging in the background
  "${SCRIPT_DIR}/dev-with-logging.sh" "$package" &
  PIDS+=($!)
done

echo ""
echo "==========================================="
echo "All dev servers started!"
echo "==========================================="
echo ""
echo "Log files:"
for package in "${PACKAGES[@]}"; do
  echo "  - /tmp/campaign-${package}-dev.log"
done
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for all background processes
wait
